import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getExercise, getDraft, saveDraft } from '../../db/repo'
import { exerciseImage, exerciseVideo } from '../../lib/media'
import { joinEquipments, sentenceCase } from '../../lib/format'
import type { DayType } from '../../db/types'
import './ExerciseDetailScreen.css'

/** exerciseTips mixes coaching cues with mistake/injury warnings — split
 *  them so warnings render in the amber WATCH OUT card per the design.
 *  Catalog tips follow a "Title: description" shape, and only the TITLE
 *  reliably signals intent (descriptions of good cues often mention injury
 *  too) — classifying on the whole text flags ~3/4 of cues as warnings. */
export function splitTips(tips: string[]): { cues: string[]; warnings: string[] } {
  const warnRx = /avoid|don'?t|do not|never|stop|mistake|too (heavy|fast|deep|much|far)|watch|caution|warning|cheat|momentum|ego/i
  const cues: string[] = []
  const warnings: string[] = []
  for (const t of tips) {
    const title = t.split(':')[0].slice(0, 60)
    ;(warnRx.test(title) ? warnings : cues).push(t)
  }
  return { cues, warnings }
}

export function ExerciseDetailScreen() {
  const { exerciseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const slotCtx = location.state as { slotIndex: number; dayType: DayType } | null
  // Map "missing" to null so it's distinguishable from "still loading".
  const ex = useLiveQuery(async () => (await getExercise(exerciseId!)) ?? null, [exerciseId])

  if (ex === undefined) return null
  if (ex === null) {
    return (
      <div className="screen">
        <button className="chip detail-back" onClick={() => navigate(-1)}>← Back</button>
        <div className="screen-title">Exercise not found</div>
      </div>
    )
  }

  const video = exerciseVideo(ex)
  const image = exerciseImage(ex, '720p')
  const { cues, warnings } = splitTips(ex.exerciseTips)

  const fillSlot = async () => {
    if (!slotCtx) return
    const draft = await getDraft(slotCtx.dayType)
    if (!draft) return
    const next = draft.map((s, i) => (i === slotCtx.slotIndex ? { ...s, exerciseId: ex.exerciseId } : s))
    await saveDraft(slotCtx.dayType, next)
    navigate('/train')
  }

  return (
    <div className="screen">
      <button className="chip detail-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="detail-media">
        {video ? (
          <video src={video} poster={image} controls loop muted playsInline preload="metadata" />
        ) : image ? (
          <img src={image} alt={ex.name} />
        ) : (
          <div className="detail-media-empty">No media for this one</div>
        )}
      </div>

      <div className="detail-title-row">
        <div className="detail-name">{ex.name}</div>
        <div className="detail-chips">
          <span className="detail-chip-accent">{sentenceCase(ex.targetMuscles[0] ?? ex.bodyParts[0] ?? '')}</span>
          <span className="detail-chip">{joinEquipments(ex.equipments)}</span>
          {ex.bodyParts[0] && <span className="detail-chip">{sentenceCase(ex.bodyParts[0])}</span>}
        </div>
      </div>

      {slotCtx && (
        <button className="btn-primary" onClick={() => void fillSlot()}>
          Fill slot with this →
        </button>
      )}

      {ex.overview && <div className="detail-overview">{ex.overview}</div>}

      {ex.instructions.length > 0 && (
        <div className="card detail-card">
          <div className="detail-card-label">HOW TO</div>
          <div className="detail-steps">
            {ex.instructions.map((step, i) => (
              <div key={i} className="detail-step">
                <div className="detail-step-num">{i + 1}</div>
                <div className="detail-step-text">{step}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cues.length > 0 && (
        <div className="card detail-card">
          <div className="detail-card-label detail-label-accent">FORM TIPS</div>
          <div className="detail-tips">
            {cues.map((t, i) => (
              <div key={i} className="detail-tip">
                <div className="detail-tip-mark">✓</div>
                <div className="detail-step-text">{t}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="detail-warn-card">
          <div className="detail-card-label detail-label-warn">WATCH OUT</div>
          <div className="detail-tips">
            {warnings.map((t, i) => (
              <div key={i} className="detail-tip">
                <div className="detail-warn-mark">!</div>
                <div className="detail-step-text">{t}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
