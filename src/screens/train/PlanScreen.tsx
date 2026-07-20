import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfile, getWeeklyPlan, saveWeeklyPlan } from '../../db/repo'
import { DAY_TYPE_LABELS, WEEKDAY_LABELS, planFor, weekdayIndex } from '../../lib/stats'
import type { DayType } from '../../db/types'
import './PlanScreen.css'

const CHOICES: (DayType | null)[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full', null]

const label = (d: DayType | null) => (d ? DAY_TYPE_LABELS[d] : 'Rest')

export function PlanScreen() {
  const navigate = useNavigate()
  const profile = useLiveQuery(getProfile)
  const stored = useLiveQuery(getWeeklyPlan, [])

  if (!profile || stored === undefined) return null

  const plan = planFor(stored ?? undefined, profile.split)
  const today = weekdayIndex()

  const setDay = (weekday: number, dayType: DayType | null) => {
    const next = [...plan]
    next[weekday] = dayType
    void saveWeeklyPlan(next)
  }

  return (
    <div className="screen">
      <button className="chip plan-back" onClick={() => navigate('/train')}>
        ← Builder
      </button>
      <div className="screen-title">Weekly plan</div>
      <div className="plan-sub">
        Set what each day is. Rest days show a recovery card instead of a workout.
      </div>

      <div className="plan-days">
        {WEEKDAY_LABELS.map((name, i) => (
          <section key={name} className={`plan-day${i === today ? ' plan-day-today' : ''}`}>
            <div className="plan-day-head">
              <div className="plan-day-name">
                {name}
                {i === today && <span className="plan-today-tag">TODAY</span>}
              </div>
              <button className="plan-edit" onClick={() => navigate(`/train?day=${i}`)}>
                Edit slots →
              </button>
            </div>
            <div className="plan-choices">
              {CHOICES.map((c) => (
                <button
                  key={c ?? 'rest'}
                  className={`plan-choice${plan[i] === c ? ' plan-choice-on' : ''}`}
                  onClick={() => setDay(i, c)}
                >
                  {label(c)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="plan-note">
        Each day keeps its own slots, so two push days can run different exercises.
      </div>
    </div>
  )
}
