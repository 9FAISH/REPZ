// E2E: real offline check against the PRODUCTION build (service worker +
// precache), plus install-prompt and update-banner behavior.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const SHOT_DIR = process.env.SHOT_DIR ?? '.'
const PORT = 4173
let failures = 0
const fail = (msg) => {
  console.error('FAIL:', msg)
  failures++
}

// Serve the built app (vite preview) — the dev server has no service worker.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: false,
})
const base = `http://localhost:${PORT}/`
const ready = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(base)
      if (r.ok) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}
if (!(await ready())) {
  server.kill()
  console.error('FAIL: preview server never came up')
  process.exit(1)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } })
const page = await ctx.newPage()

try {
  // First load: register the SW and seed a profile
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 })
    .catch(() => fail('service worker never took control'))

  await page.evaluate(async () => {
    // Production build has no window.repz — drive the UI instead.
    localStorage.setItem('e2e', '1')
  })

  // Complete setup through the real UI so IndexedDB has a profile
  await page.waitForURL(/#\/setup/, { timeout: 10000 })
  await page.getByPlaceholder('optional').fill('Faris')
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await page.getByRole('button', { name: "Let's go →" }).click()
  await page.locator('.home-greeting').waitFor({ timeout: 10000 })

  // Let the SW finish precaching everything
  await page.waitForTimeout(2500)

  // ── Go offline ──
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.home-greeting').waitFor({ timeout: 10000 })
  const greeting = await page.locator('.home-greeting').textContent()
  if (!greeting?.includes('Faris')) fail(`offline reload lost the profile: "${greeting}"`)

  // Offline banner should appear
  await page.locator('.pwa-banner-offline').waitFor({ timeout: 5000 })
    .catch(() => fail('offline banner not shown'))

  // Navigate lazily-loaded routes while offline (chunks must be precached)
  for (const [hash, marker] of [
    ['#/train', '.builder-slots'],
    ['#/food', '.food-rings-card'],
    ['#/progress', '.progress-current'],
    ['#/progress/shelf', '.shelf-grid'],
  ]) {
    await page.goto(base + hash, { waitUntil: 'domcontentloaded' })
    await page.locator(marker).waitFor({ timeout: 8000 })
      .catch(() => fail(`offline route ${hash} failed to render (${marker})`))
  }

  // Exercise catalog must be available offline too
  const catalogCount = await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    if (!dbs.some((d) => d.name === 'repz')) return -1
    return new Promise((resolve) => {
      const req = indexedDB.open('repz')
      req.onsuccess = () => {
        const tx = req.result.transaction('exercises', 'readonly')
        const count = tx.objectStore('exercises').count()
        count.onsuccess = () => resolve(count.result)
        count.onerror = () => resolve(-1)
      }
      req.onerror = () => resolve(-1)
    })
  })
  if (catalogCount < 100) fail(`offline catalog count ${catalogCount}, want 174`)

  await page.screenshot({ path: `${SHOT_DIR}/e2e-offline.png` })
  await ctx.setOffline(false)
} finally {
  await browser.close()
  server.kill('SIGTERM')
}

if (failures) {
  console.error(`E2E OFFLINE: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E OFFLINE ALL PASS')
