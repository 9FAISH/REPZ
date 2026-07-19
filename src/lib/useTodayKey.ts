import { useEffect, useState } from 'react'
import { todayKey } from '../db/repo'

/** Reactive 'YYYY-MM-DD' for the current local day. Updates at midnight and
 *  whenever the app becomes visible again — an installed iPhone PWA can sit
 *  in the app switcher for days, and day-scoped queries must not stay stale. */
export function useTodayKey(): string {
  const [key, setKey] = useState(todayKey)
  useEffect(() => {
    const refresh = () => setKey(todayKey())
    document.addEventListener('visibilitychange', refresh)
    const midnight = new Date()
    midnight.setHours(24, 0, 5, 0) // a few seconds past 00:00 to be safe
    const timer = setTimeout(refresh, midnight.getTime() - Date.now())
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearTimeout(timer)
    }
  }, [key])
  return key
}
