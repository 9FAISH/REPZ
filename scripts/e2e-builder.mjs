// E2E: slot builder — pick/lock/swap, generate-for-me, dedupe, favorites, detail fill.
import { chromium } from 'playwright'

const SHOT_DIR = process.env.SHOT_DIR ?? '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 402, height: 874 } })
let failures = 0
const fail = (msg) => {
  console.error('FAIL:', msg)
  failures++
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.repz != null)
await page.evaluate(async () => {
  const { db, repo } = window.repz
  await window.repz.seedDone
  // fresh user state, keep the seeded catalog
  for (const t of db.tables) if (t.name !== 'exercises') await t.clear()
  await repo.completeSetup(
    { name: 'Faris', sex: 'male', age: 29, heightCm: 175, weightKg: 75, goal: 'bulk', activityLevel: 'active', split: 'ppl', daysPerWeek: 5 },
    [
      { name: 'BODY WEIGHT', available: true, updatedAt: Date.now() },
      { name: 'DUMBBELL', available: true, updatedAt: Date.now() },
      { name: 'CABLE', available: true, updatedAt: Date.now() },
      { name: 'LEVERAGE MACHINE', available: true, updatedAt: Date.now() },
    ],
  )
})

// Builder (Sunday is rest on PPL → builds next scheduled day: Push)
// Deterministic: make every weekday a Push day, edit today's
await page.evaluate(() => window.repz.repo.saveWeeklyPlan(Array(7).fill('push')))
await page.goto('http://localhost:5173/#/train', { waitUntil: 'networkidle' })
await page.getByText('One exercise per muscle slot').waitFor()
await page.evaluate(() => { window.__wd = (new Date().getDay() + 6) % 7 })
const title = await page.locator('.screen-title').textContent()
if (title !== 'Push') fail(`builder title "${title}", want "Push"`)

// Pick from the first slot's sheet
await page.getByRole('button', { name: '+ Pick exercise' }).first().click()
await page.getByText('FILL SLOT').waitFor()
const pickerTitle = await page.locator('.picker-title').textContent()
if (pickerTitle !== 'Upper chest') fail(`picker title "${pickerTitle}", want "Upper chest"`)
const rows = await page.locator('.picker-row').count()
if (rows < 1) fail(`picker rows for Upper chest: ${rows}`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-picker.png` })
const pickedName = await page.locator('.picker-ex-name').first().textContent()
await page.locator('.picker-choose').first().click()
await page.getByText('LOCKED').waitFor()
const lockedName = await page.locator('.builder-ex-name').first().textContent()
if (lockedName !== pickedName) fail(`locked "${lockedName}" ≠ picked "${pickedName}"`)

// Generate the rest
await page.getByRole('button', { name: /Generate for me/ }).click()
await page.getByRole('button', { name: /Start workout · 5 exercises/ }).waitFor({ timeout: 4000 })
const dupes = await page.evaluate(async () => {
  const draft = await window.repz.repo.getDayDraft(window.__wd)
  const ids = draft.map((s) => s.exerciseId).filter(Boolean)
  return { total: ids.length, unique: new Set(ids).size }
})
if (dupes.total !== 5) fail(`generate filled ${dupes.total}/5`)
if (dupes.unique !== dupes.total) fail(`duplicate exercises across slots: ${JSON.stringify(dupes)}`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-builder-full.png` })

// Hidden note mentions Barbell (off in inventory)
const note = await page.locator('.builder-hidden-note').textContent()
if (!/hidden/.test(note) || !/Barbell/.test(note)) fail(`hidden note: "${note}"`)

// Swap → cancel must keep the current pick (regression: used to clear it)
await page.locator('.builder-swap').first().click()
await page.getByText('FILL SLOT').waitFor()
await page.locator('.picker-close').click()
const afterCancel = await page.evaluate(async () => {
  const draft = await window.repz.repo.getDayDraft(window.__wd)
  return draft.filter((s) => s.exerciseId).length
})
if (afterCancel !== 5) fail(`swap-cancel dropped a pick: ${afterCancel}/5 filled`)

// Swap slot 1 → picker reopens for that region
await page.locator('.builder-swap').first().click()
await page.getByText('FILL SLOT').waitFor()
// Use the info button → detail screen → fill slot from there
await page.locator('.picker-info').first().click()
await page.getByText('HOW TO').waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-detail.png` })
await page.getByRole('button', { name: 'Fill slot with this →' }).click()
await page.getByText('LOCKED').first().waitFor()
const refilled = await page.evaluate(async () => {
  const draft = await window.repz.repo.getDayDraft(window.__wd)
  return draft.filter((s) => s.exerciseId).length
})
if (refilled !== 5) fail(`fill-from-detail left ${refilled}/5 filled`)

// Save to favorites → library shows it, Load works
await page.getByRole('button', { name: /^Save workout/ }).click()
await page.getByText('Saved ★').waitFor()
await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.getByText('Push A').waitFor()
const starred = await page.locator('.lib-star-on').count()
if (starred !== 1) fail(`starred count ${starred}`)
await page.getByRole('button', { name: 'Load' }).click()
await page.getByText('One exercise per muscle slot').waitFor()

// Exercise detail from a locked slot thumb
await page.locator('.builder-thumb').first().click()
await page.getByText('HOW TO').waitFor()

await browser.close()
if (failures) {
  console.error(`E2E BUILDER: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E BUILDER ALL PASS')
