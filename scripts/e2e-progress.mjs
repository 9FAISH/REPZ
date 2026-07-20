// E2E: PR tracking, weekly volume, adherence, mascot shelf, backup export/import.
import { chromium } from 'playwright'
import { readFileSync, rmSync } from 'node:fs'

const SHOT_DIR = process.env.SHOT_DIR ?? '.'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, acceptDownloads: true })
const page = await ctx.newPage()
let failures = 0
const fail = (msg) => {
  console.error('FAIL:', msg)
  failures++
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.repz != null)
const seeded = await page.evaluate(async () => {
  const { db, repo } = window.repz
  await window.repz.seedDone
  for (const t of db.tables) if (t.name !== 'exercises') await t.clear()
  await repo.completeSetup(
    { name: 'Faris', sex: 'male', age: 29, heightCm: 175, weightKg: 75, goal: 'bulk', activityLevel: 'active', split: 'ppl', daysPerWeek: 5 },
    [{ name: 'BARBELL', available: true, updatedAt: Date.now() }],
  )
  const all = await db.exercises.toArray()
  const ex = all.find((e) => e.equipments.includes('BARBELL'))
  const ex2 = all.find((e) => e.equipments.includes('DUMBBELL'))
  // Three completed sessions with rising loads → PRs + volume + adherence
  for (const [i, w] of [80, 90, 100].entries()) {
    const sid = await repo.startSession({ name: 'Push', dayType: 'push', exerciseIds: [ex.exerciseId, ex2.exerciseId] })
    for (let s = 1; s <= 3; s++) {
      await repo.logSet({ sessionId: sid, exerciseId: ex.exerciseId, setNumber: s, weightKg: w, reps: 5, effort: 'solid' })
      await repo.logSet({ sessionId: sid, exerciseId: ex2.exerciseId, setNumber: s, weightKg: 20 + i * 2.5, reps: 10, effort: 'solid' })
    }
    await repo.endSession(sid, 'completed')
  }
  await repo.logWeighIn(75.5)
  return { ex: ex.name, ex2: ex2.name }
})

// ── Progress screen: PR count, adherence, weekly volume, shelf link ──
await page.goto('http://localhost:5173/#/progress', { waitUntil: 'networkidle' })
await page.getByText('WEEKLY VOLUME').waitFor()
const prCount = await page.locator('.progress-stat-value').first().textContent()
if (prCount !== '2') fail(`PR count "${prCount}", want 2`)
const adherenceTxt = await page.locator('.progress-stat-note').nth(1).textContent()
if (!adherenceTxt.includes('3/20')) fail(`adherence "${adherenceTxt}"`)
const volumeRows = await page.locator('.progress-volume-row').count()
if (volumeRows === 0) fail('no weekly volume rows')
const tonnageTxt = await page.locator('.progress-volume-tonnage').textContent()
// 3 sets × (80+90+100) × 5 reps + 3 × (20+22.5+25) × 10 reps = 4050 + 2025
if (!tonnageTxt.includes('6,075')) fail(`tonnage "${tonnageTxt}", want 6,075 kg`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-progress-full.png` })

// ── Records screen: best e1RM, expandable chart ──
await page.locator('.progress-stat').first().click()
await page.getByText('Personal records').waitFor()
const topE1rm = await page.locator('.records-e1rm').first().textContent()
if (!topE1rm.startsWith('116.7')) fail(`top e1RM "${topE1rm}", want 116.7 kg (100×5)`)
await page.locator('.records-main').first().click()
await page.locator('.records-chart polyline').waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-records.png` })

// ── Shelf: earned vs locked variants ──
await page.goto('http://localhost:5173/#/progress/shelf', { waitUntil: 'networkidle' })
await page.getByText('The Kilo shelf').waitFor()
const items = await page.locator('.shelf-item').count()
if (items !== 6) fail(`shelf items ${items}, want 6`)
const locked = await page.locator('.shelf-art-locked').count()
if (locked !== 5) fail(`locked variants ${locked}, want 5 (only OG earned)`)
// Mascot art must actually render (stills collapsed to 0 width once)
const artBox = await page.locator('.shelf-item img').first().boundingBox()
if (!artBox || artBox.width < 30) fail(`shelf art not rendering: ${JSON.stringify(artBox)}`)
await page.waitForTimeout(600)
await page.screenshot({ path: `${SHOT_DIR}/e2e-shelf.png` })

// ── Backup: export → wipe → import → data restored ──
await page.goto('http://localhost:5173/#/progress', { waitUntil: 'networkidle' })
const dl = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export backup' }).click(),
]).then(([d]) => d)
const path = await dl.path()
const backup = JSON.parse(readFileSync(path, 'utf8'))
if (backup.format !== 'repz-backup') fail(`backup format "${backup.format}"`)
if (backup.data.setLogs.length !== 18) fail(`backup setLogs ${backup.data.setLogs.length}, want 18`)

// Wipe everything, confirm the app is empty, then restore
await page.evaluate(async () => {
  const { db } = window.repz
  for (const t of db.tables) if (t.name !== 'exercises') await t.clear()
})
await page.goto('http://localhost:5173/#/progress', { waitUntil: 'networkidle' })
await page.waitForURL(/#\/setup/, { timeout: 5000 }).catch(() => fail('wipe should force setup'))

// Re-create a minimal profile so the progress screen is reachable for import
await page.evaluate(async () => {
  const { repo } = window.repz
  await repo.completeSetup(
    { name: 'Temp', sex: 'male', age: 30, heightCm: 175, weightKg: 80, goal: 'cut', activityLevel: 'light', split: 'ppl', daysPerWeek: 5 },
    [],
  )
})
await page.goto('http://localhost:5173/#/progress', { waitUntil: 'networkidle' })
await page.locator('.backup-card').waitFor()
await page.locator('input[type=file]').setInputFiles(path)
await page.getByText('Replace everything').waitFor()
await page.getByRole('button', { name: 'Replace everything' }).click()
await page.getByText(/Restored 18 sets/).waitFor({ timeout: 5000 })

const restored = await page.evaluate(async () => {
  const { db, repo } = window.repz
  const p = await repo.getProfile()
  return { name: p?.name, goal: p?.goal, sets: (await db.setLogs.toArray()).length, sessions: (await db.sessions.toArray()).length }
})
if (restored.name !== 'Faris') fail(`restored profile name "${restored.name}"`)
if (restored.goal !== 'bulk') fail(`restored goal "${restored.goal}" (should overwrite the temp profile)`)
if (restored.sets !== 18) fail(`restored sets ${restored.sets}`)
if (restored.sessions !== 3) fail(`restored sessions ${restored.sessions}`)

rmSync(path, { force: true })
await browser.close()
if (failures) {
  console.error(`E2E PROGRESS: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E PROGRESS ALL PASS')
