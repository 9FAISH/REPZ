import { useNavigate } from 'react-router-dom'
import { KiloSprite } from '../../components/KiloHero'
import { MASCOT_VARIANTS, requirementLabel } from '../../lib/mascot'
import { useMascotStats } from '../../lib/useMascotStats'
import './ShelfScreen.css'

export function ShelfScreen() {
  const navigate = useNavigate()
  const stats = useMascotStats()

  if (!stats) return null
  const earnedCount = MASCOT_VARIANTS.filter((v) => v.isEarned(stats)).length

  return (
    <div className="screen">
      <button className="chip shelf-back" onClick={() => navigate('/progress')}>
        ← Progress
      </button>
      <div className="screen-title">The Kilo shelf</div>
      <div className="shelf-sub">
        Earn variants by showing up. They're vinyl. They judge you kindly. · {earnedCount} of{' '}
        {MASCOT_VARIANTS.length} earned
      </div>

      <div className="shelf-grid">
        {MASCOT_VARIANTS.map((v) => {
          const earned = v.isEarned(stats)
          return (
            <div key={v.id} className="shelf-item">
              <div className={`shelf-art${earned ? '' : ' shelf-art-locked'}`}>
                <KiloSprite asset={v.asset} height={118} />
              </div>
              <div className="shelf-meta">
                <div className="shelf-name">{v.name}</div>
                <div className={`shelf-req${earned ? '' : ' shelf-req-locked'}`}>
                  {earned ? v.requirement : `LOCKED · ${requirementLabel(v, stats)}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
