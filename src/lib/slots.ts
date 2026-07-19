import type { DayType, Exercise, TemplateSlot } from '../db/types'

/** Muscle sub-region slots per session day type. Region labels follow the
 *  design; muscle lists use the API's canonical UPPERCASE targetMuscles
 *  (validated against the committed catalog's actual coverage). */
export interface SlotDef {
  region: string
  muscles: string[]
}

const CHEST_UPPER = ['PECTORALIS MAJOR CLAVICULAR HEAD']
const CHEST_LOWER = ['PECTORALIS MAJOR STERNAL HEAD']
const DELT_FRONT = ['ANTERIOR DELTOID']
const DELT_SIDE = ['LATERAL DELTOID']
const DELT_REAR = ['POSTERIOR DELTOID']
const TRICEPS = ['TRICEPS BRACHII']
const BICEPS = ['BICEPS BRACHII', 'BRACHIALIS']
const LATS = ['LATISSIMUS DORSI']
const UPPER_BACK = ['TRAPEZIUS MIDDLE FIBERS', 'TRAPEZIUS LOWER FIBERS', 'TERES MAJOR', 'TERES MINOR', 'INFRASPINATUS']
const LOWER_BACK = ['ERECTOR SPINAE']
const QUADS = ['QUADRICEPS']
const HAMSTRINGS = ['HAMSTRINGS']
const GLUTES = ['GLUTEUS MAXIMUS', 'GLUTEUS MEDIUS']
const CALVES = ['GASTROCNEMIUS', 'SOLEUS']
const CORE = ['RECTUS ABDOMINIS', 'OBLIQUES']

export const SLOT_DEFS: Record<DayType, SlotDef[]> = {
  push: [
    { region: 'Upper chest', muscles: CHEST_UPPER },
    { region: 'Lower chest', muscles: CHEST_LOWER },
    { region: 'Front delts', muscles: DELT_FRONT },
    { region: 'Side delts', muscles: DELT_SIDE },
    { region: 'Triceps', muscles: TRICEPS },
  ],
  pull: [
    { region: 'Lats', muscles: LATS },
    { region: 'Upper back', muscles: UPPER_BACK },
    { region: 'Rear delts', muscles: DELT_REAR },
    { region: 'Biceps', muscles: BICEPS },
    { region: 'Lower back', muscles: LOWER_BACK },
  ],
  legs: [
    { region: 'Quads', muscles: QUADS },
    { region: 'Hamstrings', muscles: HAMSTRINGS },
    { region: 'Glutes', muscles: GLUTES },
    { region: 'Calves', muscles: CALVES },
    { region: 'Core', muscles: CORE },
  ],
  upper: [
    { region: 'Chest', muscles: [...CHEST_UPPER, ...CHEST_LOWER] },
    { region: 'Back', muscles: [...LATS, ...UPPER_BACK] },
    { region: 'Shoulders', muscles: [...DELT_FRONT, ...DELT_SIDE, ...DELT_REAR] },
    { region: 'Biceps', muscles: BICEPS },
    { region: 'Triceps', muscles: TRICEPS },
  ],
  lower: [
    { region: 'Quads', muscles: QUADS },
    { region: 'Hamstrings', muscles: HAMSTRINGS },
    { region: 'Glutes', muscles: GLUTES },
    { region: 'Calves', muscles: CALVES },
    { region: 'Core', muscles: CORE },
  ],
  full: [
    { region: 'Chest', muscles: [...CHEST_UPPER, ...CHEST_LOWER] },
    { region: 'Back', muscles: [...LATS, ...UPPER_BACK] },
    { region: 'Legs', muscles: [...QUADS, ...GLUTES, ...HAMSTRINGS] },
    { region: 'Shoulders', muscles: [...DELT_FRONT, ...DELT_SIDE, ...DELT_REAR] },
    { region: 'Core', muscles: CORE },
  ],
}

export const emptySlots = (dayType: DayType): TemplateSlot[] =>
  SLOT_DEFS[dayType].map((s) => ({ region: s.region, exerciseId: null }))

/** Does the exercise's full equipment list pass the availability set? */
export const equipmentOk = (ex: Exercise, available: Set<string>) =>
  ex.equipments.every((q) => available.has(q))

/** The API labels some stretches/mobility drills as STRENGTH — keep them in
 *  the catalog but out of workout-building pools. */
export const isBuildable = (ex: Exercise) => !/stretch|mobility|warm.?up/i.test(ex.name)

/** Rank candidates for auto-fill and picker ordering: media-rich, canonical
 *  movement names first. */
export function rankExercise(ex: Exercise): number {
  let score = 0
  if (ex.imageUrl || ex.imageUrls) score += 4
  if (ex.videoUrl) score += 2
  if (ex.exerciseTips.length) score += 2
  score -= ex.name.split(/\s+/).length
  if (/\b(press|squat|deadlift|row|pull.?up|chin.?up|curl|extension|raise|fly|dip|lunge|thrust|pulldown|pushdown|crunch|plank)\b/i.test(ex.name)) {
    score += 4
  }
  return score
}
