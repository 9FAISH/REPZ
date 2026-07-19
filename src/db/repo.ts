import { db } from './db'
import type {
  Profile,
  EquipmentItem,
  Exercise,
  WorkoutTemplate,
  WorkoutSession,
  SetLog,
  WeighIn,
  NutritionEntry,
  DayType,
  TemplateSlot,
} from './types'

/** Typed data-access helpers. Screens call these — never Dexie directly —
 *  so later phases can evolve storage without touching UI code. */

const now = () => Date.now()

/** Local calendar date as 'YYYY-MM-DD' (weigh-ins/nutrition are day-keyed). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Profile ──
export const getProfile = () => db.profile.get('main')

export async function saveProfile(data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>) {
  const existing = await getProfile()
  const profile: Profile = {
    ...data,
    id: 'main',
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  }
  await db.profile.put(profile)
  return profile
}

export const hasProfile = async () => (await db.profile.count()) > 0

/** First-run finalization: profile + equipment in ONE transaction, so an
 *  interrupt can never leave a profile without an equipment inventory
 *  (setup is unreachable once a profile exists). */
export const completeSetup = (
  profileData: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>,
  equipment: EquipmentItem[],
) =>
  db.transaction('rw', db.profile, db.equipment, async () => {
    await saveProfile(profileData)
    await replaceEquipment(equipment)
  })

// ── Equipment ──
export const listEquipment = () => db.equipment.toArray()

export const setEquipmentAvailable = (name: string, available: boolean) =>
  db.equipment.put({ name, available, updatedAt: now() })

export async function availableEquipmentNames(): Promise<Set<string>> {
  const items = await db.equipment.toArray()
  return new Set(items.filter((e) => e.available).map((e) => e.name))
}

export const replaceEquipment = (items: EquipmentItem[]) =>
  db.transaction('rw', db.equipment, async () => {
    await db.equipment.clear()
    await db.equipment.bulkPut(items)
  })

// ── Workout drafts (the in-progress build for a day type, kv-backed) ──
const draftKey = (dayType: DayType) => `draft.${dayType}`

export const getDraft = async (dayType: DayType) =>
  (await db.kv.get(draftKey(dayType)))?.value as TemplateSlot[] | undefined

export const saveDraft = (dayType: DayType, slots: TemplateSlot[]) =>
  db.kv.put({ key: draftKey(dayType), value: slots })

// ── Exercises (read-only catalog, seeded from static JSON) ──
export const getExercise = (exerciseId: string) => db.exercises.get(exerciseId)

export const exerciseCount = () => db.exercises.count()

export const exercisesByTargetMuscle = (muscle: string): Promise<Exercise[]> =>
  db.exercises.where('targetMuscles').equals(muscle).toArray()

export const exercisesByBodyPart = (bodyPart: string): Promise<Exercise[]> =>
  db.exercises.where('bodyParts').equals(bodyPart).toArray()

// ── Templates (saved workouts / favorites) ──
export const listTemplates = () => db.templates.orderBy('dayType').toArray()

export const listFavoriteTemplates = async () =>
  (await db.templates.toArray()).filter((t) => t.favorite)

export const getTemplate = (id: number) => db.templates.get(id)

export async function saveTemplate(t: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) {
  if (t.id != null) {
    const updated = await db.templates.update(t.id, { ...t, updatedAt: now() })
    if (updated === 0) throw new Error(`Template ${t.id} does not exist`)
    return t.id
  }
  return db.templates.add({ ...t, createdAt: now(), updatedAt: now() })
}

export const setTemplateFavorite = (id: number, favorite: boolean) =>
  db.templates.update(id, { favorite, updatedAt: now() })

export const deleteTemplate = (id: number) => db.templates.delete(id)

