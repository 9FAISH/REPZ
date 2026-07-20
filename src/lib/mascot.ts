import type { DayType } from '../db/types'

/** GYMBUDDY (Kilo) state model.
 *
 *  Art is swappable by design: every variant and reaction resolves through
 *  the maps below, so replacing a still with a sprite sheet or Lottie file
 *  means changing one entry — no component edits. Sprite sheets declare
 *  their frame count so the CSS animation matches. */

export type MascotReaction = 'idle' | 'pr' | 'goal-hit' | 'streak' | 'rest' | 'workout'

export interface MascotAsset {
  src: string
  /** >1 means a horizontal sprite sheet with this many frames. */
  frames: number
  /** Seconds for one full loop. */
  durationSec: number
}

import kiloPress from '../assets/mascot/kilo-press-sprite.webp'
import kiloRow from '../assets/mascot/kilo-row-sprite.webp'
import kiloVar0 from '../assets/mascot/kilo-var-0.webp'
import kiloVar1 from '../assets/mascot/kilo-var-1.webp'
import kiloVar2 from '../assets/mascot/kilo-var-2.webp'
import kiloVar3 from '../assets/mascot/kilo-var-3.webp'
import kiloVar4 from '../assets/mascot/kilo-var-4.webp'

const PRESS: MascotAsset = { src: kiloPress, frames: 5, durationSec: 1.5 }
const ROW: MascotAsset = { src: kiloRow, frames: 5, durationSec: 3 }
const STILL = (src: string): MascotAsset => ({ src, frames: 1, durationSec: 0 })

/** Day-type animation: push/pull/legs/etc. pick their movement loop.
 *  Placeholder mapping — swap in per-day art as it lands. */
export const DAY_TYPE_ASSET: Record<DayType, MascotAsset> = {
  push: PRESS,
  pull: ROW,
  legs: PRESS,
  upper: PRESS,
  lower: ROW,
  full: PRESS,
}

/** Reaction art, keyed by state. */
export const REACTION_ASSET: Record<MascotReaction, MascotAsset> = {
  idle: STILL(kiloVar0),
  pr: STILL(kiloVar1), // golden
  'goal-hit': STILL(kiloVar2), // neon
  streak: STILL(kiloVar3),
  rest: ROW,
  workout: PRESS,
}

// ── Collection / unlock rules ──

export interface MascotVariant {
  id: string
  name: string
  asset: MascotAsset
  requirement: string
  /** Evaluated against live stats to decide earned state. */
  isEarned: (stats: MascotStats) => boolean
}

export interface MascotStats {
  streakDays: number
  completedWorkouts: number
  prCount: number
  /** Net kg moved on the weight trend since the first weigh-in. */
  trendDeltaKg: number
  goalReached: boolean
}

export const MASCOT_VARIANTS: MascotVariant[] = [
  {
    id: 'og',
    name: 'OG Kilo',
    asset: STILL(kiloVar0),
    requirement: 'Day one. Ride or die.',
    isEarned: () => true,
  },
  {
    id: 'coach',
    name: 'Coach Kilo',
    asset: STILL(kiloVar3),
    requirement: '7-day streak',
    isEarned: (s) => s.streakDays >= 7,
  },
  {
    id: 'bulk',
    name: 'Bulk Szn',
    asset: STILL(kiloVar4),
    requirement: 'First +2 kg on trend',
    isEarned: (s) => s.trendDeltaKg >= 2,
  },
  {
    id: 'golden',
    name: 'Golden Kilo',
    asset: STILL(kiloVar1),
    requirement: '30-day streak',
    isEarned: (s) => s.streakDays >= 30,
  },
  {
    id: 'neon',
    name: 'Neon Kilo',
    asset: STILL(kiloVar2),
    requirement: 'Log 100 workouts',
    isEarned: (s) => s.completedWorkouts >= 100,
  },
  {
    id: 'shredded',
    name: 'Shredded Kilo',
    asset: STILL(kiloVar4),
    requirement: 'Hit your goal weight',
    isEarned: (s) => s.goalReached,
  },
]

/** Requirement text with live progress where it helps ("18 to go"). */
export function requirementLabel(v: MascotVariant, stats: MascotStats): string {
  if (v.isEarned(stats)) return v.requirement
  if (v.id === 'golden') return `30-day streak · ${30 - stats.streakDays} to go`
  if (v.id === 'neon') return `Log 100 workouts · ${100 - stats.completedWorkouts} to go`
  return v.requirement
}

/** Which reaction to show on the dashboard right now. */
export function pickReaction(stats: MascotStats, hasRecentPr: boolean): MascotReaction {
  if (hasRecentPr) return 'pr'
  if (stats.goalReached) return 'goal-hit'
  if (stats.streakDays >= 7) return 'streak'
  return 'idle'
}
