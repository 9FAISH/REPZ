import { useState } from 'react'
import { logFood } from '../../db/repo'
import './LogFoodSheet.css'

/** Manual food entry — local-first, no food database. Name optional. */
export function LogFoodSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [saving, setSaving] = useState(false)

  const kcalNum = Number(kcal)
  const proteinNum = protein === '' ? 0 : Number(protein)
  const valid = kcal !== '' && Number.isFinite(kcalNum) && kcalNum > 0 && Number.isFinite(proteinNum) && proteinNum >= 0

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await logFood({
        date,
        name: name.trim() || 'Meal',
        kcal: Math.round(kcalNum),
        proteinG: Math.round(proteinNum),
      })
      onClose()
    } catch (err) {
      console.error('[repz] food save failed', err)
      setSaving(false)
    }
  }

  return (
    <div className="foodsheet-backdrop" onClick={onClose}>
      <div className="foodsheet" onClick={(e) => e.stopPropagation()}>
        <div className="foodsheet-handle" />
        <div className="foodsheet-head">
          <div>
            <div className="foodsheet-label">LOG FOOD</div>
            <div className="foodsheet-title">What did you eat?</div>
          </div>
          <button className="foodsheet-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="foodsheet-fields">
          <div className="foodsheet-field">
            <div className="foodsheet-field-label">NAME</div>
            <input
              className="foodsheet-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="optional"
              maxLength={60}
              autoCapitalize="sentences"
              enterKeyHint="next"
            />
          </div>
          <div className="foodsheet-field">
            <div className="foodsheet-field-label">KCAL</div>
            <input
              className="foodsheet-input"
              value={kcal}
              onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="required"
              maxLength={4}
              inputMode="numeric"
              enterKeyHint="next"
            />
          </div>
          <div className="foodsheet-field">
            <div className="foodsheet-field-label">PROTEIN G</div>
            <input
              className="foodsheet-input"
              value={protein}
              onChange={(e) => setProtein(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              maxLength={3}
              inputMode="numeric"
              enterKeyHint="done"
              onKeyDown={(e) => e.key === 'Enter' && void save()}
            />
          </div>
        </div>

        <button className="foodsheet-save" disabled={!valid || saving} onClick={() => void save()}>
          Add to today
        </button>
      </div>
    </div>
  )
}
