import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfile, foodForDay, latestWeighIn, logFood, deleteFood, todayKey } from '../../db/repo'
import { effectiveTargets } from '../../lib/nutrition'
import { getAdaptation, maybeAdapt } from '../../lib/nutritionStore'
import { useTodayKey } from '../../lib/useTodayKey'
import { LogFoodSheet } from './LogFoodSheet'
import './FoodScreen.css'

function yesterdayKey(today: string): string {
  // Parse component-wise: new Date('YYYY-MM-DD') would be UTC midnight and
  // shift a day in UTC-negative timezones.
  const [y, m, d] = today.split('-').map(Number)
  return todayKey(new Date(y, m - 1, d - 1))
}

const daysAgo = (ts: number) => {
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

const CAL_R = 58
const PRO_R = 42
const CAL_C = 2 * Math.PI * CAL_R
const PRO_C = 2 * Math.PI * PRO_R

export function FoodScreen() {
  const navigate = useNavigate()
  const dateKey = useTodayKey()
  const profile = useLiveQuery(getProfile)
  const entries = useLiveQuery(() => foodForDay(dateKey), [dateKey])
  const yesterday = useLiveQuery(() => foodForDay(yesterdayKey(dateKey)), [dateKey])
  const latest = useLiveQuery(latestWeighIn, [])
  const adaptation = useLiveQuery(getAdaptation, [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [armedDelete, setArmedDelete] = useState<number | null>(null)
  const [repeating, setRepeating] = useState(false)

  // Evaluate the rolling-average adaptation on visit (idempotent, 14-day gated).
  useEffect(() => {
    if (profile) void maybeAdapt(profile)
  }, [profile])

  useEffect(() => {
    if (armedDelete == null) return
    const t = setTimeout(() => setArmedDelete(null), 2500)
    return () => clearTimeout(t)
  }, [armedDelete])

  if (!profile || !entries) return null

  const weightNow = latest?.weightKg ?? profile.weightKg
  const targets = effectiveTargets(profile, weightNow, adaptation ?? undefined)
  const eaten = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, proteinG: a.proteinG + e.proteinG }), {
    kcal: 0,
    proteinG: 0,
  })
  const calPct = Math.min(1, eaten.kcal / targets.kcal)
  const proPct = Math.min(1, eaten.proteinG / targets.proteinG)

  const repeatYesterday = async () => {
    if (repeating) return
    setRepeating(true)
    try {
      for (const e of yesterday ?? []) {
        await logFood({ date: dateKey, name: e.name, kcal: e.kcal, proteinG: e.proteinG })
      }
    } finally {
      setRepeating(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-title food-title">Fuel</div>

      <section className="card-lg food-rings-card">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle cx="66" cy="66" r={CAL_R} fill="none" stroke="var(--elevated)" strokeWidth="10" />
          <circle
            cx="66" cy="66" r={CAL_R} fill="none" stroke="var(--accent)" strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${(calPct * CAL_C).toFixed(1)} ${CAL_C.toFixed(1)}`}
            transform="rotate(-90 66 66)"
          />
          <circle cx="66" cy="66" r={PRO_R} fill="none" stroke="var(--elevated)" strokeWidth="10" />
          <circle
            cx="66" cy="66" r={PRO_R} fill="none" stroke="var(--accent-bright)" strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${(proPct * PRO_C).toFixed(1)} ${PRO_C.toFixed(1)}`}
            transform="rotate(-90 66 66)"
          />
        </svg>
        <div className="food-legend">
          <div>
            <div className="food-legend-head">
              <div className="food-swatch" />
              <span className="food-legend-label">CALORIES</span>
            </div>
            <div className="food-legend-value numeral">
              {eaten.kcal.toLocaleString()}
              <span className="food-legend-target"> / {targets.kcal.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <div className="food-legend-head">
              <div className="food-swatch food-swatch-pro" />
              <span className="food-legend-label">PROTEIN</span>
            </div>
            <div className="food-legend-value numeral">
              {Math.round(eaten.proteinG)}
              <span className="food-legend-target"> / {targets.proteinG} g</span>
            </div>
          </div>
        </div>
      </section>

      {adaptation && adaptation.kcalDelta !== 0 && (
        <section className="food-adjust-card">
          <div className="food-adjust-head">
            <div className="food-adjust-badge">AUTO-ADJUSTED</div>
            <div className="food-adjust-when">{daysAgo(adaptation.adjustedAt)}</div>
          </div>
          <div className="food-adjust-text">
            {adaptation.direction === 'up' ? (
              <>
                Scale's been flat while bulking, so targets moved{' '}
                <b>+{Math.abs(adaptation.kcalDelta)} kcal</b>
                {adaptation.proteinDelta > 0 && (
                  <>
                    {' '}and <b>+{adaptation.proteinDelta} g protein</b>
                  </>
                )}
                . Keep weigh-ins coming — the math follows the trend, not one bad morning.
              </>
            ) : (
              <>
                The cut stalled on the rolling average, so calories moved{' '}
                <b>−{Math.abs(adaptation.kcalDelta)} kcal</b>. Keep weigh-ins coming — the math follows
                the trend, not one bad morning.
              </>
            )}
          </div>
          <button className="food-adjust-link" onClick={() => navigate('/progress')}>
            See the trend →
          </button>
        </section>
      )}

      <div className="food-actions">
        <button className="food-log-btn" onClick={() => setSheetOpen(true)}>
          + Log food
        </button>
        <button
          className="food-repeat-btn"
          disabled={!yesterday?.length || repeating}
          onClick={() => void repeatYesterday()}
        >
          Repeat yesterday
        </button>
      </div>

      {entries.length > 0 && (
        <section className="food-meals">
          {entries.map((e) => (
            <div key={e.id} className="food-meal-row">
              <div className="food-meal-main">
                <div className="food-meal-name">{e.name}</div>
                <div className="food-meal-when">
                  {new Date(e.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="food-meal-macros">
                <div className="food-meal-kcal numeral">{e.kcal} kcal</div>
                <div className="food-meal-pro">{e.proteinG} g protein</div>
              </div>
              <button
                className={`food-meal-delete${armedDelete === e.id ? ' food-meal-delete-armed' : ''}`}
                onClick={() => {
                  if (armedDelete === e.id) {
                    setArmedDelete(null)
                    void deleteFood(e.id!)
                  } else {
                    setArmedDelete(e.id!)
                  }
                }}
                aria-label={armedDelete === e.id ? `Confirm delete ${e.name}` : `Delete ${e.name}`}
              >
                {armedDelete === e.id ? 'Sure?' : '✕'}
              </button>
            </div>
          ))}
        </section>
      )}

      <div className="food-disclaimer">
        REPZ shares general fitness info, not medical advice. Calorie and protein targets are
        estimates — check with a professional before big diet changes.
      </div>

      {sheetOpen && <LogFoodSheet date={dateKey} onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
