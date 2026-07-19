import { useNavigate } from 'react-router-dom'
import './HomeScreen.css'

// Phase 0: static demo data mirroring the design file. Real data
// arrives with the Dexie profile/session layer in Phases 1–2.
const demo = {
  streakDays: 12,
  speech: '12 days straight. Push day — let’s eat.',
  sessionName: 'PUSH A',
  sessionMinutes: 52,
  slotsFilled: 3,
  slotsTotal: 5,
  proteinEaten: 132,
  proteinTarget: 165,
  weightTrend: '+0.24',
}

function todayLine(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).replace(',', ' ·')
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Morning.'
  if (h < 18) return 'Afternoon.'
  return 'Evening.'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const pct = Math.round((demo.proteinEaten / demo.proteinTarget) * 100)

  return (
    <div className="screen">
      <header className="home-header">
        <div>
          <div className="home-date">{todayLine()}</div>
          <div className="home-greeting">{greeting()}</div>
        </div>
        <div className="pill-accent">{demo.streakDays}-DAY STREAK</div>
      </header>

      <section className="card-lg home-hero">
        <div className="home-kilo-sprite" aria-label="Kilo, your gym buddy" />
        <div className="home-speech">
          <div className="home-speech-arrow" />
          <div className="home-speech-text">{demo.speech}</div>
          <div className="home-speech-byline">— Kilo, your spotter</div>
        </div>
      </section>

      <section className="home-workout-card">
        <div className="home-workout-top">
          <div className="home-workout-label">TODAY · {demo.sessionName}</div>
          <div className="home-workout-time">~{demo.sessionMinutes} min</div>
        </div>
        <div className="home-workout-count">
          {demo.slotsFilled} of {demo.slotsTotal} slots filled
        </div>
        <div className="home-slotbar">
          {Array.from({ length: demo.slotsTotal }, (_, i) => (
            <div
              key={i}
              className={`home-slotseg${i < demo.slotsFilled ? ' home-slotseg-filled' : ''}`}
            />
          ))}
        </div>
        <div className="home-workout-actions">
          <button className="btn-primary home-start" onClick={() => navigate('/train')}>
            Start workout
          </button>
          <button className="btn-secondary home-edit" onClick={() => navigate('/train')}>
            Edit slots
          </button>
        </div>
      </section>

      <section className="home-stats">
        <button className="home-stat-card" onClick={() => navigate('/food')}>
          <div className="section-label">PROTEIN</div>
          <div className="home-stat-value numeral">
            {demo.proteinEaten}
            <span className="home-stat-unit"> / {demo.proteinTarget} g</span>
          </div>
          <div className="home-protein-track">
            <div className="home-protein-fill" style={{ width: `${pct}%` }} />
          </div>
        </button>
        <button className="home-stat-card" onClick={() => navigate('/progress')}>
          <div className="section-label">WEIGHT TREND</div>
          <div className="home-stat-value numeral">
            {demo.weightTrend}
            <span className="home-stat-unit"> kg/wk</span>
          </div>
          <div className="home-stat-note">On pace for the bulk ↗</div>
        </button>
      </section>
    </div>
  )
}
