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
  onChoose: (exerciseId: string) => void
  onInfo: (exerciseId: string) => void
  onClose: () => void
}

/** Bottom-sheet exercise picker for one muscle-region slot. */
export function PickerSheet({ region, muscles, availableList, blocked, available, onChoose, onInfo, onClose }: Props) {
  // Show the muscle that actually matched this slot, not just targetMuscles[0].
  const matchedMuscle = (ex: Exercise) => ex.targetMuscles.find((m) => muscles.includes(m)) ?? ex.targetMuscles[0] ?? ''
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
        <div className="picker-list">
          {availableList.length === 0 && (
            <div className="picker-empty">
              Nothing available for this slot with your current gear — switch more equipment on, or check the
              hidden list below.
            </div>
          )}
          {availableList.map((ex) => (
            <div key={ex.exerciseId} className="picker-row">
              <div className="picker-thumb">
                {exerciseImage(ex, '360p') && <img src={exerciseImage(ex, '360p')} alt="" loading="lazy" />}
              </div>
              <button className="picker-choose" onClick={() => onChoose(ex.exerciseId)}>
                <div className="picker-ex-name">{ex.name}</div>
                <div className="picker-ex-meta">
                  {joinEquipments(ex.equipments)} · {sentenceCase(matchedMuscle(ex))}
                </div>
              </button>
              <button className="picker-info" onClick={() => onInfo(ex.exerciseId)} aria-label={`${ex.name} info`}>
                i
              </button>
            </div>
          ))}
          {blocked.length > 0 && (
            <>
              <div className="picker-blocked-label">HIDDEN — GEAR OFF IN YOUR INVENTORY</div>
              {blocked.map((ex) => (
                <div key={ex.exerciseId} className="picker-blocked-row">
                  <div className="picker-blocked-name">{ex.name}</div>
                  <div className="picker-blocked-needs">
                    needs {joinEquipments(ex.equipments.filter((q) => !available.has(q)))}
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
