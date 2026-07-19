import type { EquipmentItem } from '../db/types'

/** UI equipment toggles (design's inventory grid) mapped onto the API's
 *  canonical equipment names (UPPERCASE, from taxonomy.json). Exercises are
 *  filtered against the flat name set, so a family toggle flips all of its
 *  member names at once. */
export interface EquipmentFamily {
  id: string
  label: string
  members: string[]
  defaultOn: boolean
}

export const EQUIPMENT_FAMILIES: EquipmentFamily[] = [
  { id: 'barbell', label: 'Barbell', members: ['BARBELL', 'EZ BARBELL', 'OLYMPIC BARBELL', 'TRAP BAR'], defaultOn: false },
  { id: 'dumbbells', label: 'Dumbbells', members: ['DUMBBELL'], defaultOn: true },
  { id: 'cables', label: 'Cables', members: ['CABLE', 'ROPE'], defaultOn: true },
  { id: 'machines', label: 'Machines', members: ['LEVERAGE MACHINE', 'SLED MACHINE', 'SMITH MACHINE', 'POWER SLED', 'ASSISTED'], defaultOn: true },
  { id: 'bodyweight', label: 'Bodyweight', members: ['BODY WEIGHT'], defaultOn: true },
  { id: 'kettlebells', label: 'Kettlebells', members: ['KETTLEBELL'], defaultOn: false },
  { id: 'bands', label: 'Bands', members: ['BAND', 'RESISTANCE BAND', 'SUSPENSION'], defaultOn: false },
  {
    id: 'other',
    label: 'Other gear',
    members: ['WEIGHTED', 'MEDICINE BALL', 'STABILITY BALL', 'BOSU BALL', 'BATTLING ROPE', 'HAMMER', 'WHEEL ROLLER', 'ROLL', 'ROLLBALL', 'STICK', 'VIBRATE PLATE'],
    defaultOn: false,
  },
]

export const defaultFamilyStates = (): Record<string, boolean> =>
  Object.fromEntries(EQUIPMENT_FAMILIES.map((f) => [f.id, f.defaultOn]))

/** Expand family toggle states into per-API-name equipment rows for Dexie. */
export function familyStatesToItems(states: Record<string, boolean>): EquipmentItem[] {
  const at = Date.now()
  return EQUIPMENT_FAMILIES.flatMap((f) =>
    f.members.map((name) => ({ name, available: !!states[f.id], updatedAt: at })),
  )
}

/** Recover family toggle states from stored equipment rows (a family is on
 *  when any of its members is available). */
export function itemsToFamilyStates(items: EquipmentItem[]): Record<string, boolean> {
  const avail = new Set(items.filter((i) => i.available).map((i) => i.name))
  return Object.fromEntries(EQUIPMENT_FAMILIES.map((f) => [f.id, f.members.some((m) => avail.has(m))]))
}