// ── Sessions + set logs ──
export async function startSession(input: {
  name: string
  dayType: DayType
  exerciseIds: string[]
  templateId?: number
}): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    // A stranded active session (app killed mid-workout) would otherwise
    // shadow every new one — discard any leftovers first.
    await db.sessions.where('status').equals('active').modify({ status: 'discarded', endedAt: now() })
    // Auto-increment add always assigns a key; Dexie just types it optional.
    return (await db.sessions.add({ ...input, status: 'active', startedAt: now() })) as number
  })
}

export const getActiveSession = () => db.sessions.where('status').equals('active').first()

export const endSession = (id: number, status: 'completed' | 'discarded' = 'completed') =>
  db.sessions.update(id, { status, endedAt: now() })

export const logSet = (entry: Omit<SetLog, 'id' | 'loggedAt'>) =>
  db.setLogs.add({ ...entry, loggedAt: now() })

export const setsForSession = (sessionId: number) =>
  db.setLogs.where('sessionId').equals(sessionId).sortBy('loggedAt')

export const setsForExercise = (exerciseId: string) =>
  db.setLogs.where('exerciseId').equals(exerciseId).sortBy('loggedAt')

/** The most recent past sets of an exercise outside the given session —
 *  feeds the progressive-overload suggestion. */
export async function previousSetsForExercise(
  exerciseId: string,
  excludeSessionId: number,
  limit = 3,
): Promise<SetLog[]> {
  const all = await db.setLogs.where('exerciseId').equals(exerciseId).sortBy('loggedAt')
  return all.filter((s) => s.sessionId !== excludeSessionId).slice(-limit)
}

export const listSessions = (status?: WorkoutSession['status']) =>
  status
    ? db.sessions.where('status').equals(status).reverse().sortBy('startedAt')
    : db.sessions.orderBy('startedAt').reverse().toArray()

// ── Weight log ──
/** Upsert today's (or the given day's) weigh-in — one entry per calendar day.
 *  Runs in a transaction so concurrent calls can't race the unique &date index. */
export function logWeighIn(weightKg: number, date = todayKey()) {
  return db.transaction('rw', db.weightLog, async () => {
    const existing = await db.weightLog.where('date').equals(date).first()
    if (existing) {
      await db.weightLog.update(existing.id!, { weightKg, loggedAt: now() })
      return existing.id!
    }
    return (await db.weightLog.add({ date, weightKg, loggedAt: now() })) as number
  })
}

export const listWeighIns = (): Promise<WeighIn[]> => db.weightLog.orderBy('date').toArray()

export const latestWeighIn = () => db.weightLog.orderBy('date').last()

// ── Nutrition log ──
export const logFood = (entry: Omit<NutritionEntry, 'id' | 'loggedAt'>) =>
  db.nutritionLog.add({ ...entry, loggedAt: now() })

export const foodForDay = (date = todayKey()): Promise<NutritionEntry[]> =>
  db.nutritionLog.where('date').equals(date).sortBy('loggedAt')

export async function dayTotals(date = todayKey()) {
  const entries = await foodForDay(date)
  return entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, proteinG: acc.proteinG + e.proteinG }),
    { kcal: 0, proteinG: 0 },
  )
}

export const deleteFood = (id: number) => db.nutritionLog.delete(id)

// ── Activity (streak sources) ──
/** Distinct local days ('YYYY-MM-DD') with any logged activity:
 *  a logged set, a weigh-in, or a food entry. */
export async function activityDates(): Promise<Set<string>> {
  const [sets, weighs, foods] = await Promise.all([
    db.setLogs.toArray(),
    db.weightLog.toArray(),
    db.nutritionLog.toArray(),
  ])
  const days = new Set<string>()
  for (const s of sets) days.add(todayKey(new Date(s.loggedAt)))
  for (const w of weighs) days.add(w.date)
  for (const f of foods) days.add(f.date)
  return days
}

// ── KV (dataset version, adaptive targets, misc flags) ──
export const kvGet = async <T>(key: string): Promise<T | undefined> =>
  (await db.kv.get(key))?.value as T | undefined

export const kvSet = (key: string, value: unknown) => db.kv.put({ key, value })
