import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { personalRecords, e1rmSeries } from '../../lib/progress'
import type { Exercise } from '../../db/types'
import './RecordsScreen.css'

const W = 320
const H = 120
const PAD = 10

function sparkPoints(series: { at: number; e1rm: number }[]): string | null {
  if (series.length < 2) return null
  const vals = series.map((p) => p.e1rm)
  const mn = Math.min(...vals) - 1
  const mx = Math.max(...vals) + 1
  return series
    .map((p, i) => {
      const x = PAD + (i / (series.length - 1)) * (W - 2 * PAD)
      const y = H - PAD - ((p.e1rm - mn) / (mx - mn)) * (H - 2 * PAD)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function RecordsScreen() {
  const navigate = useNavigate()
  const sets = useLiveQuery(() => db.setLogs.toArray(), [])
  const catalog = useLiveQuery(() => db.exercises.toArray(), [])
  const [openId, setOpenId] = useState<string | null>(null)

  const byId = useMemo(() => {
    const m = new Map<string, Exercise>()
    catalog?.forEach((e) => m.set(e.exerciseId, e))
    return m
  }, [catalog])

  const prs = useMemo(() => (sets ? [...personalRecords(sets).values()] : []), [sets])
  const sorted = useMemo(() => [...prs].sort((a, b) => b.e1rm - a.e1rm), [prs])

  if (!sets || !catalog) return null

  return (
    <div className="screen">
      <button className="chip records-back" onClick={() => navigate('/progress')}>
        ← Progress
      </button>
      <div className="screen-title">Personal records</div>
      <div className="records-sub">
        Best estimated 1-rep max per lift (Epley). Bodyweight work isn't ranked here.
      </div>

      {sorted.length === 0 ? (
        <div className="card records-empty">
          No weighted sets yet. Log a few and your bests show up here with progress charts.
        </div>
      ) : (
        <div className="records-list">
          {sorted.map((pr) => {
            const ex = byId.get(pr.exerciseId)
            const open = openId === pr.exerciseId
            const pts = open ? sparkPoints(e1rmSeries(sets, pr.exerciseId)) : null
            return (
              <div key={pr.exerciseId} className="records-row">
                <button
                  className="records-main"
                  onClick={() => setOpenId(open ? null : pr.exerciseId)}
                >
                  <div className="records-name">{ex?.name ?? 'Unknown lift'}</div>
                  <div className="records-meta">
                    {pr.weightKg} kg × {pr.reps} ·{' '}
                    {new Date(pr.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </button>
                <div className="records-e1rm numeral">
                  {pr.e1rm}
                  <span className="records-unit"> kg</span>
                </div>
                {open && (
                  <div className="records-chart">
                    {pts ? (
                      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                        <polyline
                          points={pts}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <div className="records-chart-empty">One data point so far — keep logging.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
