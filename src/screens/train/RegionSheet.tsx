import { REGION_GROUPS } from '../../lib/slots'
import './RegionSheet.css'

/** Choose which muscle region a slot targets. */
export function RegionSheet({
  current,
  taken,
  onPick,
  onClose,
}: {
  current?: string
  /** Regions already used by other slots — still selectable, just flagged. */
  taken: string[]
  onPick: (region: string) => void
  onClose: () => void
}) {
  return (
    <div className="region-backdrop" onClick={onClose}>
      <div className="region-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="region-handle" />
        <div className="region-head">
          <div>
            <div className="region-label">SLOT TARGET</div>
            <div className="region-title">Which muscle?</div>
          </div>
          <button className="region-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="region-list">
          {REGION_GROUPS.map((g) => (
            <div key={g.group} className="region-group">
              <div className="region-group-name">{g.group.toUpperCase()}</div>
              <div className="region-chips">
                {g.regions.map((r) => (
                  <button
                    key={r.region}
                    className={`region-chip${r.region === current ? ' region-chip-on' : ''}`}
                    onClick={() => onPick(r.region)}
                  >
                    {r.region}
                    {taken.includes(r.region) && r.region !== current && (
                      <span className="region-taken">•</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
