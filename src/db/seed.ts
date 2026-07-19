import { db } from './db'
import { kvGet, kvSet } from './repo'
import type { Exercise } from './types'

const VERSION_KEY = 'exercises.datasetVersion'

interface DatasetMeta {
  version: string
  count: number
  generatedAt: string
}

/** Seed/refresh the exercise catalog from the committed static JSON.
 *  Runs at boot, is a no-op when the stored version matches, and fails
 *  soft (app still works, catalog just stays empty/stale) if the JSON
 *  is absent — e.g. before the first build-time fetch has been run. */
export async function seedExercises(): Promise<void> {
  const base = import.meta.env.BASE_URL
  try {
    const metaRes = await fetch(`${base}data/exercises-meta.json`)
    if (!metaRes.ok) throw new Error(`meta ${metaRes.status}`)
    const meta = (await metaRes.json()) as DatasetMeta

    const current = await kvGet<string>(VERSION_KEY)
    if (current === meta.version) return

    const dataRes = await fetch(`${base}data/exercises.json`)
    if (!dataRes.ok) throw new Error(`data ${dataRes.status}`)
    const exercises = (await dataRes.json()) as Exercise[]

    await db.transaction('rw', db.exercises, db.kv, async () => {
      await db.exercises.clear()
      await db.exercises.bulkPut(exercises)
      await kvSet(VERSION_KEY, meta.version)
    })
    console.info(`[repz] exercise catalog seeded: ${exercises.length} (v${meta.version})`)
  } catch (err) {
    console.info('[repz] exercise catalog unavailable (run npm run fetch:exercises)', err)
  }
}
