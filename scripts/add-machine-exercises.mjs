#!/usr/bin/env node
/**
 * Merge machine & cable exercises from free-exercise-db into the catalog.
 *
 * Why: the ExerciseDB free tier ships only 1 machine + 3 cable exercises, and
 * its Pro tier ($100/month) caps the library at 500 with no guarantee of
 * better machine coverage. free-exercise-db is public domain (Unlicense),
 * needs no key or quota, and carries 67 machine + 81 cable exercises.
 *
 * Images are downloaded and re-encoded locally rather than hotlinked, so the
 * catalog stays fully offline-capable (cross-origin images would never enter
 * the service worker's precache) and we don't lean on someone else's
 * bandwidth.
 *
 * Idempotent: re-running replaces previously merged records rather than
 * duplicating them.
 *
 *   node scripts/add-machine-exercises.mjs            # merge (downloads once)
 *   node scripts/add-machine-exercises.mjs --dry-run  # report, write nothing
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'data')
const IMG_DIR = path.join(OUT_DIR, 'exercise-images')
const CATALOG = path.join(OUT_DIR, 'exercises.json')
const META = path.join(OUT_DIR, 'exercises-meta.json')
const CACHE = path.join(ROOT, 'scripts', '.free-db-cache.json')

const SOURCE = 'free-exercise-db'
const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

/** Equipment we want from this dataset — the gap in our catalog. */
const EQUIPMENT_MAP = {
  machine: ['LEVERAGE MACHINE'],
  cable: ['CABLE'],
}

/** Only real resistance work; skip stretching/cardio/plyometrics. */
const KEEP_CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting'])

/** free-exercise-db muscle names → the catalog's canonical UPPERCASE names
 *  (the same taxonomy src/lib/slots.ts builds its slots from). Some are
 *  refined by exercise name below. */
const MUSCLE_MAP = {
  chest: ['PECTORALIS MAJOR STERNAL HEAD'],
  shoulders: ['ANTERIOR DELTOID'],
  triceps: ['TRICEPS BRACHII'],
  biceps: ['BICEPS BRACHII'],
  forearms: ['BRACHIORADIALIS'],
  lats: ['LATISSIMUS DORSI'],
  'middle back': ['TRAPEZIUS MIDDLE FIBERS', 'TERES MAJOR'],
  traps: ['TRAPEZIUS UPPER FIBERS'],
  'lower back': ['ERECTOR SPINAE'],
  quadriceps: ['QUADRICEPS'],
  hamstrings: ['HAMSTRINGS'],
  glutes: ['GLUTEUS MAXIMUS'],
  calves: ['GASTROCNEMIUS'],
  abdominals: ['RECTUS ABDOMINIS'],
  abductors: ['GLUTEUS MEDIUS'],
  adductors: ['ADDUCTOR BREVIS'],
  neck: ['STERNOCLEIDOMASTOID'],
}

const BODY_PART_MAP = {
  chest: 'CHEST', shoulders: 'SHOULDERS', triceps: 'TRICEPS', biceps: 'BICEPS',
  forearms: 'FOREARMS', lats: 'BACK', 'middle back': 'BACK', traps: 'BACK',
  'lower back': 'BACK', quadriceps: 'QUADRICEPS', hamstrings: 'HAMSTRINGS',
  glutes: 'HIPS', calves: 'CALVES', abdominals: 'WAIST', abductors: 'HIPS',
  adductors: 'HIPS', neck: 'NECK',
}

/** The dataset's muscle labels are coarse; the exercise name carries the
 *  detail a slot-based builder needs (upper vs lower chest, delt heads,
 *  gastroc vs soleus). */
function refineMuscles(name, muscles) {
  const n = name.toLowerCase()
  const out = new Set()
  for (const m of muscles) {
    if (m === 'chest') {
      out.add(/incline|upward|low.*to.*high/.test(n)
        ? 'PECTORALIS MAJOR CLAVICULAR HEAD'
        : 'PECTORALIS MAJOR STERNAL HEAD')
      continue
    }
    if (m === 'shoulders') {
      if (/lateral|side|raise/.test(n) && !/front|rear/.test(n)) out.add('LATERAL DELTOID')
      else if (/rear|reverse|bent.?over|face pull/.test(n)) out.add('POSTERIOR DELTOID')
      else out.add('ANTERIOR DELTOID')
      continue
    }
    if (m === 'calves') {
      out.add(/seated/.test(n) ? 'SOLEUS' : 'GASTROCNEMIUS')
      continue
    }
    for (const mapped of MUSCLE_MAP[m] ?? []) out.add(mapped)
  }
  return [...out]
}

