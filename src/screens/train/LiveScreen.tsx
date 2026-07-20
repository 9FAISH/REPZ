import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import {
  getProfile,
  getActiveSession,
  getDraft,
  startSession,
  endSession,
  logSet,
  setsForSession,
  previousSetsForExercise,
  kvGet,
  kvSet,
} from '../../db/repo'
import { DAY_TYPE_LABELS, todayDayType } from '../../lib/stats'
import { builderDayType } from './BuilderScreen'
import { RestTimer } from '../../lib/liveSession/restTimer'
import { suggestNext, type OverloadSuggestion } from '../../lib/liveSession/overload'
import {
  notificationsSupported,
  requestNotificationPermission,
  showRestNotification,
  closeRestNotification,
  onNotificationAction,
} from '../../lib/liveSession/notifications'
import { RestOverlay } from './RestOverlay'
import { PlateSheet } from './PlateSheet'
import { isPrSet } from '../../lib/progress'
import type { Effort, Exercise, WorkoutSession } from '../../db/types'
import './LiveScreen.css'

const SETS_PER_EXERCISE = 3
const REST_SECONDS = 120
const HYPE = ['Same weight, more intent.', 'Own the negative.', 'Last one, best one.']

const isBodyweight = (ex?: Exercise) => !!ex && ex.equipments.every((q) => q === 'BODY WEIGHT')

// Plate math is a barbell concept — for dumbbell/cable/machine work the
// per-side breakdown would be misleading, so the calculator only opens here.
const BARBELL_EQUIP = new Set(['BARBELL', 'EZ BARBELL', 'OLYMPIC BARBELL', 'TRAP BAR', 'SMITH MACHINE'])
const usesBarbell = (ex?: Exercise) => !!ex && ex.equipments.some((q) => BARBELL_EQUIP.has(q))

