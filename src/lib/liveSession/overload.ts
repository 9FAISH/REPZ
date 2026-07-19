import type { Effort } from '../../db/types'

/** Progressive-overload suggestion from the previous session's sets of the
 *  same exercise. Pure logic — shared by the live screen and (later) any
 *  native layer. */

export interface SetRecord {
  weightKg: number
  reps: number
  effort: Effort
}

export interface OverloadSuggestion {
  action: 'add_weight' | 'add_reps' | 'hold'
  /** Suggested working weight for this session. */
  weightKg: number
  /** Suggested rep target for this session. */
  reps: number
  note: string
}

const WEIGHT_INCREMENT_KG = 2.5

export function suggestNext(prev: SetRecord[]): OverloadSuggestion | null {
  if (prev.length === 0) return null
  const top = prev.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))
  // Rep target must come from sets AT the top weight — mixing in rep counts
  // from lighter back-off sets would pair a weight with reps never done at it.
  const bestReps = Math.max(...prev.filter((s) => s.weightKg === top.weightKg).map((s) => s.reps))

  // Any grinder set → consolidate before pushing.
  if (prev.some((s) => s.effort === 'barely')) {
    return {
      action: 'hold',
      weightKg: top.weightKg,
      reps: bestReps,
      note: `Hold ${top.weightKg > 0 ? `${top.weightKg} kg` : 'it'} — own ${bestReps} clean reps first`,
    }
  }

  // Everything easy → add load (or reps when bodyweight).
  if (prev.every((s) => s.effort === 'more')) {
    if (top.weightKg > 0) {
      const next = top.weightKg + WEIGHT_INCREMENT_KG
      return { action: 'add_weight', weightKg: next, reps: top.reps, note: `Had more in the tank — try ${next} kg` }
    }
    return { action: 'add_reps', weightKg: 0, reps: bestReps + 2, note: `Too easy — go for ${bestReps + 2} reps` }
  }

  // Solid work → one more rep.
  return { action: 'add_reps', weightKg: top.weightKg, reps: bestReps + 1, note: `Solid last time — chase ${bestReps + 1} reps` }
}
