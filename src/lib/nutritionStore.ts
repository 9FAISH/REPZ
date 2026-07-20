import { kvGet, kvSet, listWeighIns } from '../db/repo'
import { ADAPT_KEY, decideAdaptation, type Adaptation } from './nutrition.ts'
import type { Profile } from '../db/types'

/** Dexie-backed side of the nutrition engine (the pure math lives in
 *  nutrition.ts so it stays testable outside the browser). */

export const getAdaptation = () => kvGet<Adaptation>(ADAPT_KEY)

/** Idempotent: safe to call on any screen mount. */
export async function maybeAdapt(profile: Profile): Promise<Adaptation | undefined> {
  const weighIns = await listWeighIns()
  const current = await getAdaptation()
  const next = decideAdaptation(profile.goal, weighIns, current)
  if (next) {
    await kvSet(ADAPT_KEY, next)
    return next
  }
  return current
}
