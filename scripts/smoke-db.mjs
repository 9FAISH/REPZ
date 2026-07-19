// End-to-end smoke test of the REPZ Dexie layer via the dev-only window.repz handle.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 402, height: 874 } })
const consoleLines = []
page.on('console', (m) => consoleLines.push(m.text()))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.repz != null, null, { timeout: 5000 })

const result = await page.evaluate(async () => {
  const { db, repo, seedDone } = window.repz
  const out = {}

  // Wait for boot seeding to settle before clearing, so it can't
  // repopulate exercises mid-test.
  await seedDone

  // clean slate (ephemeral Playwright profile — no real user data here)
  await Promise.all(db.tables.map((t) => t.clear()))

  // profile round-trip
  await repo.saveProfile({
    sex: 'male', age: 28, heightCm: 182, weightKg: 76.5,
    goal: 'bulk', activityLevel: 'moderate', split: 'ppl', daysPerWeek: 5,
  })
  const prof = await repo.getProfile()
  out.profile = prof?.goal === 'bulk' && prof?.id === 'main' && (await repo.hasProfile())

  // equipment
  await repo.replaceEquipment([
    { name: 'Barbell', available: false, updatedAt: Date.now() },
    { name: 'Dumbbell', available: true, updatedAt: Date.now() },
  ])
  await repo.setEquipmentAvailable('Barbell', true)
  const avail = await repo.availableEquipmentNames()
  out.equipment = avail.has('Barbell') && avail.has('Dumbbell') && avail.size === 2

  // exercises (catalog empty until fetch script runs — bulkPut a fake row)
  await db.exercises.bulkPut([{
    exerciseId: 'exr_test1', name: 'Incline DB Press', equipments: ['Dumbbell'],
    bodyParts: ['Chest'], exerciseType: 'strength',
    targetMuscles: ['TEST Muscle Alpha'], secondaryMuscles: [],
    instructions: ['a'], exerciseTips: ['b'], variations: [], relatedExerciseIds: [],
  }])
  const byMuscle = await repo.exercisesByTargetMuscle('TEST Muscle Alpha')
  out.exerciseIndex = byMuscle.length === 1 && byMuscle[0].exerciseId === 'exr_test1'

  // template
  const tid = await repo.saveTemplate({
    name: 'Push A', dayType: 'push', favorite: false,
    slots: [{ region: 'Upper chest', exerciseId: 'exr_test1' }],
  })
  await repo.setTemplateFavorite(tid, true)
  out.template = (await repo.listFavoriteTemplates()).length === 1

  // session + sets
  const sid = await repo.startSession({ name: 'Push A', dayType: 'push', exerciseIds: ['exr_test1'], templateId: tid })
  await repo.logSet({ sessionId: sid, exerciseId: 'exr_test1', setNumber: 1, weightKg: 26, reps: 10, effort: 'solid' })
  await repo.logSet({ sessionId: sid, exerciseId: 'exr_test1', setNumber: 2, weightKg: 26, reps: 9, effort: 'barely' })
  const sets = await repo.setsForSession(sid)
  const active = await repo.getActiveSession()
  await repo.endSession(sid)
  out.session = sets.length === 2 && sets[1].effort === 'barely' && active?.id === sid
    && (await repo.getActiveSession()) == null

  // weight: upsert same day twice → one row
  await repo.logWeighIn(76.5)
  await repo.logWeighIn(76.7)
  const weights = await repo.listWeighIns()
  out.weight = weights.length === 1 && weights[0].weightKg === 76.7

  // nutrition
  await repo.logFood({ date: repo.todayKey(), name: 'Oats + whey', kcal: 520, proteinG: 38 })
  await repo.logFood({ date: repo.todayKey(), name: 'Chicken rice', kcal: 710, proteinG: 52 })
  const totals = await repo.dayTotals()
  out.nutrition = totals.kcal === 1230 && totals.proteinG === 90

  // kv
  await repo.kvSet('test.flag', { a: 1 })
  out.kv = (await repo.kvGet('test.flag'))?.a === 1

  // cleanup test data
  await Promise.all(db.tables.map((t) => t.clear()))
  return out
})

await browser.close()
const failed = Object.entries(result).filter(([, v]) => v !== true)
console.log('RESULTS', JSON.stringify(result))
console.log(consoleLines.filter((l) => l.includes('[repz]')).join('\n'))
if (failed.length) {
  console.error('FAILED:', failed.map(([k]) => k).join(', '))
  process.exit(1)
}
console.log('ALL PASS')
