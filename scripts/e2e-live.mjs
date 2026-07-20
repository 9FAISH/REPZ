// E2E: live workout — set logging, rest timer, overload nudge, plate calc,
// auto-advance, mid-session resume, no-rest-after-final-set, finish.
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
const seeded = await page.evaluate(async () => {
  const { db, repo } = window.repz
  await window.repz.seedDone
  for (const t of db.tables) if (t.name !== 'exercises') await t.clear()
  await repo.completeSetup(
    { name: 'Faris', sex: 'male', age: 29, heightCm: 175, weightKg: 75, goal: 'bulk', activityLevel: 'active', split: 'ppl', daysPerWeek: 5 },
    [
      { name: 'BODY WEIGHT', available: true, updatedAt: Date.now() },
      { name: 'DUMBBELL', available: true, updatedAt: Date.now() },
      { name: 'BARBELL', available: true, updatedAt: Date.now() },
    ],
  )
  const all = await db.exercises.toArray()
  // Exercise 1: barbell (plate calculator applies); exercise 2: dumbbell.
  const barb = all.find((e) => e.equipments.includes('BARBELL'))
  const dumb = all.find((e) => e.equipments.includes('DUMBBELL'))
  const dayType = 'push'
  await repo.saveWeeklyPlan(Array(7).fill(dayType))
  await repo.saveDayDraft((new Date().getDay() + 6) % 7, [
    { region: 'Chest', exerciseId: barb.exerciseId },
    { region: 'Biceps', exerciseId: dumb.exerciseId },
  ])
  // Previous all-easy session at 20 kg → expect a 22.5 kg suggestion
  const sid = await repo.startSession({ name: 'Push', dayType, exerciseIds: [barb.exerciseId] })
  for (let i = 1; i <= 3; i++) {
    await repo.logSet({ sessionId: sid, exerciseId: barb.exerciseId, setNumber: i, weightKg: 20, reps: 10, effort: 'more' })
  }
  await repo.endSession(sid, 'completed')
  return { ex1: barb.name, ex2: dumb.name }
})

await page.goto('http://localhost:5173/#/train/live', { waitUntil: 'networkidle' })
await page.getByText('· LIVE').waitFor()

// Overload nudge from previous all-easy session
await page.getByText('try 22.5 kg').waitFor({ timeout: 4000 })
const weightShown = await page.locator('.live-numeral').first().textContent()
if (!weightShown.includes('22.5')) fail(`suggested weight not applied: "${weightShown}"`)

// Plate calculator (barbell exercise → numeral is a button)
await page.locator('button.live-numeral').click()
await page.getByText('PLATE MATH').waitFor()
await page.getByText('EACH SIDE').waitFor()
const plates = await page.locator('.plate').allTextContents()
if (plates.join(',') !== '1.25') fail(`plates for 22.5 on 20 bar: [${plates}] want [1.25]`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-plates.png` })
await page.locator('.plate-close').click()

// Log set 1 → rest overlay
await page.getByRole('button', { name: 'Barely 0 left' }).click()
await page.getByRole('button', { name: 'Log set · start rest' }).click()
await page.getByText(/REST · LOGGED 22.5 KG × 10/).waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-rest.png` })

// +30 s extends the countdown
const before = await page.locator('.rest-count').textContent()
await page.getByRole('button', { name: '+30 s' }).click()
const after = await page.locator('.rest-count').textContent()
const secs = (t) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1])
if (secs(after) - secs(before) < 25) fail(`+30s: ${before} → ${after}`)
await page.getByRole('button', { name: "Skip — I'm ready" }).click()
await page.getByText('Set 2 of 3').waitFor()

// Logged row shows the effort tag
const tag = await page.locator('.live-logged-tag').first().textContent()
if (tag !== 'BARELY') fail(`logged tag "${tag}"`)

// Finish exercise 1 → auto-advance to exercise 2
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Log set · start rest' }).click()
  await page.getByRole('button', { name: "Skip — I'm ready" }).click()
}
let exName = await page.locator('.live-ex-name').textContent()
if (exName !== seeded.ex2) fail(`auto-advance: showing "${exName}", want "${seeded.ex2}"`)
const chip1 = await page.locator('.live-chip').first().textContent()
if (!chip1.includes('3/3')) fail(`chip 1 progress: "${chip1}"`)

// Dumbbell exercise → weight numeral is NOT a plate-calc button
const numeralTag = await page.locator('.live-numeral').first().evaluate((el) => el.tagName)
if (numeralTag !== 'DIV') fail(`dumbbell numeral should be static, got <${numeralTag}>`)

// Mid-session resume: reload must land back on the unfinished exercise 2
await page.reload({ waitUntil: 'networkidle' })
await page.getByText('· LIVE').waitFor()
exName = await page.locator('.live-ex-name').textContent()
if (exName !== seeded.ex2) fail(`resume after reload: showing "${exName}", want "${seeded.ex2}"`)
await page.screenshot({ path: `${SHOT_DIR}/e2e-live.png` })

// Sets 1-2 of the final exercise rest normally…
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Log set · start rest' }).click()
  await page.getByRole('button', { name: "Skip — I'm ready" }).click()
}
// …but the FINAL set must not start a rest — Finish appears immediately
await page.getByRole('button', { name: 'Log set · start rest' }).click()
await page.getByRole('button', { name: 'Finish workout ✓' }).waitFor({ timeout: 4000 })
if (await page.locator('.rest-overlay').count()) fail('rest overlay shown after the final set')
await page.getByRole('button', { name: 'Finish workout ✓' }).click()
await page.locator('.home-greeting').waitFor()

const done = await page.evaluate(async () => {
  const sessions = await window.repz.repo.listSessions('completed')
  const active = await window.repz.repo.getActiveSession()
  return { completed: sessions.length, active: !!active, sets: (await window.repz.db.setLogs.toArray()).length }
})
if (done.completed !== 2) fail(`completed sessions: ${done.completed}`)
if (done.active) fail('session still active after finish')
if (done.sets !== 9) fail(`total sets logged: ${done.sets}, want 9`)

await browser.close()
if (failures) {
  console.error(`E2E LIVE: ${failures} failure(s)`)
  process.exit(1)
}
console.log('E2E LIVE ALL PASS')
