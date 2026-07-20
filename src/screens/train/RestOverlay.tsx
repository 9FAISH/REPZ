import { formatRest } from '../../lib/liveSession/restTimer'
import { KiloSprite } from '../../components/KiloHero'
import { REACTION_ASSET } from '../../lib/mascot'
import './RestOverlay.css'

interface Props {
  remainingSec: number
  totalSec: number
  loggedLabel: string
  nextUp: string
  isPr?: boolean
  onExtend: () => void
  onSkip: () => void
}

const R = 94
const CIRC = 2 * Math.PI * R

export function RestOverlay({ remainingSec, totalSec, loggedLabel, nextUp, isPr, onExtend, onSkip }: Props) {
  const pct = totalSec > 0 ? remainingSec / totalSec : 0
  return (
    <div className="rest-overlay">
      {/* Mascot reaction hook: PR sets get the celebration variant. */}
      <KiloSprite asset={isPr ? REACTION_ASSET.pr : REACTION_ASSET.rest} height={140} />
      {isPr && <div className="rest-pr-badge">NEW PR 🎉</div>}
      <div className="rest-label">REST · LOGGED {loggedLabel}</div>
      <div className="rest-ring-wrap">
        <svg width="210" height="210" viewBox="0 0 210 210" className="rest-ring">
          <circle cx="105" cy="105" r={R} fill="none" stroke="var(--elevated)" strokeWidth="9" />
          <circle
            cx="105"
            cy="105"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(pct * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`}
            transform="rotate(-90 105 105)"
          />
        </svg>
        <div className="rest-count numeral">{formatRest(remainingSec)}</div>
      </div>
      <div className="rest-next">{nextUp}</div>
      <div className="rest-actions">
        <button className="rest-extend" onClick={onExtend}>+30 s</button>
        <button className="rest-skip" onClick={onSkip}>Skip — I'm ready</button>
      </div>
    </div>
  )
}
