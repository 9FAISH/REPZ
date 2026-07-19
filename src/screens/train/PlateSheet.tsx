import { useState } from 'react'
import { platesPerSide } from '../../lib/liveSession/plates'
import './PlateSheet.css'

const BARS = [20, 15, 10]

export function PlateSheet({ totalKg, onClose }: { totalKg: number; onClose: () => void }) {
  const [barKg, setBarKg] = useState(20)
  const { plates, leftoverKg } = platesPerSide(totalKg, barKg)

  return (
    <div className="plate-backdrop" onClick={onClose}>
      <div className="plate-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="plate-handle" />
        <div className="plate-head">
          <div>
            <div className="plate-label">PLATE MATH</div>
            <div className="plate-title numeral">{totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)} kg total</div>
          </div>
          <button className="plate-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="plate-bar-row">
          <span className="plate-bar-label">BAR</span>
          {BARS.map((b) => (
            <button
              key={b}
              className={`plate-bar-opt${barKg === b ? ' plate-bar-on' : ''}`}
              onClick={() => setBarKg(b)}
            >
              {b} kg
            </button>
          ))}
        </div>

        {totalKg <= barKg ? (
          <div className="plate-note">
            {totalKg === 0 ? 'Bodyweight — nothing to load.' : 'At or below the empty bar — no plates needed.'}
          </div>
        ) : (
          <>
            <div className="plate-side-label">EACH SIDE</div>
            <div className="plate-row">
              {plates.length === 0 && <div className="plate-note">Nothing fits — check the bar weight.</div>}
              {plates.map((p, i) => (
                <div key={i} className={`plate plate-${String(p).replace('.', '_')}`}>
                  {p}
                </div>
              ))}
            </div>
            {leftoverKg > 0.01 && (
              <div className="plate-note plate-warn">
                {leftoverKg.toFixed(2)} kg/side doesn't fit standard plates — closest load shown.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
