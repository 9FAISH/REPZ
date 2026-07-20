import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfile, dayTotals, listWeighIns, activityDates, getDraft } from '../db/repo'
import { SLOT_DEFS } from '../lib/slots'
import {
  weightTrendKgPerWeek,
  onPace,
  currentStreak,
  todayDayType,
  DAY_TYPE_LABELS,
} from '../lib/stats'
import { effectiveTargets } from '../lib/nutrition'
import { getAdaptation } from '../lib/nutritionStore'
import { KiloHero } from '../components/KiloHero'
import { useTodayKey } from '../lib/useTodayKey'
import type { DayType } from '../db/types'
import './HomeScreen.css'

function todayLine(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .replace(',', ' ·')
}

function greetingWord(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

const DAY_SPEECH: Record<DayType, string> = {
  push: 'Push day — let’s eat.',
  pull: 'Pull day. Row like you mean it.',
  legs: 'Leg day. No skipping.',
  upper: 'Upper day. Full send up top.',
  lower: 'Lower day. Squats are calling.',
  full: 'Full body. Everything works today.',
}

function kiloSpeech(dayType: DayType | null, streak: number): string {
  const daily = dayType ? DAY_SPEECH[dayType] : 'Rest day. Growth happens now.'
  return streak >= 2 ? `${streak} days straight. ${daily}` : daily
}

export function HomeScreen() {
  const navigate = useNavigate()
  const dateKey = useTodayKey()
  const profile = useLiveQuery(getProfile)
  const totals = useLiveQuery(() => dayTotals(dateKey), [dateKey])
  const weighIns = useLiveQuery(listWeighIns, [])
  const activity = useLiveQuery(activityDates, [])
  const adaptation = useLiveQuery(getAdaptation, [])
  const dayTypeForDraft = profile ? todayDayType(profile.split) : null
  const draft = useLiveQuery(
    async () => (dayTypeForDraft ? ((await getDraft(dayTypeForDraft)) ?? null) : null),
    [dayTypeForDraft],
  )

  if (!profile) return null // AppShell guard redirects when there's no profile

  const streak = activity ? currentStreak(activity) : 0
  const dayType = dayTypeForDraft
  const currentWeight = weighIns?.length ? weighIns[weighIns.length - 1].weightKg : profile.weightKg
  const proteinTarget = effectiveTargets(profile, currentWeight, adaptation ?? undefined).proteinG
  const proteinEaten = Math.round(totals?.proteinG ?? 0)
  const proteinPct = Math.min(100, Math.round((proteinEaten / proteinTarget) * 100))
  const trend = weighIns ? weightTrendKgPerWeek(weighIns) : null
  const paced = onPace(trend, profile.goal)

  return (
    <div className="screen">
      <header className="home-header">
        <div>
          <div className="home-date">{todayLine()}</div>
          <div className="home-greeting">
            {greetingWord()}
            {profile.name ? `, ${profile.name}.` : '.'}
          </div>
        </div>
        {streak >= 2 && <div className="pill-accent">{streak}-DAY STREAK</div>}
      </header>

      <KiloHero speech={kiloSpeech(dayType, streak)} />

      {dayType ? (
        <section className="home-workout-card">
          <div className="home-workout-top">
            <div className="home-workout-label">TODAY · {DAY_TYPE_LABELS[dayType].toUpperCase()}</div>
            <div className="home-workout-time">{profile.daysPerWeek} days/wk</div>
          </div>
          <div className="home-workout-count">
            {draft?.filter((s) => s.exerciseId).length ?? 0} of {SLOT_DEFS[dayType].length} slots filled
          </div>
          <div className="home-slotbar">
            {SLOT_DEFS[dayType].map((_, i) => (
              <div
                key={i}
                className={`home-slotseg${draft?.[i]?.exerciseId ? ' home-slotseg-filled' : ''}`}
              />
            ))}
          </div>
          <div className="home-workout-actions">
            {draft?.some((s) => s.exerciseId) ? (
              <>
                <button className="btn-primary home-start" onClick={() => navigate('/train/live')}>
                  Start workout
                </button>
                <button className="btn-secondary home-edit" onClick={() => navigate('/train')}>
                  Edit slots
                </button>
              </>
            ) : (
              <button className="btn-primary home-start" onClick={() => navigate('/train')}>
                Build workout
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="home-rest-card">
          <div className="home-workout-label home-rest-label">REST DAY</div>
          <div className="home-rest-text">
            Recovery is where the growth happens. Eat your protein, get your steps in.
          </div>
        </section>
      )}

      <section className="home-stats">
        <button className="home-stat-card" onClick={() => navigate('/food')}>
          <div className="section-label">PROTEIN</div>
          <div className="home-stat-value numeral">
            {proteinEaten}
            <span className="home-stat-unit"> / {proteinTarget} g</span>
          </div>
          <div className="home-protein-track">
            <div className="home-protein-fill" style={{ width: `${proteinPct}%` }} />
          </div>
        </button>
        <button className="home-stat-card" onClick={() => navigate('/progress')}>
          <div className="section-label">WEIGHT TREND</div>
          {trend != null ? (
            <>
              <div className="home-stat-value numeral">
                {Math.abs(trend) < 0.005 ? '0.00' : `${trend > 0 ? '+' : ''}${trend.toFixed(2)}`}
                <span className="home-stat-unit"> kg/wk</span>
              </div>
              <div className={`home-stat-note${paced ? '' : ' home-stat-note-muted'}`}>
                {paced
                  ? `On pace for the ${profile.goal} ↗`
                  : Math.abs(trend) <= 0.02
                    ? 'Holding steady'
                    : 'Drifting off pace'}
              </div>
            </>
          ) : (
            <>
              <div className="home-stat-value numeral">
                {weighIns?.length ? weighIns[weighIns.length - 1].weightKg.toFixed(1) : profile.weightKg.toFixed(1)}
                <span className="home-stat-unit"> kg</span>
              </div>
              <div className="home-stat-note home-stat-note-muted">Log daily weigh-ins for a trend</div>
            </>
          )}
        </button>
      </section>
    </div>
  )
}
