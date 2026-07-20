import { db } from '../db/db'
import type {
  EquipmentItem,
  KVEntry,
  NutritionEntry,
  Profile,
  SetLog,
  WeighIn,
  WorkoutSession,
  WorkoutTemplate,
} from '../db/types'

/** JSON backup/restore. This phone holds the only copy of the data, so the
 *  export is a complete, human-readable snapshot of every user table.
 *  The exercise catalog is deliberately excluded — it re-seeds from the
 *  committed static JSON. */

export const BACKUP_VERSION = 1

export interface BackupFile {
  format: 'repz-backup'
  version: number
  exportedAt: string
  data: {
    profile: Profile[]
    equipment: EquipmentItem[]
    templates: WorkoutTemplate[]
    sessions: WorkoutSession[]
    setLogs: SetLog[]
    weightLog: WeighIn[]
    nutritionLog: NutritionEntry[]
    kv: KVEntry[]
  }
}

export async function exportBackup(): Promise<BackupFile> {
  const [profile, equipment, templates, sessions, setLogs, weightLog, nutritionLog, kv] =
    await Promise.all([
      db.profile.toArray(),
      db.equipment.toArray(),
      db.templates.toArray(),
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.weightLog.toArray(),
      db.nutritionLog.toArray(),
      db.kv.toArray(),
    ])
  return {
    format: 'repz-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { profile, equipment, templates, sessions, setLogs, weightLog, nutritionLog, kv },
  }
}

/** Trigger a file download of the backup (iOS Safari routes this through
 *  the share sheet / Files app). */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `repz-backup-${backup.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next task so Safari has committed the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export class BackupError extends Error {}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupError("That file isn't valid JSON.")
  }
  const b = parsed as Partial<BackupFile>
  if (b?.format !== 'repz-backup') throw new BackupError("That doesn't look like a REPZ backup.")
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('That backup came from a newer version of REPZ.')
  }
  if (!b.data || typeof b.data !== 'object') throw new BackupError('The backup file has no data.')
  return b as BackupFile
}

export interface RestoreCounts {
  profile: number
  equipment: number
  templates: number
  sessions: number
  setLogs: number
  weightLog: number
  nutritionLog: number
  kv: number
}

/** REPLACES all local user data with the backup's contents, in one
 *  transaction — a partial restore would be worse than none. */
export async function restoreBackup(backup: BackupFile): Promise<RestoreCounts> {
  const d = backup.data
  await db.transaction(
    'rw',
    [db.profile, db.equipment, db.templates, db.sessions, db.setLogs, db.weightLog, db.nutritionLog, db.kv],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.equipment.clear(),
        db.templates.clear(),
        db.sessions.clear(),
        db.setLogs.clear(),
        db.weightLog.clear(),
        db.nutritionLog.clear(),
        db.kv.clear(),
      ])
      await Promise.all([
        db.profile.bulkPut(d.profile ?? []),
        db.equipment.bulkPut(d.equipment ?? []),
        db.templates.bulkPut(d.templates ?? []),
        db.sessions.bulkPut(d.sessions ?? []),
        db.setLogs.bulkPut(d.setLogs ?? []),
        db.weightLog.bulkPut(d.weightLog ?? []),
        db.nutritionLog.bulkPut(d.nutritionLog ?? []),
        db.kv.bulkPut(d.kv ?? []),
      ])
    },
  )
  return {
    profile: d.profile?.length ?? 0,
    equipment: d.equipment?.length ?? 0,
    templates: d.templates?.length ?? 0,
    sessions: d.sessions?.length ?? 0,
    setLogs: d.setLogs?.length ?? 0,
    weightLog: d.weightLog?.length ?? 0,
    nutritionLog: d.nutritionLog?.length ?? 0,
    kv: d.kv?.length ?? 0,
  }
}
