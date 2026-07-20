// Unit tests for the nutrition engine (pure math, node type-stripping).
import { strict as assert } from 'node:assert'
import {
  mifflinStJeorBMR,
  baseTargets,
  effectiveTargets,
  decideAdaptation,
} from '../src/lib/nutrition.ts'
import { chartPoints } from '../src/lib/chart.ts'

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    passed++
  } catch (err) {
    console.error(`✗ ${name}:`, err.message)
    process.exitCode = 1
  }
}

const profile = {
  id: 'main', sex: 'male', age: 29, heightCm: 175, weightKg: 75,
  goal: 'bulk', activityLevel: 'active', split: 'ppl', daysPerWeek: 5,
  createdAt: 0, updatedAt: 0,
}

// ── BMR / targets ──
test('BMR male 75kg/175cm/29y = 1704', () => assert.equal(mifflinStJeorBMR(profile, 75), 1704))
test('BMR female is 166 lower', () =>
  assert.equal(mifflinStJeorBMR({ ...profile, sex: 'female' }, 75), 1704 - 166))
test('bulk targets: TDEE×1.725 + 275, protein 1.8 g/kg', () => {
  const t = baseTargets(profile, 75)
  assert.equal(t.kcal, Math.round((1704 * 1.725 + 275) / 10) * 10) // 3210
  assert.equal(t.proteinG, 135)
})
test('cut targets: −550 kcal, protein 2.2 g/kg', () => {
  const t = baseTargets({ ...profile, goal: 'cut', activityLevel: 'sedentary' }, 75)
  assert.equal(t.kcal, Math.round((1704 * 1.2 - 550) / 10) * 10)
  assert.equal(t.proteinG, 165)
})
test('effectiveTargets applies the adaptation deltas', () => {
  const t = effectiveTargets(profile, 75, { kcalDelta: 150, proteinDelta: 5, adjustedAt: 0, direction: 'up' })
  assert.equal(t.kcal, baseTargets(profile, 75).kcal + 150)
  assert.equal(t.proteinG, 140)
})

// ── Adaptation decisions ──
const DAY = 86_400_000
const NOW = new Date('2026-07-19T12:00:00').getTime()
const key = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** n daily weigh-ins ending today, with the given kg/week slope. */
const series = (n, slopePerWeek, startKg = 75) =>
  Array.from({ length: n }, (_, i) => ({
    id: i, date: key(NOW - (n - 1 - i) * DAY), weightKg: startKg + (i * slopePerWeek) / 7, loggedAt: 0,
  }))

test('bulk + flat 15-day trend → +150 kcal +5 g', () => {
  const a = decideAdaptation('bulk', series(15, 0), undefined, NOW)
  assert.ok(a)
  assert.equal(a.kcalDelta, 150)
  assert.equal(a.proteinDelta, 5)
  assert.equal(a.direction, 'up')
})
test('bulk + healthy +0.25 trend → no change', () =>
  assert.equal(decideAdaptation('bulk', series(15, 0.25), undefined, NOW), null))
test('cut + stalled trend → −150 kcal, protein untouched', () => {
  const a = decideAdaptation('cut', series(15, 0), undefined, NOW)
  assert.equal(a.kcalDelta, -150)
  assert.equal(a.proteinDelta, 0)
  assert.equal(a.direction, 'down')
})
test('cut + losing −0.5 → no change', () =>
  assert.equal(decideAdaptation('cut', series(15, -0.5), undefined, NOW), null))
test('cooldown: adjustment 5 days ago blocks the next one', () => {
  const cur = { kcalDelta: 150, proteinDelta: 5, adjustedAt: NOW - 5 * DAY, direction: 'up' }
  assert.equal(decideAdaptation('bulk', series(15, 0), cur, NOW), null)
})
test('cooldown passed: stacks to +300', () => {
  const cur = { kcalDelta: 150, proteinDelta: 5, adjustedAt: NOW - 15 * DAY, direction: 'up' }
  const a = decideAdaptation('bulk', series(15, 0), cur, NOW)
  assert.equal(a.kcalDelta, 300)
  assert.equal(a.proteinDelta, 10)
})
test('cap: never beyond ±450', () => {
  const cur = { kcalDelta: 450, proteinDelta: 15, adjustedAt: NOW - 15 * DAY, direction: 'up' }
  assert.equal(decideAdaptation('bulk', series(15, 0), cur, NOW), null)
})
test('too little history (<8 weigh-ins) → no change', () =>
  assert.equal(decideAdaptation('bulk', series(7, 0), undefined, NOW), null))
test('first adjustment needs 14 days of history', () =>
  assert.equal(decideAdaptation('bulk', series(10, 0), undefined, NOW), null))

// ── Chart geometry ──
test('chartPoints: null under 2 points, both polylines with data', () => {
  assert.equal(chartPoints([]), null)
  assert.equal(chartPoints(series(1, 0)), null)
  const c = chartPoints(series(20, 0.25))
  assert.ok(c.rawPts.split(' ').length === 20)
  assert.ok(c.avgPts.split(' ').length === 20)
})

console.log(process.exitCode ? 'NUTRITION TESTS FAILED' : `NUTRITION ALL PASS (${passed} tests)`)
