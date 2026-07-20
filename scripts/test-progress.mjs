// Unit tests for progress analytics + mascot unlock rules (pure logic).
import { strict as assert } from 'node:assert'
import {
  e1rm,
  personalRecords,
  e1rmSeries,
  isPrSet,
  weeklyVolume,
  tonnage,
  adherence,
  trainingDays,
} from '../src/lib/progress.ts'

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

const DAY = 86_400_000
const NOW = 1_770_000_000_000
const set = (exerciseId, weightKg, reps, daysAgo = 0, sessionId = 1) => ({
  id: Math.random(), sessionId, exerciseId, setNumber: 1, weightKg, reps,
  effort: 'solid', loggedAt: NOW - daysAgo * DAY,
})

// ── e1RM ──
test('e1rm: Epley 100×5 = 116.7', () => assert.equal(e1rm(100, 5), 116.7))
test('e1rm: single rep equals the load', () => assert.equal(e1rm(100, 1), 103.3))
test('e1rm: bodyweight/invalid → 0', () => {
  assert.equal(e1rm(0, 10), 0)
  assert.equal(e1rm(50, 0), 0)
})

// ── PRs ──
test('personalRecords: keeps the best e1RM per exercise', () => {
  const prs = personalRecords([
    set('a', 100, 5), // 116.7
    set('a', 110, 3), // 121
    set('a', 90, 10), // 120
    set('b', 60, 8),
  ])
  assert.equal(prs.size, 2)
  assert.equal(prs.get('a').e1rm, 121)
  assert.equal(prs.get('a').weightKg, 110)
  assert.equal(prs.get('b').e1rm, e1rm(60, 8))
})
test('personalRecords: bodyweight-only sets are not ranked', () =>
  assert.equal(personalRecords([set('a', 0, 20)]).size, 0))
test('e1rmSeries: chronological, weighted only', () => {
  const s = e1rmSeries([set('a', 100, 5, 2), set('a', 0, 20, 1), set('a', 110, 3, 0)], 'a')
  assert.equal(s.length, 2)
  assert.ok(s[0].at < s[1].at)
})
test('isPrSet: beats all prior sets of that lift', () => {
  const history = [set('a', 100, 5, 5)]
  assert.equal(isPrSet(history, set('a', 110, 5, 0)), true)
  assert.equal(isPrSet(history, set('a', 90, 5, 0)), false)
  assert.equal(isPrSet(history, set('b', 20, 5, 0)), true) // first ever for b
  assert.equal(isPrSet(history, set('a', 0, 30, 0)), false) // bodyweight
})

// ── Volume / tonnage ──
const catalog = new Map([
  ['a', { exerciseId: 'a', targetMuscles: ['CHEST', 'TRICEPS'] }],
  ['b', { exerciseId: 'b', targetMuscles: ['CHEST'] }],
])
test('weeklyVolume: counts sets per target muscle inside the window', () => {
  const v = weeklyVolume([set('a', 50, 8, 1), set('b', 50, 8, 2), set('a', 50, 8, 30)], catalog, 7, NOW)
  assert.deepEqual(v, [
    { muscle: 'CHEST', sets: 2 },
    { muscle: 'TRICEPS', sets: 1 },
  ])
})
test('weeklyVolume: unknown exercises are skipped', () =>
  assert.deepEqual(weeklyVolume([set('zzz', 50, 8, 1)], catalog, 7, NOW), []))
test('tonnage: kg × reps inside the window', () =>
  assert.equal(tonnage([set('a', 100, 5, 1), set('a', 50, 10, 30)], 7, NOW), 500))

// ── Adherence / training days ──
const session = (status, daysAgo) => ({ id: 1, name: 'Push', dayType: 'push', exerciseIds: [], status, startedAt: NOW - daysAgo * DAY })
test('adherence: completed vs planned over 4 weeks', () => {
  const a = adherence([session('completed', 1), session('completed', 3), session('discarded', 2), session('completed', 40)], 5, 4, NOW)
  assert.equal(a.done, 2)
  assert.equal(a.planned, 20)
  assert.equal(a.pct, 10)
})
test('trainingDays: distinct completed days only', () => {
  const days = trainingDays([session('completed', 0), session('completed', 0), session('discarded', 1)])
  assert.equal(days.size, 1)
})

console.log(process.exitCode ? 'PROGRESS TESTS FAILED' : `PROGRESS ALL PASS (${passed} tests)`)
