/** Local calendar date as 'YYYY-MM-DD' — the day key used across weigh-ins,
 *  nutrition entries and streaks. Pure (no app imports) so the engine layer
 *  stays runnable in plain Node for tests. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
