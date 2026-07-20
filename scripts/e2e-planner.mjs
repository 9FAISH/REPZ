// E2E: weekly planner, per-day slot editing, add/remove slots, region
// retargeting, and picker search.
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
    ['BARBELL', 'DUMBBELL', 'CABLE', 'LEVERAGE MACHINE', 'BODY WEIGHT'].map((name) => ({
      name, available: true, updatedAt: Date.now(),
    })),
  )
})

// ── Weekly plan: Sat push, Sun pull, Mon legs, Tue rest, Wed upper, Thu lower ──
await page.goto('http://localhost:5173/#/train/plan', { waitUntil: 'networkidle' })
await page.getByText('Weekly plan').waitFor()
const setDay = async (dayName, choice) => {
  const card = page.locator('.plan-day', { has: page.locator('.plan-day-name', { hasText: dayName }) })
  await card.getByRole('button', { name: choice, exact: true }).click()
}
await setDay('Sat', 'Push')
await setDay('Sun', 'Pull')
await setDay('Mon', 'Legs')
await setDay('Tue', 'Rest')
await setDay('Wed', 'Upper')
await setDay('Thu', 'Lower')
await setDay('Fri', 'Rest')
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOT_DIR}/e2e-plan.png` })

const plan = await page.evaluate(() => window.repz.repo.getWeeklyPlan())
// stored Monday-first
const want = ['legs', null, 'upper', 'lower', null, 'push', 'pull']
if (JSON.stringify(plan) !== JSON.stringify(want)) fail(`plan ${JSON.stringify(plan)} want ${JSON.stringify(want)}`)

// ── Edit a NON-today day (Saturday = index 5) ──
await page.goto('http://localhost:5173/#/train?day=5', { waitUntil: 'networkidle' })
await page.getByText('One exercise per muscle slot').waitFor()
const title = await page.locator('.screen-title').textContent()
if (title !== 'Push') fail(`day=5 title "${title}", want Push`)
const satOn = await page.locator('.builder-day-on').textContent()
if (!satOn.startsWith('Sat')) fail(`active day tab "${satOn}"`)

// ── Add slots beyond the default 5 ──
const before = await page.locator('.builder-slot').count()
await page.getByRole('button', { name: '+ Add slot' }).click()
await page.locator('.region-sheet').waitFor()
await page.getByRole('button', { name: 'Rear delts', exact: true }).click()
await page.waitForTimeout(300)
const after = await page.locator('.builder-slot').count()
if (after !== before + 1) fail(`add slot: ${before} → ${after}`)
const lastRegion = await page.locator('.builder-slot-region').last().textContent()
if (!lastRegion.includes('REAR DELTS')) fail(`new slot region "${lastRegion}"`)

// add one more so we're clearly past 5
await page.getByRole('button', { name: '+ Add slot' }).click()
await page.locator('.region-sheet').waitFor()
await page.getByRole('button', { name: 'Calves', exact: true }).click()
await page.waitForTimeout(300)
if ((await page.locator('.builder-slot').count()) !== before + 2) fail('second add slot failed')

// ── Retarget an existing slot's muscle ──
await page.locator('.builder-slot-region').first().click()
await page.locator('.region-sheet').waitFor()
await page.getByRole('button', { name: 'Traps', exact: true }).click()
await page.waitForTimeout(300)
const firstRegion = await page.locator('.builder-slot-region').first().textContent()
if (!firstRegion.includes('TRAPS')) fail(`retarget failed: "${firstRegion}"`)

// ── Search inside the picker ──
await page.locator('.builder-pick').first().click()
await page.locator('.picker-search-input').waitFor()
await page.locator('.picker-search-input').fill('cable')
await page.waitForTimeout(500)
const names = await page.locator('.picker-ex-name').allTextContents()
if (names.length === 0) fail('search "cable" returned nothing')
if (!names.some((n) => /cable/i.test(n))) fail(`search results lack cable: ${names.slice(0, 3)}`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-search.png` })

// search reaches other muscle groups too
await page.locator('.picker-search-input').fill('leg press')
await page.waitForTimeout(500)
const legPress = await page.locator('.picker-ex-name').allTextContents()
if (!legPress.some((n) => /leg press/i.test(n))) fail(`"leg press" not found: ${legPress.slice(0, 3)}`)
await page.locator('.picker-choose').first().click()
await page.waitForTimeout(400)

// ── Remove a slot ──
const countBeforeRemove = await page.locator('.builder-slot').count()
await page.locator('.builder-remove').last().click()
await page.waitForTimeout(300)
if ((await page.locator('.builder-slot').count()) !== countBeforeRemove - 1) fail('remove slot failed')
await page.screenshot({ path: `${SHOT_DIR}/e2e-builder-custom.png` })

// ── Each day keeps its own slots ──
const satSlots = await page.evaluate(() => window.repz.repo.getDayDraft(5))
await page.goto('http://localhost:5173/#/train?day=6', { waitUntil: 'networkidle' })
await page.getByText('One exercise per muscle slot').waitFor()
const sunTitle = await page.locator('.screen-title').textContent()
if (sunTitle !== 'Pull') fail(`day=6 title "${sunTitle}", want Pull`)
const sunRegions = await page.locator('.builder-slot-region').allTextContents()
if (sunRegions.some((r) => r.includes('TRAPS'))) fail('Sunday inherited Saturday edits')
if (!satSlots || satSlots.length < 6) fail(`Saturday slots not persisted: ${satSlots?.length}`)

// ── Rest day shows the rest card ──
await page.goto('http://localhost:5173/#/train?day=1', { waitUntil: 'networkidle' })
await page.locator('.builder-rest-card').waitFor({ timeout: 5000 }).catch(() => fail('rest card missing on Tue'))

await browser.close()
if (failures) {
  console.error(`E2E PLANNER: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E PLANNER ALL PASS')
