/** Exercise record from the committed static JSON (public/data/exercises.json),
 *  produced at build time by scripts/fetch-exercises.mjs from ExerciseDB v2. */
export interface Exercise {
  exerciseId: string
  name: string
  equipments: string[]
  bodyParts: string[]
  exerciseType: string
  targetMuscles: string[]
  secondaryMuscles: string[]
  overview?: string
  /** Step-by-step how-to. */
  instructions: string[]
  /** Form cues + mistake/injury warnings, rendered on the detail screen. */
  exerciseTips: string[]
  variations: string[]
  relatedExerciseIds: string[]
  /** Absolute CDN URL, or a catalog-relative path for bundled images. */
  imageUrl?: string
  imageUrls?: Partial<Record<'360p' | '480p' | '720p' | '1080p', string>>
  videoUrl?: string
  /** Provenance when the record came from a merged dataset. */
  source?: string
  /** Coaching metadata used to rank auto-fill picks. */
  level?: 'beginner' | 'intermediate' | 'expert'
  mechanic?: 'compound' | 'isolation'
}

export type Sex = 'male' | 'female'
export type Goal = 'bulk' | 'cut'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Split = 'full_body' | 'upper_lower' | 'ppl'
/** Session day types across the supported splits. */
export type DayType = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'

/** Singleton user profile (id is always 'main') — no accounts, local only. */
export interface Profile {
  id: 'main'
  name?: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goal: Goal
  activityLevel: ActivityLevel
  split: Split
  daysPerWeek: 3 | 4 | 5
  createdAt: number
  updatedAt: number
}

/** One toggleable gym-equipment family (canonical API equipment name). */
export interface EquipmentItem {
  name: string
  available: boolean
  updatedAt: number
}

/** A muscle sub-region slot inside a template (e.g. "Upper chest"). */
export interface TemplateSlot {
  region: string
  exerciseId: string | null
}

/** Saved workout ("favorites" live here via the favorite flag). */
export interface WorkoutTemplate {
  id?: number
  name: string
  dayType: DayType
  slots: TemplateSlot[]
  favorite: boolean
  createdAt: number
  updatedAt: number
}

export type SessionStatus = 'active' | 'completed' | 'discarded'

/** One live/completed workout run. */
export interface WorkoutSession {
  id?: number
  templateId?: number
  name: string
  dayType: DayType
  exerciseIds: string[]
  status: SessionStatus
  startedAt: number
  endedAt?: number
}

/** RIR-style effort rating: 2+ left / 1 left / 0 left. */
export type Effort = 'more' | 'solid' | 'barely'

export interface SetLog {
  id?: number
  sessionId: number
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  effort: Effort
  loggedAt: number
}

/** Daily weigh-in; date is a unique 'YYYY-MM-DD' key (one per day). */
export interface WeighIn {
  id?: number
  date: string
  weightKg: number
  loggedAt: number
}

/** One logged food item. */
export interface NutritionEntry {
  id?: number
  date: string
  name: string
  kcal: number
  proteinG: number
  loggedAt: number
}

/** Small key-value store: dataset version, adaptive targets, flags. */
export interface KVEntry {
  key: string
  value: unknown
}
