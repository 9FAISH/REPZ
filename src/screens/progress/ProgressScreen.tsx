import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfile, listWeighIns } from '../../db/repo'
import { weightTrendKgPerWeek, onPace } from '../../lib/stats'
import { chartPoints, CHART_W, CHART_H } from '../../lib/chart'
import { WeighInSheet } from './WeighInSheet'
import './ProgressScreen.css'

export function ProgressScreen() {
  const profile = useLiveQuery(getProfile)
  const weighIns = useLiveQuery(listWeighIns, [])
  const [sheetOpen, setSheetOpen] = useState(false)

  const chart = useMemo(() => (weighIns ? chartPoints(weighIns) : null), [weighIns])

  if (!profile || !weighIns) return null

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

      {sheetOpen && (
        <WeighInSheet startKg={current} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
