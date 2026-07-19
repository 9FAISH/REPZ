import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  Profile,
  EquipmentItem,
  WorkoutTemplate,
  WorkoutSession,
  SetLog,
  WeighIn,
  NutritionEntry,
  KVEntry,
} from './types'

/** REPZ local database — the single source of truth for all user data.
 *  Local-first: no backend, no accounts; everything lives in IndexedDB. */
class RepzDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  equipment!: EntityTable<EquipmentItem, 'name'>
  exercises!: EntityTable<Exercise, 'exerciseId'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  weightLog!: EntityTable<WeighIn, 'id'>
  nutritionLog!: EntityTable<NutritionEntry, 'id'>
  kv!: EntityTable<KVEntry, 'key'>

  constructor() {
    super('repz')
    this.version(1).stores({
      // Only indexed fields are listed; full objects are stored regardless.
      profile: 'id',
      equipment: 'name',
      exercises: 'exerciseId, *targetMuscles, *bodyParts, *equipments, exerciseType',
      // no index on `favorite`: booleans aren't valid IndexedDB keys
      templates: '++id, dayType',
      sessions: '++id, status, startedAt',
      setLogs: '++id, sessionId, exerciseId, loggedAt',
      weightLog: '++id, &date',
      nutritionLog: '++id, date',
      kv: 'key',
    })
  }
}

export const db = new RepzDB()
