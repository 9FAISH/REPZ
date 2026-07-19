// Unit tests for the isolated live-session modules (pure logic, no browser).
// Runs the TS sources directly via Node's native type stripping.
import { strict as assert } from 'node:assert'
import { suggestNext } from '../src/lib/liveSession/overload.ts'
import { platesPerSide } from '../src/lib/liveSession/plates.ts'
import { RestTimer, formatRest } from '../src/lib/liveSession/restTimer.ts'

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

// ── overload ──
const set = (weightKg, reps, effort) => ({ weightKg, reps, effort })
test('overload: no history → null', () => assert.equal(suggestNext([]), null))
test('overload: any barely → hold', () => {
  const s = suggestNext([set(50, 10, 'more'), set(50, 9, 'barely')])
  assert.equal(s.action, 'hold')
  assert.equal(s.weightKg, 50)
})
test('overload: all easy → +2.5 kg', () => {
  const s = suggestNext([set(50, 10, 'more'), set(50, 10, 'more'), set(50, 10, 'more')])
  assert.equal(s.action, 'add_weight')
  assert.equal(s.weightKg, 52.5)
})
test('overload: bodyweight all easy → +2 reps', () => {
  const s = suggestNext([set(0, 12, 'more'), set(0, 11, 'more')])
  assert.equal(s.action, 'add_reps')
  assert.equal(s.reps, 14)
})
test('overload: solid work → +1 rep at same weight', () => {
  const s = suggestNext([set(50, 10, 'solid'), set(50, 9, 'more')])
  assert.equal(s.action, 'add_reps')
  assert.equal(s.weightKg, 50)
  assert.equal(s.reps, 11)
})
test('overload: mixed weights → rep target from the top-weight sets only', () => {
  const s = suggestNext([set(40, 12, 'solid'), set(50, 8, 'solid')])
  assert.equal(s.weightKg, 50)
  assert.equal(s.reps, 9) // not 13 (the 12 reps happened at 40 kg)
})

// ── plates ──
test('plates: 60 on 20 bar → one 20/side', () =>
  assert.deepEqual(platesPerSide(60, 20), { plates: [20], leftoverKg: 0 }))
test('plates: 100 on 20 bar → 25+15/side', () =>
  assert.deepEqual(platesPerSide(100, 20).plates, [25, 15]))
test('plates: 57.5 on 20 bar → 15+2.5+1.25/side exact', () =>
  assert.deepEqual(platesPerSide(57.5, 20), { plates: [15, 2.5, 1.25], leftoverKg: 0 }))
test('plates: 21 on 20 bar → 0.5 leftover', () => {
  const r = platesPerSide(21, 20)
  assert.deepEqual(r.plates, [])
  assert.ok(Math.abs(r.leftoverKg - 0.5) < 1e-9)
})
test('plates: at/below bar → empty', () => {
  assert.deepEqual(platesPerSide(20, 20).plates, [])
  assert.deepEqual(platesPerSide(0, 20).plates, [])
})

// ── rest timer ──
test('formatRest', () => {
  assert.equal(formatRest(120), '2:00')
  assert.equal(formatRest(65), '1:05')
  assert.equal(formatRest(0), '0:00')
})

const timer = new RestTimer()
const events = []
timer.subscribe((state, event) => events.push({ event, remaining: state.remainingSec }))
timer.start(2)
assert.equal(timer.state.running, true)
assert.equal(timer.state.remainingSec, 2)
timer.extend(1)
assert.equal(timer.state.totalSec, 3)

await new Promise((r) => setTimeout(r, 3400))
test('timer: done fired and stopped', () => {
  assert.equal(events.at(-1).event, 'done')
  assert.equal(timer.state.running, false)
  assert.equal(timer.state.remainingSec, 0)
})
test('timer: skip is a no-op when stopped', () => {
  timer.skip()
  assert.equal(events.at(-1).event, 'done')
})
timer.start(60)
timer.skip()
test('timer: skip stops a running timer', () => {
  assert.equal(events.at(-1).event, 'skip')
  assert.equal(timer.state.running, false)
})
timer.dispose()

console.log(process.exitCode ? 'LIVESESSION TESTS FAILED' : `LIVESESSION ALL PASS (${passed} tests)`)
