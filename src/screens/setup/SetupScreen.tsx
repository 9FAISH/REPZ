import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { hasProfile, completeSetup } from '../../db/repo'
import type { ActivityLevel, Goal, Sex, Split } from '../../db/types'
import {
  EQUIPMENT_FAMILIES,
  defaultFamilyStates,
  familyStatesToItems,
} from '../../lib/equipmentFamilies'
import './SetupScreen.css'

const STEPS = 5

const GOALS: { id: Goal; title: string; tag: string; blurb: string }[] = [
  { id: 'bulk', title: 'BULK', tag: '+0.25 kg/wk', blurb: 'Build muscle in a lean surplus. Kilo bumps calories when the scale stalls.' },
  { id: 'cut', title: 'CUT', tag: '−0.5 kg/wk', blurb: 'Drop fat, keep strength. Protein stays high, calories adapt weekly.' },
]

const ACTIVITY_LEVELS: { id: ActivityLevel; name: string; blurb: string }[] = [
  { id: 'sedentary', name: 'Sedentary', blurb: 'Desk job, little daily movement outside training.' },
  { id: 'light', name: 'Lightly active', blurb: 'On your feet some of the day, easy walks.' },
  { id: 'moderate', name: 'Moderately active', blurb: 'Regular movement most days plus training.' },
  { id: 'active', name: 'Active', blurb: 'Physical job or a lot of daily activity.' },
  { id: 'very_active', name: 'Very active', blurb: 'Hard physical work and training on top.' },
]

const SPLITS: { id: Split; name: string; days: 3 | 4 | 5; daysLabel: string; blurb: string }[] = [
  { id: 'full_body', name: 'Full Body', days: 3, daysLabel: '3 days/wk', blurb: 'Everything, three times a week. Best bang-for-time if life is busy.' },
  { id: 'upper_lower', name: 'Upper / Lower', days: 4, daysLabel: '4 days/wk', blurb: 'Two upper, two lower. The balanced default for most lifters.' },
  { id: 'ppl', name: 'Push · Pull · Legs', days: 5, daysLabel: '5 days/wk', blurb: 'Max volume per muscle. For people who love being in the gym.' },
]