async function loadSource() {
  if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, 'utf8'))
  console.log('Downloading free-exercise-db…')
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`dataset download failed: ${res.status}`)
  const data = await res.json()
  writeFileSync(CACHE, JSON.stringify(data))
  return data
}

/** Download + re-encode one image; returns the catalog-relative path. */
async function localImage(exerciseId, remotePath) {
  const outName = `${exerciseId}.webp`
  const outPath = path.join(IMG_DIR, outName)
  const rel = `data/exercise-images/${outName}`
  if (existsSync(outPath)) return rel

  const res = await fetch(IMG_BASE + remotePath)
  if (!res.ok) return undefined
  const tmp = path.join(IMG_DIR, `${exerciseId}.tmp`)
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  try {
    // 480px wide webp keeps the whole set a few MB so it can live in the
    // service worker precache alongside everything else.
    execFileSync('magick', [tmp, '-resize', '480x', '-quality', '80', outPath], { stdio: 'ignore' })
    return rel
  } catch {
    return undefined
  } finally {
    rmSync(tmp, { force: true })
  }
}

const dryRun = process.argv.includes('--dry-run')
const raw = await loadSource()

const wanted = raw.filter(
  (e) => EQUIPMENT_MAP[e.equipment] && KEEP_CATEGORIES.has(e.category),
)
console.log(`${raw.length} source exercises → ${wanted.length} machine/cable strength movements`)

if (dryRun) {
  const byEq = {}
  wanted.forEach((e) => (byEq[e.equipment] = (byEq[e.equipment] ?? 0) + 1))
  console.log('by equipment:', byEq)
  const unmapped = new Set()
  wanted.forEach((e) => e.primaryMuscles.forEach((m) => !MUSCLE_MAP[m] && unmapped.add(m)))
  console.log('unmapped muscles:', [...unmapped].join(', ') || 'none')
  process.exit(0)
}

mkdirSync(IMG_DIR, { recursive: true })

const records = []
let withImage = 0
for (const [i, e] of wanted.entries()) {
  const exerciseId = `fdb_${e.id}`
  const targetMuscles = refineMuscles(e.name, e.primaryMuscles)
  if (targetMuscles.length === 0) continue // nothing our slots could use

  const imageUrl = e.images?.[0] ? await localImage(exerciseId, e.images[0]) : undefined
  if (imageUrl) withImage++

  records.push({
    exerciseId,
    name: e.name,
    equipments: EQUIPMENT_MAP[e.equipment],
    bodyParts: [...new Set(e.primaryMuscles.map((m) => BODY_PART_MAP[m]).filter(Boolean))],
    exerciseType: 'STRENGTH',
    targetMuscles,
    secondaryMuscles: refineMuscles(e.name, e.secondaryMuscles ?? []),
    instructions: e.instructions ?? [],
    exerciseTips: [],
    variations: [],
    relatedExerciseIds: [],
    imageUrl,
    source: SOURCE,
  })
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${wanted.length} processed…`)
}

// Merge: drop any previous records from this source, then append.
const existing = existsSync(CATALOG) ? JSON.parse(readFileSync(CATALOG, 'utf8')) : []
const kept = existing.filter((e) => e.source !== SOURCE)
const merged = [...kept, ...records].sort((a, b) =>
  a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0,
)

const json = JSON.stringify(merged)
writeFileSync(CATALOG, json)
writeFileSync(
  META,
  JSON.stringify({
    version: createHash('sha256').update(json).digest('hex').slice(0, 12),
    count: merged.length,
    generatedAt: new Date().toISOString(),
    sources: [
      { name: 'ExerciseDB v2 (AscendAPI via RapidAPI)', count: kept.length },
      { name: 'free-exercise-db (Unlicense/public domain)', count: records.length },
    ],
  }),
)

const machines = records.filter((r) => r.equipments.includes('LEVERAGE MACHINE')).length
console.log(
  `\nMerged ${records.length} exercises (${machines} machine, ${records.length - machines} cable), ` +
    `${withImage} with images.\nCatalog: ${kept.length} + ${records.length} = ${merged.length} ` +
    `(${(json.length / 1024).toFixed(0)} KB)`,
)
