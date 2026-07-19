import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getProfile,
  getDraft,
  saveDraft,
  availableEquipmentNames,
  saveTemplate,
  listTemplates,
} from '../../db/repo'
import { db } from '../../db/db'
import { todayDayType, DAY_TYPE_LABELS } from '../../lib/stats'
import { SLOT_DEFS, emptySlots, equipmentOk, isBuildable, rankExercise } from '../../lib/slots'
import { joinEquipments } from '../../lib/format'
import { exerciseImage } from '../../lib/media'
import { EQUIPMENT_FAMILIES } from '../../lib/equipmentFamilies'
import { PickerSheet } from './PickerSheet'
import type { DayType, Exercise, Profile, TemplateSlot } from '../../db/types'
import './BuilderScreen.css'

/** On rest days the builder targets the next scheduled session. */
export function builderDayType(profile: Profile, date = new Date()): DayType {
  const today = todayDayType(profile.split, date)
  if (today) return today
  for (let i = 1; i <= 7; i++) {
    const d = new Date(date)
    d.setDate(d.getDate() + i)
    const next = todayDayType(profile.split, d)
    if (next) return next
  }
  return 'full'
}

export function BuilderScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useLiveQuery(getProfile)
  // Library "Load" hands over the loaded template's day so the builder
  // shows what was just loaded, not necessarily today's session.
  const forcedDay = (location.state as { dayType?: DayType } | null)?.dayType
  const dayType = forcedDay ?? (profile ? builderDayType(profile) : undefined)
  const draft = useLiveQuery(
    async () => (dayType ? ((await getDraft(dayType)) ?? emptySlots(dayType)) : undefined),
    [dayType],
  )
  const available = useLiveQuery(availableEquipmentNames, [])
  const catalog = useLiveQuery(() => db.exercises.toArray(), [])
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const byId = useMemo(() => {
    const m = new Map<string, Exercise>()
    catalog?.forEach((e) => m.set(e.exerciseId, e))
    return m
  }, [catalog])

  if (!profile || !dayType || !draft || !available || !catalog) return null

  const defs = SLOT_DEFS[dayType]
  const usedIds = new Set(draft.map((s) => s.exerciseId).filter(Boolean) as string[])
  const filled = draft.filter((s) => s.exerciseId).length

  // Candidates per slot: target muscle matches AND all equipment available.
  function candidatesFor(slotIndex: number) {
    const def = defs[slotIndex]
    const muscles = new Set(def.muscles)
    const current = draft![slotIndex].exerciseId
    const matching = catalog!
      .filter((e) => isBuildable(e) && e.targetMuscles.some((m) => muscles.has(m)))
      .filter((e) => e.exerciseId === current || !usedIds.has(e.exerciseId))
    const availableList = matching.filter((e) => equipmentOk(e, available!)).sort((a, b) => rankExercise(b) - rankExercise(a))
    const blocked = matching.filter((e) => !equipmentOk(e, available!))
    return { availableList, blocked }
  }

  // Session-wide hidden-count note (equipment filtered out everywhere).
  const hiddenAll = catalog.filter(
    (e) =>
      isBuildable(e) &&
      defs.some((def) => e.targetMuscles.some((m) => def.muscles.includes(m))) &&
      !equipmentOk(e, available),
  )
  const offFamilies = [
    ...new Set(
      hiddenAll
        .flatMap((e) => e.equipments.filter((q) => !available.has(q)))
        .map((q) => EQUIPMENT_FAMILIES.find((f) => f.members.includes(q))?.label ?? q),
    ),
  ]

  const setSlot = (i: number, exerciseId: string | null) => {
    const next: TemplateSlot[] = draft.map((s, j) => (j === i ? { ...s, exerciseId } : s))
    void saveDraft(dayType, next)
  }

  const generate = () => {
    const used = new Set(usedIds)
    const next = draft.map((slot, i) => {
      if (slot.exerciseId) return slot
      const pick = candidatesFor(i).availableList.find((e) => !used.has(e.exerciseId))
      if (pick) used.add(pick.exerciseId)
      return { ...slot, exerciseId: pick?.exerciseId ?? null }
    })
    void saveDraft(dayType, next)
  }

  const saveToFavorites = async () => {
    // First unused letter suffix — count-based naming collides after deletes.
    const taken = new Set(
      (await listTemplates()).filter((t) => t.dayType === dayType).map((t) => t.name),
    )
    const label = DAY_TYPE_LABELS[dayType]
    let name = ''
    for (let i = 0; ; i++) {
      name = i < 26 ? `${label} ${String.fromCharCode(65 + i)}` : `${label} ${i + 1}`
      if (!taken.has(name)) break
    }
    await saveTemplate({ name, dayType, slots: draft, favorite: true })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
  }

  return (
    <div className="screen">
      <div className="builder-head">
        <div className="screen-title">{DAY_TYPE_LABELS[dayType]}</div>
        <div className="builder-head-actions">
          <button className="chip" disabled={filled === 0} onClick={() => void saveToFavorites()}>
            {savedFlash ? 'Saved ★' : 'Save'}
          </button>
          <button className="chip" onClick={() => navigate('/train/library')}>
            Saved workouts
          </button>
        </div>
      </div>
      <div className="builder-explainer">
        One exercise per muscle slot. Picking one <b>locks</b> the slot — tap Swap to reopen it.
      </div>

      <div className="builder-slots">
        {defs.map((def, i) => {
          const ex = draft[i].exerciseId ? byId.get(draft[i].exerciseId!) : undefined
          return (
            <div key={def.region} className={`builder-slot${ex ? ' builder-slot-locked' : ''}`}>
              <div className="builder-slot-top">
                <div className="builder-slot-region">{def.region.toUpperCase()}</div>
                {ex && (
                  <div className="builder-locked-badge">
                    <svg width="10" height="12" viewBox="0 0 10 12">
                      <rect x="0.75" y="5" width="8.5" height="6.5" rx="1.8" fill="currentColor" />
                      <path d="M2.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                    LOCKED
                  </div>
                )}
              </div>
              {ex ? (
                <div className="builder-slot-body">
                  <button
                    className="builder-thumb"
                    onClick={() => navigate(`/train/exercise/${ex.exerciseId}`)}
                    aria-label={`${ex.name} details`}
                  >
                    {exerciseImage(ex, '360p') && <img src={exerciseImage(ex, '360p')} alt="" loading="lazy" />}
                  </button>
                  <div className="builder-slot-info">
                    <div className="builder-ex-name">{ex.name}</div>
                    <div className="builder-slot-pills">
                      <span className="builder-pill-scheme">3 × 8–12</span>
                      <span className="builder-pill-eq">{joinEquipments(ex.equipments)}</span>
                      <button className="builder-swap" onClick={() => setPickerSlot(i)}>
                        Swap
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button className="builder-pick" onClick={() => setPickerSlot(i)}>
                  + Pick exercise
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="builder-hidden-note">
        <div className="builder-hidden-dot" />
        {hiddenAll.length
          ? `${hiddenAll.length} exercise${hiddenAll.length === 1 ? '' : 's'} hidden — ${offFamilies.join(' + ')} off in your inventory`
          : 'All exercises for this session are available'}
      </div>

      {filled < defs.length && (
        <button className="btn-secondary" onClick={generate}>
          Generate for me · fill {defs.length - filled} open slot{defs.length - filled === 1 ? '' : 's'}
        </button>
      )}
      <button
        className="btn-primary"
        disabled={filled === 0}
        onClick={() => navigate('/train/live')}
      >
        Start workout · {filled} exercise{filled === 1 ? '' : 's'}
      </button>

      {pickerSlot != null && (
        <PickerSheet
          region={defs[pickerSlot].region}
          muscles={defs[pickerSlot].muscles}
          {...candidatesFor(pickerSlot)}
          available={available}
          onChoose={(id) => { setSlot(pickerSlot, id); setPickerSlot(null) }}
          onInfo={(id) => navigate(`/train/exercise/${id}`, { state: { slotIndex: pickerSlot, dayType } })}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  )
}
