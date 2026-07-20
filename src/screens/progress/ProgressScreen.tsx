import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getProfile, listWeighIns } from '../../db/repo'
import { weightTrendKgPerWeek, onPace } from '../../lib/stats'
import { chartPoints, CHART_W, CHART_H } from '../../lib/chart'
import { personalRecords, weeklyVolume, adherence, tonnage } from '../../lib/progress'
import { sentenceCase } from '../../lib/format'
import { KiloSprite } from '../../components/KiloHero'
import { MASCOT_VARIANTS } from '../../lib/mascot'
import { useMascotStats } from '../../lib/useMascotStats'
import { BackupCard } from './BackupCard'
import { WeighInSheet } from './WeighInSheet'
import type { Exercise } from '../../db/types'
import './ProgressScreen.css'

export function ProgressScreen() {
  const navigate = useNavigate()
  const profile = useLiveQuery(getProfile)
  const weighIns = useLiveQuery(listWeighIns, [])
  const sets = useLiveQuery(() => db.setLogs.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const catalog = useLiveQuery(() => db.exercises.toArray(), [])
  const mascotStats = useMascotStats()
  const [sheetOpen, setSheetOpen] = useState(false)

  const chart = useMemo(() => (weighIns ? chartPoints(weighIns) : null), [weighIns])
  const byId = useMemo(() => {
    const m = new Map<string, Exercise>()
    catalog?.forEach((e) => m.set(e.exerciseId, e))
    return m
  }, [catalog])
  const volume = useMemo(
    () => (sets && catalog ? weeklyVolume(sets, byId).slice(0, 6) : []),
    [sets, catalog, byId],
  )

  if (!profile || !weighIns || !sets || !sessions || !catalog) return null

  const prCount = personalRecords(sets).size
  const weekTonnage = tonnage(sets)
  const adh = adherence(sessions, profile.daysPerWeek)
  const maxVolume = Math.max(1, ...volume.map((v) => v.sets))
  const earnedVariants = mascotStats
    ? MASCOT_VARIANTS.filter((v) => v.isEarned(mascotStats)).length
    : 0

  const current = weighIns[weighIns.length - 1]?.weightKg ?? profile.weightKg
  const trend = weightTrendKgPerWeek(weighIns)
  const paced = onPace(trend, profile.goal)

  return (
    <div className="screen">
      <div className="screen-title progress-title">Trend</div>

      <div className="progress-current">
        <div className="progress-weight numeral">
          {current.toFixed(1)}
          <span className="progress-weight-unit"> kg</span>
        </div>
        {trend != null && (
          <div className={`progress-pill${paced ? '' : ' progress-pill-muted'}`}>
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(2)} kg/wk{paced ? ' · on pace' : ''}
          </div>
        )}
      </div>

      {chart ? (
        <section className="card-lg progress-chart-card">
          <svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
            {[42, 85, 128].map((y) => (
              <line key={y} x1="0" y1={y} x2={CHART_W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            <polyline points={chart.rawPts} fill="none" stroke="rgba(139,147,160,0.45)" strokeWidth="1.5" />
            <polyline
              points={chart.avgPts}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="progress-legend">
            <div className="progress-legend-item">
              <div className="progress-legend-avg" />
              <span>7-day rolling avg</span>
            </div>
            <div className="progress-legend-item">
              <div className="progress-legend-raw" />
              <span>daily weigh-ins</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="card progress-empty">
          Two weigh-ins get you a chart; a couple of weeks gets you a trend. Scale first thing in the
          morning works best.
        </section>
      )}

      <button className="btn-primary" onClick={() => setSheetOpen(true)}>
        Log today's weigh-in
      </button>

      <div className="progress-note">
        Daily scale noise is ignored — targets only move when the <b>rolling average</b> stalls or runs
        too hot for 2 weeks.
      </div>

      {/* ── Training stats ── */}
      <div className="progress-stat-row">
        <button className="progress-stat" onClick={() => navigate('/progress/records')}>
          <div className="section-label">PRS</div>
          <div className="progress-stat-value numeral">{prCount}</div>
          <div className="progress-stat-note">best e1RM per lift →</div>
        </button>
        <div className="progress-stat">
          <div className="section-label">ADHERENCE</div>
          <div className="progress-stat-value numeral">{adh.pct}%</div>
          <div className="progress-stat-note">
            {adh.done}/{adh.planned} sessions · 4 wk
          </div>
        </div>
      </div>

      <section className="card progress-volume">
        <div className="progress-volume-head">
          <div className="section-label">WEEKLY VOLUME</div>
          <div className="progress-volume-tonnage numeral">
            {weekTonnage.toLocaleString()} kg moved
          </div>
        </div>
        {volume.length === 0 ? (
          <div className="progress-volume-empty">
            No sets logged in the last 7 days — your per-muscle volume shows up here.
          </div>
        ) : (
          <div className="progress-volume-list">
            {volume.map((v) => (
              <div key={v.muscle} className="progress-volume-row">
                <div className="progress-volume-name">{sentenceCase(v.muscle)}</div>
                <div className="progress-volume-track">
                  <div
                    className="progress-volume-fill"
                    style={{ width: `${(v.sets / maxVolume) * 100}%` }}
                  />
                </div>
                <div className="progress-volume-count numeral">{v.sets}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Kilo shelf ── */}
      <button className="progress-shelf" onClick={() => navigate('/progress/shelf')}>
        <KiloSprite asset={MASCOT_VARIANTS[0].asset} height={52} />
        <div className="progress-shelf-main">
          <div className="progress-shelf-title">Kilo collection</div>
          <div className="progress-shelf-meta">
            {earnedVariants} of {MASCOT_VARIANTS.length} variants earned
          </div>
        </div>
        <div className="progress-shelf-arrow">→</div>
      </button>

      <BackupCard />

      {sheetOpen && (
        <WeighInSheet startKg={current} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
