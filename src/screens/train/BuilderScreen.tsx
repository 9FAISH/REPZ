import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getProfile,
  getWeeklyPlan,
  getDayDraft,
  saveDayDraft,
  availableEquipmentNames,
  saveTemplate,
  listTemplates,
} from '../../db/repo'
import { db } from '../../db/db'
import { DAY_TYPE_LABELS, WEEKDAY_LABELS, planFor, weekdayIndex } from '../../lib/stats'
import { SLOT_DEFS, emptySlots, equipmentOk, isBuildable, musclesForRegion, rankExercise } from '../../lib/slots'
import { joinEquipments } from '../../lib/format'
import { exerciseImage } from '../../lib/media'
import { EQUIPMENT_FAMILIES } from '../../lib/equipmentFamilies'
import { PickerSheet } from './PickerSheet'
import { RegionSheet } from './RegionSheet'
import type { Exercise, TemplateSlot } from '../../db/types'
import './BuilderScreen.css'

export function BuilderScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const profile = useLiveQuery(getProfile)
  const storedPlan = useLiveQuery(getWeeklyPlan, [])
  const available = useLiveQuery(availableEquipmentNames, [])
  const catalog = useLiveQuery(() => db.exercises.toArray(), [])

  // Which weekday is being edited (?day=0..6), defaulting to today.
  const dayParam = Number(params.get('day'))
  const weekday = Number.isInteger(dayParam) && dayParam >= 0 && dayParam <= 6 ? dayParam : weekdayIndex()

  // storedPlan: undefined = loading, null = none saved yet.
  const plan =
    profile && storedPlan !== undefined ? planFor(storedPlan ?? undefined, profile.split) : undefined
  const dayType = plan?.[weekday] ?? null

  const draft = useLiveQuery(
    async () => (await getDayDraft(weekday)) ?? (dayType ? emptySlots(dayType) : []),
    [weekday, dayType],
  )

  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [regionSlot, setRegionSlot] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const byId = useMemo(() => {
    const m = new Map<string, Exercise>()
    catalog?.forEach((e) => m.set(e.exerciseId, e))
    return m
  }, [catalog])

  const buildable = useMemo(() => (catalog ?? []).filter(isBuildable), [catalog])

  // Everything the user owns, ranked — the search pool. Must be computed
  // before the loading guard below (hooks can't run conditionally).
  const ownedPool = useMemo(
    () =>
      available
        ? buildable.filter((e) => equipmentOk(e, available)).sort((a, b) => rankExercise(b) - rankExercise(a))
        : [],
    [buildable, available],
  )

  if (!profile || !plan || !draft || !available || !catalog) return null

  const usedIds = new Set(draft.map((s) => s.exerciseId).filter(Boolean) as string[])
  const filled = draft.filter((s) => s.exerciseId).length
  const write = (slots: TemplateSlot[]) => void saveDayDraft(weekday, slots)

  /** Candidates for a slot: region muscles match AND all gear available. */
  function candidatesFor(slotIndex: number) {
    const muscles = new Set(musclesForRegion(draft![slotIndex].region))
    const current = draft![slotIndex].exerciseId
    const matching = buildable
      .filter((e) => e.targetMuscles.some((m) => muscles.has(m)))
      .filter((e) => e.exerciseId === current || !usedIds.has(e.exerciseId))
    return {
      availableList: matching
        .filter((e) => equipmentOk(e, available!))
        .sort((a, b) => rankExercise(b) - rankExercise(a)),
      blocked: matching.filter((e) => !equipmentOk(e, available!)),
    }
  }

  const hiddenAll = buildable.filter(
    (e) =>
      draft.some((s) => e.targetMuscles.some((m) => musclesForRegion(s.region).includes(m))) &&
      !equipmentOk(e, available),
  )
  const offFamilies = [
    ...new Set(
      hiddenAll
        .flatMap((e) => e.equipments.filter((q) => !available.has(q)))
        .map((q) => EQUIPMENT_FAMILIES.find((f) => f.members.includes(q))?.label ?? q),
    ),
  ]

  const setSlot = (i: number, exerciseId: string | null) =>
    write(draft.map((s, j) => (j === i ? { ...s, exerciseId } : s)))

  const setRegion = (i: number, region: string) =>
    // Changing the target clears the pick — it belonged to the old muscle.
    write(draft.map((s, j) => (j === i ? { region, exerciseId: null } : s)))

  const addSlot = () => {
    const taken = new Set(draft.map((s) => s.region))
    const suggestion =
      (dayType ? SLOT_DEFS[dayType].find((d) => !taken.has(d.region))?.region : undefined) ?? 'Core'
    write([...draft, { region: suggestion, exerciseId: null }])
    setRegionSlot(draft.length) // let them retarget it straight away
  }

  const removeSlot = (i: number) => write(draft.filter((_, j) => j !== i))

  const generate = () => {
    const used = new Set(usedIds)
    write(
      draft.map((slot, i) => {
        if (slot.exerciseId) return slot
        const pick = candidatesFor(i).availableList.find((e) => !used.has(e.exerciseId))
        if (pick) used.add(pick.exerciseId)
        return { ...slot, exerciseId: pick?.exerciseId ?? null }
      }),
    )
  }

  const saveToFavorites = async () => {
    if (!dayType) return
    const taken = new Set((await listTemplates()).filter((t) => t.dayType === dayType).map((t) => t.name))
    const base = DAY_TYPE_LABELS[dayType]
    let name = ''
    for (let i = 0; ; i++) {
      name = i < 26 ? `${base} ${String.fromCharCode(65 + i)}` : `${base} ${i + 1}`
      if (!taken.has(name)) break
    }
    await saveTemplate({ name, dayType, slots: draft, favorite: true })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
  }

  return (
    <div className="screen">
      {/* Weekday tabs — edit any day, not just today */}
      <div className="builder-days">
        {WEEKDAY_LABELS.map((name, i) => (
          <button
            key={name}
            className={`builder-day${i === weekday ? ' builder-day-on' : ''}${plan[i] ? '' : ' builder-day-rest'}`}
            onClick={() => setParams({ day: String(i) }, { replace: true })}
          >
            {name}
            <span className="builder-day-type">{plan[i] ? DAY_TYPE_LABELS[plan[i]!] : 'Rest'}</span>
          </button>
        ))}
      </div>

      <div className="builder-head">
        <div className="screen-title">{dayType ? DAY_TYPE_LABELS[dayType] : 'Rest day'}</div>
        <div className="builder-head-actions">
          <button className="chip" onClick={() => navigate('/train/plan')}>Plan</button>
          <button className="chip" onClick={() => navigate('/train/library')}>Saved</button>
        </div>
      </div>

      {!dayType ? (
        <div className="card builder-rest-card">
          {WEEKDAY_LABELS[weekday]} is a rest day. Change it in <b>Plan</b>, or add slots below to train
          anyway.
        </div>
      ) : (
        <div className="builder-explainer">
          One exercise per muscle slot. Tap the muscle name to retarget a slot, or add your own.
        </div>
      )}

      <div className="builder-slots">
        {draft.map((slot, i) => {
          const ex = slot.exerciseId ? byId.get(slot.exerciseId) : undefined
          return (
            <div key={`${slot.region}-${i}`} className={`builder-slot${ex ? ' builder-slot-locked' : ''}`}>
              <div className="builder-slot-top">
                <button className="builder-slot-region" onClick={() => setRegionSlot(i)}>
                  {slot.region.toUpperCase()}
                  <span className="builder-region-edit">▾</span>
                </button>
                <div className="builder-slot-tools">
                  {ex && (
                    <div className="builder-locked-badge">
                      <svg width="10" height="12" viewBox="0 0 10 12">
                        <rect x="0.75" y="5" width="8.5" height="6.5" rx="1.8" fill="currentColor" />
                        <path d="M2.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                      LOCKED
                    </div>
                  )}
                  <button
                    className="builder-remove"
                    onClick={() => removeSlot(i)}
                    aria-label={`Remove ${slot.region} slot`}
                  >
                    ✕
                  </button>
                </div>
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
                      <button className="builder-swap" onClick={() => setPickerSlot(i)}>Swap</button>
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

        <button className="builder-add-slot" onClick={addSlot}>
          + Add slot
        </button>
      </div>

      {draft.length > 0 && (
        <div className="builder-hidden-note">
          <div className="builder-hidden-dot" />
          {hiddenAll.length
            ? `${hiddenAll.length} exercise${hiddenAll.length === 1 ? '' : 's'} hidden — ${offFamilies.join(' + ')} off in your inventory`
            : 'All exercises for this session are available'}
        </div>
      )}

      {filled < draft.length && draft.length > 0 && (
        <button className="btn-secondary" onClick={generate}>
          Generate for me · fill {draft.length - filled} open slot{draft.length - filled === 1 ? '' : 's'}
        </button>
      )}

      <div className="builder-footer-actions">
        <button className="chip builder-save" disabled={filled === 0} onClick={() => void saveToFavorites()}>
          {savedFlash ? 'Saved ★' : 'Save workout'}
        </button>
      </div>

      <button
        className="btn-primary"
        disabled={filled === 0}
        onClick={() => navigate('/train/live', { state: { weekday } })}
      >
        Start workout · {filled} exercise{filled === 1 ? '' : 's'}
      </button>

      {pickerSlot != null && (
        <PickerSheet
          region={draft[pickerSlot].region}
          muscles={musclesForRegion(draft[pickerSlot].region)}
          {...candidatesFor(pickerSlot)}
          available={available}
          searchPool={ownedPool}
          onChoose={(id) => {
            setSlot(pickerSlot, id)
            setPickerSlot(null)
          }}
          onInfo={(id) => navigate(`/train/exercise/${id}`, { state: { slotIndex: pickerSlot, weekday } })}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {regionSlot != null && (
        <RegionSheet
          current={draft[regionSlot]?.region}
          taken={draft.map((s) => s.region)}
          onPick={(region) => {
            setRegion(regionSlot, region)
            setRegionSlot(null)
          }}
          onClose={() => setRegionSlot(null)}
        />
      )}
    </div>
  )
}
