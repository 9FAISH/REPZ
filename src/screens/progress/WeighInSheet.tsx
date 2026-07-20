import { useState } from 'react'
import { logWeighIn } from '../../db/repo'
import './WeighInSheet.css'

/** Daily weigh-in — one entry per day, upserted. Starts from the latest
 *  known weight so most mornings are two or three taps. */
export function WeighInSheet({ startKg, onClose }: { startKg: number; onClose: () => void }) {
  const [kg, setKg] = useState(Math.round(startKg * 10) / 10)
  const [saving, setSaving] = useState(false)

  const bump = (d: number) => setKg((v) => Math.min(300, Math.max(30, Math.round((v + d) * 10) / 10)))

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await logWeighIn(kg)
      onClose()
    } catch (err) {
      console.error('[repz] weigh-in save failed', err)
      setSaving(false)
    }
  }

  return (
    <div className="weigh-backdrop" onClick={onClose}>
      <div className="weigh-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="weigh-handle" />
        <div className="weigh-label">TODAY'S WEIGH-IN</div>
        <div className="weigh-value numeral">
          {kg.toFixed(1)}
          <span className="weigh-unit"> kg</span>
        </div>
        <div className="weigh-steppers">
          <button className="weigh-step" onClick={() => bump(-1)} aria-label="Minus one kilogram">−1</button>
          <button className="weigh-step" onClick={() => bump(-0.1)} aria-label="Minus point one">−0.1</button>
          <button className="weigh-step weigh-step-up" onClick={() => bump(0.1)} aria-label="Plus point one">+0.1</button>
          <button className="weigh-step weigh-step-up" onClick={() => bump(1)} aria-label="Plus one kilogram">+1</button>
        </div>
        <button className="weigh-save" disabled={saving} onClick={() => void save()}>
          Save weigh-in
        </button>
      </div>
    </div>
  )
}