export function SetupScreen() {
  const navigate = useNavigate()
  const existing = useLiveQuery(hasProfile)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(28)
  const [heightCm, setHeightCm] = useState(175)
  const [weightKg, setWeightKg] = useState(75)
  const [goal, setGoal] = useState<Goal>('bulk')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [split, setSplit] = useState<Split>('ppl')
  const [equip, setEquip] = useState<Record<string, boolean>>(defaultFamilyStates)
  const [saving, setSaving] = useState(false)

  // Setup only runs once — with a saved profile the app always opens on
  // the dashboard.
  if (existing === undefined) return null
  if (existing && !saving) return <Navigate to="/" replace />

  const fields = [
    { label: 'AGE', value: age, unit: 'yrs', step: 1, set: setAge, min: 13, max: 100 },
    { label: 'HEIGHT', value: heightCm, unit: 'cm', step: 1, set: setHeightCm, min: 120, max: 230 },
    { label: 'WEIGHT', value: weightKg, unit: 'kg', step: 0.5, set: setWeightKg, min: 30, max: 300 },
  ]

  async function finish() {
    setSaving(true)
    try {
      await completeSetup(
        {
          name: name.trim() || undefined,
          sex,
          age,
          heightCm,
          weightKg,
          goal,
          activityLevel: activity,
          split,
          daysPerWeek: SPLITS.find((s) => s.id === split)!.days,
        },
        familyStatesToItems(equip),
      )
      navigate('/', { replace: true })
    } catch (err) {
      // Failed write must not brick the wizard — let the user retry.
      console.error('[repz] setup save failed', err)
      setSaving(false)
    }
  }

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : void finish())

  return (
    <div className="phone-shell">
      <main className="screen-scroll">
        <div className="screen">
          <div className="setup-dots">
            {Array.from({ length: STEPS }, (_, i) => (
              <div key={i} className={`setup-dot${i <= step ? ' setup-dot-on' : ''}`} />
            ))}
          </div>

          {step === 0 && (
            <>
              <div className="setup-title">Who's lifting?</div>
              <div className="setup-sub">Kilo needs the basics to set your targets.</div>
              <div className="setup-seg-row">
                <button className={`setup-seg${sex === 'male' ? ' setup-seg-on' : ''}`} onClick={() => setSex('male')}>
                  Male
                </button>
                <button className={`setup-seg${sex === 'female' ? ' setup-seg-on' : ''}`} onClick={() => setSex('female')}>
                  Female
                </button>
              </div>
              <div className="setup-field">
                <div className="setup-field-label">NAME</div>
                <input
                  className="setup-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  placeholder="optional"
                  maxLength={24}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  autoCorrect="off"
                  enterKeyHint="done"
                />
              </div>
              {fields.map((f) => (
                <div key={f.label} className="setup-field">
                  <div className="setup-field-label">{f.label}</div>
                  <div className="setup-field-value">
                    <span className="setup-field-num numeral">{f.value}</span>
                    <span className="setup-field-unit">{f.unit}</span>
                  </div>
                  <div className="setup-stepper">
                    <button
                      className="setup-step-btn"
                      aria-label={`Decrease ${f.label.toLowerCase()}`}
                      onClick={() => f.set(Math.max(f.min, Math.round((f.value - f.step) * 10) / 10))}
                    >
                      −
                    </button>
                    <button
                      className="setup-step-btn setup-step-btn-up"
                      aria-label={`Increase ${f.label.toLowerCase()}`}
                      onClick={() => f.set(Math.min(f.max, Math.round((f.value + f.step) * 10) / 10))}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <div className="setup-title">Pick your mission.</div>
              <div className="setup-sub">This sets calories, protein and how the app adapts.</div>
              <div className="setup-stack">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    className={`setup-card${goal === g.id ? ' setup-card-on' : ''}`}
                    onClick={() => setGoal(g.id)}
                  >
                    <div className="setup-card-row">
                      <span className="setup-goal-title">{g.title}</span>
                      <span className={`setup-tag${goal === g.id ? ' setup-tag-on' : ''}`}>{g.tag}</span>
                    </div>
                    <div className="setup-card-blurb">{g.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="setup-title">How active are you?</div>
              <div className="setup-sub">Outside the gym — this scales your calorie budget.</div>
              <div className="setup-stack">
                {ACTIVITY_LEVELS.map((a) => (
                  <button
                    key={a.id}
                    className={`setup-card${activity === a.id ? ' setup-card-on' : ''}`}
                    onClick={() => setActivity(a.id)}
                  >
                    <div className="setup-split-name">{a.name}</div>
                    <div className="setup-card-blurb">{a.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="setup-title">Choose a split.</div>
              <div className="setup-sub">You can swap any time — history carries over.</div>
              <div className="setup-stack">
                {SPLITS.map((s) => (
                  <button
                    key={s.id}
                    className={`setup-card${split === s.id ? ' setup-card-on' : ''}`}
                    onClick={() => setSplit(s.id)}
                  >
                    <div className="setup-card-row">
                      <span className="setup-split-name">{s.name}</span>
                      <span className={`setup-tag${split === s.id ? ' setup-tag-on' : ''}`}>{s.daysLabel}</span>
                    </div>
                    <div className="setup-card-blurb">{s.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="setup-title">What's in your gym?</div>
              <div className="setup-sub">Only gear you switch on shows up in the workout builder.</div>
              <div className="setup-equip-grid">
                {EQUIPMENT_FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    className={`setup-equip${equip[f.id] ? ' setup-equip-on' : ''}`}
                    onClick={() => setEquip((s) => ({ ...s, [f.id]: !s[f.id] }))}
                  >
                    <span className="setup-equip-name">{f.label}</span>
                    <span className={`setup-pill${equip[f.id] ? ' setup-pill-on' : ''}`}>
                      {equip[f.id] ? 'IN' : 'OUT'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="setup-footer">
            {step > 0 && (
              <button className="setup-back" onClick={() => setStep(step - 1)} disabled={saving}>
                Back
              </button>
            )}
            <button className="setup-next" onClick={next} disabled={saving}>
              {step === STEPS - 1 ? "Let's go →" : 'Next'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
