import type { Profile, WeighIn, DayType, Goal } from '../db/types'

/** Dashboard-level derived stats. Calorie/protein targets live in
 *  src/lib/nutrition.ts (the Phase 5 engine). */

/** Weight trend in kg/week: 7-day rolling average now vs one week earlier.
 *  The rate divides the change between the two window averages by the gap
 *  between the windows' MEAN dates (7 days for contiguous daily data) —
 *  dividing by the first-to-last span would understate the rate by ~half.
 *  Returns null until there's enough history (≥8 daily points). */
export function weightTrendKgPerWeek(weighIns: WeighIn[]): number | null {
  if (weighIns.length < 8) return null
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1))
  const avg = (arr: WeighIn[]) => arr.reduce((s, w) => s + w.weightKg, 0) / arr.length
  const meanTime = (arr: WeighIn[]) =>
    arr.reduce((s, w) => s + new Date(w.date).getTime(), 0) / arr.length
  const last7 = sorted.slice(-7)
  const prev7 = sorted.slice(-14, -7)
  if (prev7.length === 0) return null
  const gapDays = (meanTime(last7) - meanTime(prev7)) / 86_400_000
  if (gapDays < 3) return null
  return ((avg(last7) - avg(prev7)) / gapDays) * 7
}

/** Is the current trend consistent with the goal? (bulk wants +, cut wants −)
 *  A small epsilon keeps scale noise around zero from flapping the verdict. */
export function onPace(trend: number | null, goal: Goal): boolean | null {
  if (trend == null) return null
  const EPS = 0.02
  return goal === 'bulk' ? trend > EPS : trend < -EPS
}

/** Consecutive-day activity streak. `activityDates` are 'YYYY-MM-DD' strings
 *  from any logged activity (sets, weigh-ins, food). Counts back from today,
 *  tolerating a still-unlogged today. */
export function currentStreak(activityDates: Iterable<string>, today: Date = new Date()): number {
  const days = new Set(activityDates)
  let streak = 0
  const cursor = new Date(today)
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1) // today not logged yet is fine
  while (days.has(key(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** v1 weekly schedule per split (Mon-first). Phase 3's builder attaches
 *  actual slot templates to these day types. */
const SCHEDULES: Record<Profile['split'], (DayType | null)[]> = {
  // Mon        Tue      Wed      Thu      Fri      Sat      Sun
  full_body: ['full', null, 'full', null, 'full', null, null],
  upper_lower: ['upper', 'lower', null, 'upper', 'lower', null, null],
  ppl: ['push', 'pull', 'legs', null, 'push', 'pull', null],
}

export function todayDayType(split: Profile['split'], date: Date = new Date()): DayType | null {
  const monFirst = (date.getDay() + 6) % 7
  return SCHEDULES[split][monFirst]
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  full: 'Full Body',
  upper: 'Upper',
  lower: 'Lower',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
}
