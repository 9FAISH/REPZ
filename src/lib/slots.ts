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

/** The staple movements a lifter actually expects a slot to auto-fill with.
 *  Matching on the whole phrase (not just "press") keeps obscure variants
 *  like "Neck Press" or "Board Press" from outranking "Bench Press". */
const STAPLE_MOVEMENTS =
  /\b(bench press|chest press|incline press|shoulder press|overhead press|military press|leg press|chest fly|pec deck|cable crossover|lat pulldown|pulldown|pull.?up|chin.?up|seated row|bent.?over row|barbell row|dumbbell row|cable row|deadlift|romanian deadlift|back squat|front squat|squat|lunge|leg extension|leg curl|calf raise|hip thrust|bicep curl|hammer curl|preacher curl|tricep extension|skullcrusher|pushdown|lateral raise|front raise|rear delt|face pull|shrug|crunch|leg raise|plank|dip)\b/i

/** Movements that are legitimate but rarely what someone wants auto-picked. */
const NICHE_MOVEMENTS = /\b(neck|anti.?gravity|board press|chain|sled|jump|clean|snatch|jerk|kipping|suicide|iron cross|bradford|zercher)\b/i

/** Rank candidates for auto-fill and picker ordering. */
export function rankExercise(ex: Exercise): number {
  let score = 0
  if (ex.imageUrl || ex.imageUrls) score += 3
  if (ex.videoUrl) score += 2
  if (ex.exerciseTips.length) score += 2
  if (STAPLE_MOVEMENTS.test(ex.name)) score += 10
  if (NICHE_MOVEMENTS.test(ex.name)) score -= 8
  if (ex.mechanic === 'compound') score += 2
  if (ex.level === 'beginner') score += 2
  else if (ex.level === 'expert') score -= 3
  // Mild tiebreak toward plainer names, not enough to beat a staple match.
  score -= ex.name.split(/\s+/).length * 0.5
  return score
}
