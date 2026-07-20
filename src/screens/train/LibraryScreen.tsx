import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listTemplates,
  setTemplateFavorite,
  deleteTemplate,
  saveDayDraft,
  getWeeklyPlan,
  getProfile,
} from '../../db/repo'
import { DAY_TYPE_LABELS, planFor, weekdayIndex } from '../../lib/stats'
import type { WorkoutTemplate } from '../../db/types'
import './LibraryScreen.css'

export function LibraryScreen() {
  const navigate = useNavigate()
  const raw = useLiveQuery(listTemplates, [])
  // Mis-taps beside Load must not destroy a saved workout: first ✕ arms
  // the row ("Sure?"), a second tap within 2.5s deletes.
  const [armedDelete, setArmedDelete] = useState<number | null>(null)
  useEffect(() => {
    if (armedDelete == null) return
    const t = setTimeout(() => setArmedDelete(null), 2500)
    return () => clearTimeout(t)
  }, [armedDelete])

  if (!raw) return null
  const templates = [...raw].sort((a, b) => Number(b.favorite) - Number(a.favorite))

  const load = async (t: WorkoutTemplate) => {
    // Load into the next weekday planned for this day type, else today.
    const profile = await getProfile()
    const plan = planFor((await getWeeklyPlan()) ?? undefined, profile?.split ?? 'ppl')
    const today = weekdayIndex()
    const order = Array.from({ length: 7 }, (_, k) => (today + k) % 7)
    const target = order.find((d) => plan[d] === t.dayType) ?? today
    await saveDayDraft(target, t.slots)
    navigate(`/train?day=${target}`)
  }

  return (
    <div className="screen">
      <button className="chip lib-back" onClick={() => navigate('/train')}>
        ← Builder
      </button>
      <div className="screen-title">Saved workouts</div>

      {templates.length === 0 && (
        <div className="card lib-empty">
          Nothing saved yet. Build a workout and hit <b>Save</b> — it lands here for one-tap reuse.
        </div>
      )}

      <div className="lib-list">
        {templates.map((t) => (
          <div key={t.id} className="lib-row">
            <button
              className={`lib-star${t.favorite ? ' lib-star-on' : ''}`}
              onClick={() => void setTemplateFavorite(t.id!, !t.favorite)}
              aria-label={t.favorite ? 'Unstar' : 'Star'}
            >
              ★
            </button>
            <button className="lib-row-main" onClick={() => void load(t)}>
              <div className="lib-name">{t.name}</div>
              <div className="lib-meta">
                {DAY_TYPE_LABELS[t.dayType]} · {t.slots.filter((s) => s.exerciseId).length} of {t.slots.length}{' '}
                slots
              </div>
            </button>
            <button className="lib-load" onClick={() => void load(t)}>
              Load
            </button>
            <button
              className={`lib-delete${armedDelete === t.id ? ' lib-delete-armed' : ''}`}
              onClick={() => {
                if (armedDelete === t.id) {
                  setArmedDelete(null)
                  void deleteTemplate(t.id!)
                } else {
                  setArmedDelete(t.id!)
                }
              }}
              aria-label={armedDelete === t.id ? `Confirm delete ${t.name}` : `Delete ${t.name}`}
            >
              {armedDelete === t.id ? 'Sure?' : '✕'}
            </button>
          </div>
        ))}
      </div>

      <div className="lib-footnote">
        Starred workouts sort first. Loading one refills that day's slots — locks included.
      </div>
    </div>
  )
}
