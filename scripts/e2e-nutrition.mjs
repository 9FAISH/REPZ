// E2E: nutrition engine — rings/targets, adaptation callout, food logging,
// repeat-yesterday, weigh-in sheet, trend chart.
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
  for (const t of db.tables) if (t.name !== 'exercises') await t.clear()
  await repo.completeSetup(
    { name: 'Faris', sex: 'male', age: 29, heightCm: 175, weightKg: 75, goal: 'bulk', activityLevel: 'active', split: 'ppl', daysPerWeek: 5 },
    [{ name: 'DUMBBELL', available: true, updatedAt: Date.now() }],
  )
  // 15 days of a FLAT bulk → the engine should raise targets by +150/+5
  const day = (offset) => { const d = new Date(); d.setDate(d.getDate() - offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  for (let i = 14; i >= 0; i--) await repo.logWeighIn(75 + (i % 2 ? 0.05 : -0.05), day(i))
  // Yesterday's meals for the repeat button
  await repo.logFood({ date: day(1), name: 'Overnight oats + whey', kcal: 520, proteinG: 38 })
  await repo.logFood({ date: day(1), name: 'Chicken, rice, greens', kcal: 710, proteinG: 52 })
})

// ── Food screen: adaptation fires on mount, targets = base + 150 / + 5 ──
// base: BMR(75)=1704 → ×1.725 + 275 → 3210 kcal, protein 135 g
await page.goto('http://localhost:5173/#/food', { waitUntil: 'networkidle' })
await page.getByText('AUTO-ADJUSTED', { exact: true }).waitFor({ timeout: 5000 })
await page.getByText('+150 kcal').waitFor()
const kcalTarget = await page.locator('.food-legend-target').first().textContent()
if (!kcalTarget.includes('3,360')) fail(`kcal target "${kcalTarget}", want / 3,360`)
const proTarget = await page.locator('.food-legend-target').nth(1).textContent()
if (!proTarget.includes('140')) fail(`protein target "${proTarget}", want / 140 g`)

// ── Log food via the sheet ──
await page.getByRole('button', { name: '+ Log food' }).click()
await page.getByText('What did you eat?').waitFor()
await page.getByPlaceholder('optional').fill('Salmon + potatoes')
await page.getByPlaceholder('required').fill('430')
await page.getByPlaceholder('0', { exact: true }).fill('24')
await page.getByRole('button', { name: 'Add to today' }).click()
await page.getByText('Salmon + potatoes').waitFor()
const kcalNow = await page.locator('.food-legend-value').first().textContent()
if (!kcalNow.startsWith('430')) fail(`eaten kcal "${kcalNow}"`)

// ── Repeat yesterday copies both meals ──
await page.getByRole('button', { name: 'Repeat yesterday' }).click()
await page.getByText('Overnight oats + whey').waitFor()
await page.getByText('Chicken, rice, greens').waitFor()
const totals = await page.evaluate(() => window.repz.repo.dayTotals())
if (totals.kcal !== 430 + 520 + 710) fail(`day kcal ${totals.kcal}`)
if (totals.proteinG !== 24 + 38 + 52) fail(`day protein ${totals.proteinG}`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-food.png` })

// ── Progress: chart, trend pill, weigh-in sheet ──
await page.goto('http://localhost:5173/#/progress', { waitUntil: 'networkidle' })
await page.getByText('7-day rolling avg').waitFor()
const polylines = await page.locator('polyline').count()
if (polylines !== 2) fail(`polylines: ${polylines}`)
await page.getByRole('button', { name: "Log today's weigh-in" }).click()
await page.locator('.weigh-label').waitFor()
await page.getByRole('button', { name: 'Plus point one' }).click()
await page.getByRole('button', { name: 'Save weigh-in' }).click()
await page.getByText('7-day rolling avg').waitFor()
const weighs = await page.evaluate(async () => {
  const w = await window.repz.repo.listWeighIns()
  return { count: w.length, last: w[w.length - 1].weightKg }
})
if (weighs.count !== 15) fail(`weigh-in count ${weighs.count} (same-day upsert expected)`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-progress.png` })

// ── Dashboard uses the adapted protein target ──
await page.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' })
await page.locator('.home-greeting').waitFor()
const homeProtein = await page.locator('.home-stat-unit').first().textContent()
if (!homeProtein.includes('140')) fail(`home protein target "${homeProtein}", want / 140 g`)

await browser.close()
if (failures) {
  console.error(`E2E NUTRITION: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E NUTRITION ALL PASS')
