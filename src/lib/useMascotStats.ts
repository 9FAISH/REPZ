import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activityDates, getProfile, listWeighIns } from '../db/repo'
import { currentStreak } from './stats.ts'
import { personalRecords } from './progress.ts'
import type { MascotStats } from './mascot.ts'

/** Live mascot stats — the single source the mascot hooks read from. */
export function useMascotStats(): MascotStats | undefined {
  const profile = useLiveQuery(getProfile)
  const activity = useLiveQuery(activityDates, [])
  const weighIns = useLiveQuery(listWeighIns, [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const sets = useLiveQuery(() => db.setLogs.toArray(), [])

  if (!profile || !activity || !weighIns || !sessions || !sets) return undefined

  const first = weighIns[0]?.weightKg ?? profile.weightKg
  const latest = weighIns[weighIns.length - 1]?.weightKg ?? profile.weightKg
  const delta = latest - first

  return {
    streakDays: currentStreak(activity),
    completedWorkouts: sessions.filter((s) => s.status === 'completed').length,
    prCount: personalRecords(sets).size,
    trendDeltaKg: profile.goal === 'bulk' ? delta : -delta,
    // No explicit goal weight in the profile yet — treat a solid move in the
    // intended direction as "goal hit" for now.
    goalReached: (profile.goal === 'bulk' ? delta : -delta) >= 5,
  }
}
