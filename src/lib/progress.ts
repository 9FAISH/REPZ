import { todayKey } from './dates.ts'
import type { Exercise, SetLog, WorkoutSession } from '../db/types'

/** Progress analytics: estimated 1RM / PRs, weekly volume per muscle, and
 *  adherence. All pure so they're unit-testable outside the browser. */

/** Epley estimated 1RM. Bodyweight sets (0 kg) have no meaningful e1RM. */
export function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export interface PersonalRecord {
  exerciseId: string
  e1rm: number
  weightKg: number
  reps: number
  achievedAt: number
}

/** Best e1RM per exercise across all logged sets. */
export function personalRecords(sets: SetLog[]): Map<string, PersonalRecord> {
  const best = new Map<string, PersonalRecord>()
  for (const s of sets) {
    const est = e1rm(s.weightKg, s.reps)
    if (est <= 0) continue
    const cur = best.get(s.exerciseId)
    if (!cur || est > cur.e1rm) {
      best.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        e1rm: est,
        weightKg: s.weightKg,
        reps: s.reps,
        achievedAt: s.loggedAt,
      })
    }
  }
  return best
}

/** e1RM over time for one lift — chart series, chronological. */
export function e1rmSeries(sets: SetLog[], exerciseId: string): { at: number; e1rm: number }[] {
  return sets
    .filter((s) => s.exerciseId === exerciseId && s.weightKg > 0)
    .sort((a, b) => a.loggedAt - b.loggedAt)
    .map((s) => ({ at: s.loggedAt, e1rm: e1rm(s.weightKg, s.reps) }))
}

/** Did this set beat the best e1RM that came before it? */
export function isPrSet(sets: SetLog[], candidate: SetLog): boolean {
  const est = e1rm(candidate.weightKg, candidate.reps)
  if (est <= 0) return false
  const prior = sets.filter(
    (s) => s.exerciseId === candidate.exerciseId && s.loggedAt < candidate.loggedAt,
  )
  return prior.every((s) => e1rm(s.weightKg, s.reps) < est)
}

/** Sets per target muscle over the last N days — weekly volume, counted the
 *  way lifters program it (hard sets per muscle, not tonnage). */
export function weeklyVolume(
  sets: SetLog[],
  exercises: Map<string, Exercise>,
  days = 7,
  now: number = Date.now(),
): { muscle: string; sets: number }[] {
  const cutoff = now - days * 86_400_000
  const counts = new Map<string, number>()
  for (const s of sets) {
    if (s.loggedAt < cutoff) continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.targetMuscles) counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([muscle, count]) => ({ muscle, sets: count }))
    .sort((a, b) => b.sets - a.sets)
}

/** Total tonnage (kg × reps) over a window — a secondary workload stat. */
export function tonnage(sets: SetLog[], days = 7, now: number = Date.now()): number {
  const cutoff = now - days * 86_400_000
  return Math.round(
    sets.filter((s) => s.loggedAt >= cutoff).reduce((sum, s) => sum + s.weightKg * s.reps, 0),
  )
}

/** Completed sessions per week vs the plan, over the last N weeks. */
export function adherence(
  sessions: WorkoutSession[],
  daysPerWeek: number,
  weeks = 4,
  now: number = Date.now(),
): { done: number; planned: number; pct: number } {
  const cutoff = now - weeks * 7 * 86_400_000
  const done = sessions.filter((s) => s.status === 'completed' && s.startedAt >= cutoff).length
  const planned = daysPerWeek * weeks
  return { done, planned, pct: planned > 0 ? Math.round((done / planned) * 100) : 0 }
}

/** Distinct days that had a completed workout (for the training calendar). */
export function trainingDays(sessions: WorkoutSession[]): Set<string> {
  const days = new Set<string>()
  for (const s of sessions) {
    if (s.status === 'completed') days.add(todayKey(new Date(s.startedAt)))
  }
  return days
}
