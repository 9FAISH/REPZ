import type { WeighIn } from '../db/types'

/** Weight-trend chart geometry per the design: raw daily polyline (muted)
 *  + 7-day rolling average (accent) over the recent window. Pure — the
 *  screen only renders the returned point strings. */
export const CHART_W = 320
export const CHART_H = 170
const CHART_DAYS = 30
const PAD_X = 8
const TOP = 15
const BOTTOM = 160

export function chartPoints(weighIns: WeighIn[]): { rawPts: string; avgPts: string } | null {
  const recent = weighIns.slice(-CHART_DAYS)
  if (recent.length < 2) return null
  const values = recent.map((w) => w.weightKg)
  // Rolling average draws on the full history so early chart points still
  // average over their preceding days.
  const all = weighIns.map((w) => w.weightKg)
  const offset = weighIns.length - recent.length
  const avg = recent.map((_, i) => {
    const slice = all.slice(Math.max(0, offset + i - 6), offset + i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
  const mn = Math.min(...values, ...avg) - 0.15
  const mx = Math.max(...values, ...avg) + 0.15
  const X = (i: number) => PAD_X + (i / (recent.length - 1)) * (CHART_W - 2 * PAD_X)
  const Y = (v: number) => BOTTOM - ((v - mn) / (mx - mn)) * (BOTTOM - TOP)
  const pts = (arr: number[]) => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return { rawPts: pts(values), avgPts: pts(avg) }
}
