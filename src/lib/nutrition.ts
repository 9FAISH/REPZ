import { todayKey } from './dates.ts'
import { weightTrendKgPerWeek } from './stats.ts'
import type { Profile, WeighIn } from '../db/types'

/** Nutrition engine: Mifflin-St Jeor TDEE × activity factor, goal-based
 *  surplus/deficit, protein at 1.6–2.2 g/kg, and slow adaptive corrections
 *  driven by the ROLLING AVERAGE of weigh-ins (never single days).
 *
 *  Plain language: this is general fitness math, not medical advice —
 *  the numbers are estimates to steer by. */

const ACTIVITY_FACTORS: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** kcal/day surplus ≈ +0.25 kg/wk; deficit ≈ −0.5 kg/wk (7700 kcal/kg). */
const GOAL_OFFSET_KCAL: Record<Profile['goal'], number> = {
  bulk: 275,
  cut: -550,
}

const PROTEIN_PER_KG: Record<Profile['goal'], number> = {
  bulk: 1.8,
  cut: 2.2, // high end of the 1.6–2.2 band spares muscle in a deficit
}

export function mifflinStJeorBMR(p: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * p.heightCm - 5 * p.age
  return Math.round(base + (p.sex === 'male' ? 5 : -161))
}

export function baseTargets(profile: Profile, currentWeightKg: number): { kcal: number; proteinG: number } {
  const tdee = mifflinStJeorBMR(profile, currentWeightKg) * ACTIVITY_FACTORS[profile.activityLevel]
  const kcal = Math.round((tdee + GOAL_OFFSET_KCAL[profile.goal]) / 10) * 10
  const proteinG = Math.round(currentWeightKg * PROTEIN_PER_KG[profile.goal])
  return { kcal, proteinG }
}

// ── Adaptive corrections ──

export interface Adaptation {
  /** Cumulative kcal correction applied on top of the base target. */
  kcalDelta: number
  proteinDelta: number
  adjustedAt: number
  direction: 'up' | 'down'
}

export const ADAPT_KEY = 'nutrition.adaptation'
const STEP_KCAL = 150
const STEP_PROTEIN = 5
const MAX_STEPS = 3 // safety cap: never drift more than ±450 kcal from base
const COOLDOWN_DAYS = 14
/** Bulk trend below this is "flat"; cut trend above this is "stalled". */
const BULK_STALL_BELOW = 0.05
const CUT_STALL_ABOVE = -0.1

/** Trend over roughly the last two weeks of weigh-ins. */
function recentTrend(weighIns: WeighIn[], now: number): number | null {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 16)
  const key = todayKey(cutoff)
  return weightTrendKgPerWeek(weighIns.filter((w) => w.date >= key))
}

/** Pure decision: returns the NEW adaptation to store, or null for no
 *  change. At most one ±150 kcal step per 14-day window, driven by the
 *  rolling-average trend — never single-day readings. */
export function decideAdaptation(
  goal: Profile['goal'],
  weighIns: WeighIn[],
  current: Adaptation | undefined,
  now: number = Date.now(),
): Adaptation | null {
  if (weighIns.length < 8) return null
  const cur = current ?? { kcalDelta: 0, proteinDelta: 0, adjustedAt: 0, direction: 'up' as const }
  if ((now - cur.adjustedAt) / 86_400_000 < COOLDOWN_DAYS) return null

  // Also require two weeks of history before the FIRST adjustment.
  const firstDate = new Date(weighIns[0].date).getTime()
  if ((now - firstDate) / 86_400_000 < COOLDOWN_DAYS) return null

  const trend = recentTrend(weighIns, now)
  if (trend == null) return null

  let step = 0
  if (goal === 'bulk' && trend < BULK_STALL_BELOW) step = 1
  if (goal === 'cut' && trend > CUT_STALL_ABOVE) step = -1
  if (step === 0) return null

  const steps = Math.round(cur.kcalDelta / STEP_KCAL) + step
  if (Math.abs(steps) > MAX_STEPS) return null

  return {
    kcalDelta: cur.kcalDelta + step * STEP_KCAL,
    proteinDelta: cur.proteinDelta + (step > 0 ? STEP_PROTEIN : 0),
    adjustedAt: now,
    direction: step > 0 ? 'up' : 'down',
  }
}


/** Base targets + any adaptive correction. */
export function effectiveTargets(
  profile: Profile,
  currentWeightKg: number,
  adaptation: Adaptation | undefined,
): { kcal: number; proteinG: number } {
  const base = baseTargets(profile, currentWeightKg)
  return {
    kcal: base.kcal + (adaptation?.kcalDelta ?? 0),
    proteinG: base.proteinG + (adaptation?.proteinDelta ?? 0),
  }
}
