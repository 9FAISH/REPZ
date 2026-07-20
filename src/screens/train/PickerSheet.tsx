import { useMemo, useState } from 'react'
import { exerciseImage } from '../../lib/media'
import { joinEquipments, sentenceCase } from '../../lib/format'
import type { Exercise } from '../../db/types'
import './PickerSheet.css'

interface Props {
  region: string
  muscles: string[]
  availableList: Exercise[]
  blocked: Exercise[]
  available: Set<string>
  /** Everything you own, for searching outside this slot's muscle group. */
  searchPool: Exercise[]
  onChoose: (exerciseId: string) => void
  onInfo: (exerciseId: string) => void
  onClose: () => void
}

const matches = (ex: Exercise, q: string) => {
  const hay = `${ex.name} ${ex.equipments.join(' ')} ${ex.targetMuscles.join(' ')} ${ex.bodyParts.join(' ')}`
  return hay.toLowerCase().includes(q)
}

/** Bottom-sheet exercise picker for one muscle-region slot. */
export function PickerSheet({
  region,
  muscles,
  availableList,
  blocked,
  available,
  searchPool,
  onChoose,
  onInfo,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Show the muscle that actually matched this slot, not just targetMuscles[0].
  const matchedMuscle = (ex: Exercise) =>
    ex.targetMuscles.find((m) => muscles.includes(m)) ?? ex.targetMuscles[0] ?? ''

  const inSlot = useMemo(
    () => (q ? availableList.filter((e) => matches(e, q)) : availableList),
    [availableList, q],
  )

  // Searching also reaches exercises outside this region, so "leg press" or
  // "cable" finds gear even if the slot is set to something else.
  const elsewhere = useMemo(() => {
    if (!q) return []
    const inSlotIds = new Set(availableList.map((e) => e.exerciseId))
    return searchPool.filter((e) => !inSlotIds.has(e.exerciseId) && matches(e, q)).slice(0, 40)
  }, [searchPool, availableList, q])

  const renderRow = (ex: Exercise, foreign = false) => (
    <div key={ex.exerciseId} className="picker-row">
      <div className="picker-thumb">
        {exerciseImage(ex, '360p') && <img src={exerciseImage(ex, '360p')} alt="" loading="lazy" />}
      </div>
      <button className="picker-choose" onClick={() => onChoose(ex.exerciseId)}>
        <div className="picker-ex-name">{ex.name}</div>
        <div className="picker-ex-meta">
          {joinEquipments(ex.equipments)} ·{' '}
          {sentenceCase(foreign ? (ex.targetMuscles[0] ?? '') : matchedMuscle(ex))}
        </div>
      </button>
      <button className="picker-info" onClick={() => onInfo(ex.exerciseId)} aria-label={`${ex.name} info`}>
        i
      </button>
    </div>
  )

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="picker-handle" />
        <div className="picker-head">
          <div>
            <div className="picker-label">FILL SLOT</div>
            <div className="picker-title">{region}</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="picker-search">
          <svg className="picker-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            className="picker-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search machine or exercise…"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="search"
            type="search"
          />
          {query && (
            <button className="picker-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <div className="picker-list">
          {inSlot.length === 0 && elsewhere.length === 0 && (
            <div className="picker-empty">
              {q
                ? `Nothing matches “${query}” in the gear you own.`
                : 'Nothing available for this slot with your current gear — switch more equipment on, or check the hidden list below.'}
            </div>
          )}

          {inSlot.map((ex) => renderRow(ex))}

          {elsewhere.length > 0 && (
            <>
              <div className="picker-section-label">OTHER MUSCLE GROUPS</div>
              {elsewhere.map((ex) => renderRow(ex, true))}
            </>
          )}

          {!q && blocked.length > 0 && (
            <>
              <div className="picker-section-label">HIDDEN — GEAR OFF IN YOUR INVENTORY</div>
              {blocked.map((ex) => (
                <div key={ex.exerciseId} className="picker-blocked-row">
                  <div className="picker-blocked-name">{ex.name}</div>
                  <div className="picker-blocked-needs">
                    needs {joinEquipments(ex.equipments.filter((eq) => !available.has(eq)))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