export function LiveScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useLiveQuery(getProfile)
  const [session, setSession] = useState<WorkoutSession | null | undefined>(undefined)
  const [exIdx, setExIdx] = useState(0)
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(10)
  const [effort, setEffort] = useState<Effort>('solid')
  const [suggestion, setSuggestion] = useState<OverloadSuggestion | null>(null)
  const [resting, setResting] = useState(false)
  const [restState, setRestState] = useState({ remainingSec: 0, totalSec: REST_SECONDS })
  const [plateOpen, setPlateOpen] = useState(false)
  const [lastWasPr, setLastWasPr] = useState(false)
  const [notifOn, setNotifOn] = useState(false)
  const timerRef = useRef<RestTimer | null>(null)
  if (!timerRef.current) timerRef.current = new RestTimer()
  const timer = timerRef.current
  const loggingRef = useRef(false)
  const [notifBlocked, setNotifBlocked] = useState(false)

  const catalog = useLiveQuery(() => db.exercises.toArray(), [])
  const byId = useMemo(() => {
    const m = new Map<string, Exercise>()
    catalog?.forEach((e) => m.set(e.exerciseId, e))
    return m
  }, [catalog])

  const sets = useLiveQuery(
    async () => (session?.id != null ? await setsForSession(session.id) : []),
    [session?.id],
  )

  // ── Session bootstrap: resume the active session or start one from the draft ──
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    ;(async () => {
      const active = await getActiveSession()
      if (active) {
        // Resume on the first unfinished exercise — computed here from the
        // DB directly, because the sets liveQuery lags behind the session
        // switch and its first emission can be a stale [].
        const done = await setsForSession(active.id!)
        const firstOpen = active.exerciseIds.findIndex(
          (id) => done.filter((s) => s.exerciseId === id).length < SETS_PER_EXERCISE,
        )
        if (!cancelled) {
          if (firstOpen > 0) setExIdx(firstOpen)
          setSession(active)
        }
        return
      }
      const dayType =
        (location.state as { dayType?: ReturnType<typeof todayDayType> } | null)?.dayType ??
        builderDayType(profile)
      const draft = dayType ? await getDraft(dayType) : undefined
      const exerciseIds = (draft ?? []).map((s) => s.exerciseId).filter(Boolean) as string[]
      if (exerciseIds.length === 0) {
        if (!cancelled) setSession(null)
        return
      }
      const id = await startSession({ name: DAY_TYPE_LABELS[dayType!], dayType: dayType!, exerciseIds })
      const created = { id, name: DAY_TYPE_LABELS[dayType!], dayType: dayType!, exerciseIds, status: 'active' as const, startedAt: Date.now() }
      if (!cancelled) setSession(created)
    })()
    return () => {
      cancelled = true
    }
  }, [profile, location.state])

  const exercises = useMemo(
    () => (session?.exerciseIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Exercise[],
    [session, byId],
  )

  const current = exercises[exIdx]
  const doneFor = (exerciseId: string) => (sets ?? []).filter((s) => s.exerciseId === exerciseId).length
  const currentDone = current ? doneFor(current.exerciseId) : 0
  const setNumber = Math.min(currentDone + 1, SETS_PER_EXERCISE)
  const allDone =
    exercises.length > 0 && exercises.every((e) => doneFor(e.exerciseId) >= SETS_PER_EXERCISE)

  // ── Per-exercise init: overload suggestion → starting weight/reps ──
  useEffect(() => {
    if (!current || session?.id == null) return
    let cancelled = false
    ;(async () => {
      const prev = await previousSetsForExercise(current.exerciseId, session.id!)
      const sug = suggestNext(prev.map((s) => ({ weightKg: s.weightKg, reps: s.reps, effort: s.effort })))
      if (cancelled) return
      setSuggestion(sug)
      if (sug) {
        setWeight(sug.weightKg)
        setReps(sug.reps)
      } else {
        setWeight(isBodyweight(current) ? 0 : 20)
        setReps(10)
      }
      setEffort('solid')
    })()
    return () => {
      cancelled = true
    }
  }, [current?.exerciseId, session?.id])

  // ── Rest timer wiring (module → UI + notification) ──
  useEffect(() => {
    const unsub = timer.subscribe((s, event) => {
      setRestState({ remainingSec: s.remainingSec, totalSec: s.totalSec })
      if (event === 'start') setResting(true)
      if (event === 'done' || event === 'skip') {
        setResting(false)
        void closeRestNotification()
      }
      if (notifOn && (event === 'start' || event === 'extend' || (event === 'tick' && s.remainingSec % 5 === 0))) {
        void showRestNotification({
          exerciseName: current?.name ?? '',
          nextSetLabel: `set ${setNumber} of ${SETS_PER_EXERCISE}`,
          remainingSec: s.remainingSec,
          weightKg: weight,
          reps,
        })
      }
    })
    return unsub
  }, [timer, notifOn, current?.name, setNumber, weight, reps])

  // Notification action buttons → same controls as on screen
  useEffect(() => {
    return onNotificationAction((action) => {
      if (action === 'skip') timer.skip()
      if (action === 'extend') timer.extend(15)
      if (action === 'add-rep') setReps((r) => r + 1)
      if (action === 'done-set') {
        timer.skip()
        void doLogSet()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, weight, reps, effort, session?.id, exIdx, sets])

  useEffect(() => () => {
    timer.dispose()
    void closeRestNotification()
  }, [timer])

  // Restore notification preference
  useEffect(() => {
    void kvGet<boolean>('notif.enabled').then((v) =>
      setNotifOn(!!v && typeof Notification !== 'undefined' && Notification.permission === 'granted'),
    )
  }, [])

  if (!profile || session === undefined || !catalog || !sets) return null
  if (session === null || exercises.length === 0) {
    return (
      <div className="screen">
        <div className="screen-title live-none-title">Nothing to run</div>
        <div className="card live-none-card">Build today's workout first — then start it live.</div>
        <button className="btn-primary" onClick={() => navigate('/train')}>Open builder</button>
      </div>
    )
  }

  async function doLogSet() {
    if (!current || session?.id == null) return
    // Guard + fresh count from the DB: the sets liveQuery lags writes, so a
    // rapid double-tap (or a racing notification action) would otherwise
    // insert a duplicate setNumber.
    if (loggingRef.current) return
    loggingRef.current = true
    try {
      const dbSets = await setsForSession(session.id)
      const perExercise = (id: string) => dbSets.filter((s) => s.exerciseId === id).length
      const done = perExercise(current.exerciseId)
      if (done >= SETS_PER_EXERCISE) return
      const entry = {
        sessionId: session.id,
        exerciseId: current.exerciseId,
        setNumber: done + 1,
        weightKg: weight,
        reps,
        effort,
      }
      // PR check against all history before this set lands (mascot hook).
      const history = await db.setLogs.toArray()
      setLastWasPr(isPrSet(history, { ...entry, loggedAt: Date.now() }))
      await logSet(entry)
      const nowDone = done + 1
      if (nowDone >= SETS_PER_EXERCISE && exIdx < exercises.length - 1) {
        setExIdx(exIdx + 1) // per-exercise init effect resets weight/reps
      }
      setEffort('solid')
      // No rest after the workout's final set — the Finish CTA should be
      // immediately reachable, not buried under a 2-minute overlay.
      const workoutComplete = exercises.every(
        (e) => (e.exerciseId === current.exerciseId ? nowDone : perExercise(e.exerciseId)) >= SETS_PER_EXERCISE,
      )
      if (!workoutComplete) timer.start(REST_SECONDS)
    } finally {
      loggingRef.current = false
    }
  }

  async function finish(discard = false) {
    timer.skip()
    await closeRestNotification()
    await endSession(session!.id!, discard || (sets?.length ?? 0) === 0 ? 'discarded' : 'completed')
    navigate('/')
  }

  const toggleNotifications = async () => {
    if (notifOn) {
      setNotifOn(false)
      await kvSet('notif.enabled', false)
      await closeRestNotification()
      return
    }
    const ok = await requestNotificationPermission()
    setNotifOn(ok)
    await kvSet('notif.enabled', ok)
    // A previously-denied permission can only be re-enabled from OS settings
    // — say so instead of silently doing nothing.
    setNotifBlocked(!ok && typeof Notification !== 'undefined' && Notification.permission === 'denied')
  }

  const lastLog = sets[sets.length - 1]
  const weightLabel = weight % 1 === 0 ? String(weight) : weight.toFixed(1)

  return (
    <div className="screen">
      <div className="live-header">
        <button className="chip" onClick={() => void finish()}>✕ End</button>
        <div className="live-label">{session.name.toUpperCase()} · LIVE</div>
        <button
          className={`chip${notifOn ? ' live-widget-on' : ''}`}
          onClick={() => void toggleNotifications()}
          disabled={!notificationsSupported()}
        >
          Widget
        </button>
      </div>

      {notifBlocked && (
        <div className="live-notif-blocked">
          Notifications are blocked for REPZ — enable them in your phone's Settings to get rest-timer
          controls in the notification bar.
        </div>
      )}

      <div className="live-chips">
        {exercises.map((e, i) => (
          <button
            key={e.exerciseId}
            className={`live-chip${i === exIdx ? ' live-chip-on' : ''}`}
            onClick={() => setExIdx(i)}
          >
            {e.name.split(' ').slice(0, 2).join(' ')} {doneFor(e.exerciseId)}/{SETS_PER_EXERCISE}
          </button>
        ))}
      </div>

      <div>
        <div className="live-ex-name">{current!.name}</div>
        <div className="live-set-label">
          Set {setNumber} of {SETS_PER_EXERCISE} · {HYPE[(setNumber - 1) % HYPE.length]}
        </div>
        {suggestion && <div className="live-suggestion">{suggestion.note}</div>}
      </div>

      <div className="live-grid">
        <div className="live-stat-card">
          <div className="live-stat-label">WEIGHT</div>
          {usesBarbell(current) ? (
            <button className="live-numeral numeral" onClick={() => setPlateOpen(true)} aria-label="Plate calculator">
              {weightLabel}
              <span className="live-unit"> kg</span>
            </button>
          ) : (
            <div className="live-numeral numeral live-numeral-static">
              {isBodyweight(current) && weight === 0 ? 'BW' : weightLabel}
              {!(isBodyweight(current) && weight === 0) && <span className="live-unit"> kg</span>}
            </div>
          )}
          <div className="live-steppers">
            <button className="live-step" aria-label="Decrease weight" onClick={() => setWeight((w) => Math.max(0, Math.round((w - 2.5) * 10) / 10))}>−</button>
            <button className="live-step live-step-up" aria-label="Increase weight" onClick={() => setWeight((w) => Math.round((w + 2.5) * 10) / 10)}>+</button>
          </div>
        </div>
        <div className="live-stat-card">
          <div className="live-stat-label">REPS</div>
          <div className="live-numeral numeral">{reps}</div>
          <div className="live-steppers">
            <button className="live-step" aria-label="Decrease reps" onClick={() => setReps((r) => Math.max(1, r - 1))}>−</button>
            <button className="live-step live-step-up" aria-label="Increase reps" onClick={() => setReps((r) => r + 1)}>+</button>
          </div>
        </div>
      </div>

      <div>
        <div className="live-rir-label">HOW HARD WAS THAT LAST REP?</div>
        <div className="live-rir-row">
          {([
            ['more', 'Could do more', '2+ in tank'],
            ['solid', 'Solid', '1 left'],
            ['barely', 'Barely', '0 left'],
          ] as [Effort, string, string][]).map(([id, label, sub]) => (
            <button
              key={id}
              className={`live-rir${effort === id ? ' live-rir-on' : ''}`}
              onClick={() => setEffort(id)}
            >
              {label}
              <span className="live-rir-sub">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {allDone ? (
        <button className="live-log-btn" onClick={() => void finish()}>
          Finish workout ✓
        </button>
      ) : (
        <button className="live-log-btn" onClick={() => void doLogSet()}>
          Log set · start rest
        </button>
      )}

      {sets.length > 0 && (
        <div className="live-logged">
          {[...sets].slice(-5).reverse().map((l) => (
            <div key={l.id} className="live-logged-row">
              <div className="live-logged-set">SET {l.setNumber}</div>
              <div className="live-logged-val numeral">{l.weightKg} kg × {l.reps}</div>
              <div className={`live-logged-tag${l.effort === 'barely' ? ' live-logged-tag-warn' : ''}`}>
                {l.effort === 'more' ? 'COULD DO MORE' : l.effort.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {resting && (
        <RestOverlay
          remainingSec={restState.remainingSec}
          totalSec={restState.totalSec}
          loggedLabel={lastLog ? `${lastLog.weightKg} KG × ${lastLog.reps}` : 'SET'}
          nextUp={`Next: set ${setNumber} of ${SETS_PER_EXERCISE} — ${current!.name}`}
          isPr={lastWasPr}
          onExtend={() => timer.extend(30)}
          onSkip={() => timer.skip()}
        />
      )}

      {plateOpen && <PlateSheet totalKg={weight} onClose={() => setPlateOpen(false)} />}
    </div>
  )
}
