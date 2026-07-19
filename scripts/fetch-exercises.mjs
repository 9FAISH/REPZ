#!/usr/bin/env node
/**
 * Build-time ExerciseDB fetcher — SECURITY-CRITICAL DESIGN NOTE
 * ─────────────────────────────────────────────────────────────
 * The RapidAPI key must NEVER reach the browser. This script runs on a
 * developer machine (or CI with a secret), reads the key from a gitignored
 * .env, and writes static JSON into public/data/. The app only ever reads
 * that committed JSON — no runtime API calls, no runtime rate limits.
 *
 * Free-tier handling (ExerciseDB "Basic" plan via RapidAPI):
 *  - ~1,000 requests/hour cap → self-throttle (EXDB_REQS_PER_HOUR, default 800)
 *  - cursor pagination at max 25/page → full compact index ≈ 100–520 calls
 *  - full details cost 1 call per exercise → fetch details only for a ranked,
 *    capped subset of gym-relevant strength exercises (EXDB_DETAIL_CAP)
 *  - progress cache in scripts/.exdb-cache.json (gitignored): re-runs resume
 *    the list cursor and skip already-fetched details, so an interrupted run
 *    (or the hourly cap) never re-fetches what it already has
 *  - free-tier media is watermarked — URLs are stored as-is; the app resolves
 *    display URLs through src/lib/media.ts so a paid-tier swap is one line
 *
 * Usage:
 *   node scripts/fetch-exercises.mjs           # fetch (resumes automatically)
 *   node scripts/fetch-exercises.mjs --dry-run # validate config, show plan
 *   node scripts/fetch-exercises.mjs --status  # show cache progress
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE_FILE = path.join(ROOT, 'scripts', '.exdb-cache.json')
const OUT_DIR = path.join(ROOT, 'public', 'data')
const OUT_EXERCISES = path.join(OUT_DIR, 'exercises.json')
const OUT_META = path.join(OUT_DIR, 'exercises-meta.json')
const OUT_TAXONOMY = path.join(OUT_DIR, 'taxonomy.json')

// ── Config (all secrets/plan settings live in the gitignored .env) ──
try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  /* no .env — validated below */
}

function envNumber(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Invalid ${name}="${raw}" — must be a positive number (no separators).`)
    process.exit(1)
  }
  return n
}

const CONFIG = {
  key: process.env.RAPIDAPI_KEY,
  host: process.env.EXDB_HOST ?? 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com',
  reqsPerHour: envNumber('EXDB_REQS_PER_HOUR', 800),
  detailCap: envNumber('EXDB_DETAIL_CAP', 1000),
  pageLimit: Math.min(envNumber('EXDB_PAGE_LIMIT', 25), 25),
  // Observed free-tier behavior: the per-exercise detail endpoint has a burst
  // limit (~40 rapid calls trips a several-minute "MITIGATION_REDIRECT"
  // cooloff), so detail calls pace much slower than list calls.
  detailIntervalMs: envNumber('EXDB_DETAIL_INTERVAL_MS', 15_000),
}

// Equipment families the app supports (matched against the API's own
// equipment taxonomy at run time — names are not hardcoded).
const EQUIPMENT_MATCHERS = [
  /barbell/i, /ez barbell/i, /olympic barbell/i,
  /dumbbell/i,
  /cable/i,
  /machine/i, /smith/i, /sled/i, /leverage/i,
  /kettlebell/i,
  /band/i, /resistance/i,
  /body ?weight/i, /weighted/i, /pull ?up bar/i, /roller/i, /stability ball/i,
  /bench/i, /rope/i,
]

const MIN_INTERVAL_MS = Math.ceil(3_600_000 / CONFIG.reqsPerHour)

// ── Tiny utilities ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const EMPTY_CACHE = { list: {}, details: {}, failedDetails: {}, nextCursor: null, listComplete: false, taxonomy: null }

function loadCache() {
  if (!existsSync(CACHE_FILE)) return { ...EMPTY_CACHE }
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    console.warn('Cache file corrupt (interrupted write?) — starting fresh.')
    return { ...EMPTY_CACHE }
  }
}

function saveCache(cache) {
  // tmp + rename: atomic on the same filesystem, so an interrupt can
  // never leave a truncated cache behind.
  writeFileSync(`${CACHE_FILE}.tmp`, JSON.stringify(cache))
  renameSync(`${CACHE_FILE}.tmp`, CACHE_FILE)
}

let lastRequestAt = 0
let requestCount = 0
const MAX_ATTEMPTS = 4

async function api(pathname, params = {}, { intervalMs = MIN_INTERVAL_MS } = {}) {
  const wait = lastRequestAt + intervalMs - Date.now()
  if (wait > 0) await sleep(wait)

  const url = new URL(`https://${CONFIG.host}${pathname}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastRequestAt = Date.now()
    requestCount++
    // redirect: 'manual' — the API signals burst-mitigation with a 307 to an
    // unauthenticated host; following it would only bounce again. Treat any
    // redirect exactly like a 429 cooloff.
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'X-RapidAPI-Key': CONFIG.key,
        'X-RapidAPI-Host': CONFIG.host,
      },
    })
    const throttled = res.status === 429 || res.status >= 500 || (res.status >= 300 && res.status < 400)
    if (throttled) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 300_000)
        : Math.min(2 ** attempt * 5_000, 300_000)
      console.warn(`  ${res.status} on ${pathname} — backing off ${Math.round(backoff / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS})`)
      await sleep(backoff)
      continue
    }
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} on ${url.pathname} — ${(await res.text()).slice(0, 300)}`)
    }
    return res.json()
  }
  throw new Error(`Giving up on ${pathname} after ${MAX_ATTEMPTS} throttled attempts — re-run later, progress is cached.`)
}

// ── Stage 1: taxonomy (bodyparts / equipments / muscles / exercisetypes) ──
async function fetchTaxonomy(cache) {
  if (cache.taxonomy) return cache.taxonomy
  console.log('Stage 1/3 — fetching taxonomy…')
  const [bodyParts, equipments, muscles, exerciseTypes] = [
    (await api('/api/v1/bodyparts')).data,
    (await api('/api/v1/equipments')).data,
    (await api('/api/v1/muscles')).data,
    (await api('/api/v1/exercisetypes')).data,
  ]
  cache.taxonomy = { bodyParts, equipments, muscles, exerciseTypes }
  saveCache(cache)
  return cache.taxonomy
}

// ── Stage 2: complete compact index via cursor pagination ──
async function fetchIndex(cache) {
  if (cache.listComplete) {
    console.log(`Stage 2/3 — index already complete (${Object.keys(cache.list).length} exercises).`)
    return
  }
  console.log(`Stage 2/3 — fetching exercise index (resuming ${Object.keys(cache.list).length} cached)…`)
  let pages = 0
  for (;;) {
    const res = await api('/api/v1/exercises', {
      limit: CONFIG.pageLimit,
      after: cache.nextCursor ?? undefined,
    })
    for (const ex of res.data) cache.list[ex.exerciseId] = ex
    pages++
    if (!res.meta.hasNextPage) {
      cache.listComplete = true
      saveCache(cache)
      break
    }
    cache.nextCursor = res.meta.nextCursor
    // Save every page: with a ~4.5s throttle between requests, the file
    // write is free and an interrupt never loses fetched work.
    saveCache(cache)
    if (pages % 10 === 0) {
      console.log(`  ${Object.keys(cache.list).length}/${res.meta.total} indexed…`)
    }
  }
  console.log(`  index complete: ${Object.keys(cache.list).length} exercises.`)
}

// ── Stage 3: rank gym-relevant strength work, fetch full details for the top N ──
// v2 enums are UPPERCASE ('STRENGTH', 'DUMBBELL', …) — compare accordingly.
const GYM_EXERCISE_TYPES = new Set(['STRENGTH', 'WEIGHTLIFTING'])

function equipmentSupported(names) {
  return names.every((n) => EQUIPMENT_MATCHERS.some((rx) => rx.test(n)))
}

function rank(ex) {
  let score = 0
  if (ex.imageUrl) score += 4 // has media
  score -= ex.name.split(/\s+/).length // canonical movements have short names
  if (/\b(bench press|squat|deadlift|row|pull.?up|chin.?up|overhead|shoulder press|curl|extension|raise|fly|dip|lunge|hip thrust|pulldown|pushdown|press)\b/i.test(ex.name)) {
    score += 6 // core gym movement patterns
  }
  return score
}

function selectForDetails(cache) {
  const all = Object.values(cache.list)
  const eligible = all.filter(
    (ex) =>
      GYM_EXERCISE_TYPES.has(ex.exerciseType?.toUpperCase()) &&
      ex.equipments?.length &&
      equipmentSupported(ex.equipments),
  )
  eligible.sort((a, b) => rank(b) - rank(a))
  const chosen = eligible.slice(0, CONFIG.detailCap)
  console.log(
    `Stage 3/3 — ${all.length} total → ${eligible.length} gym-relevant strength; detailing top ${chosen.length} (cap ${CONFIG.detailCap}).`,
  )
  return chosen
}

async function fetchDetails(cache, chosen) {
  cache.failedDetails ??= {}
  // Some records are permanently blocked for free-tier detail access
  // (persistent MITIGATION_REDIRECT on one ID while neighbors succeed).
  // Skip an ID after it has failed across 2 separate runs — the exercise
  // still ships with its list-level data, just without tips/media detail.
  const pending = chosen.filter(
    (ex) => !cache.details[ex.exerciseId] && (cache.failedDetails[ex.exerciseId] ?? 0) < 2,
  )
  const skipped = chosen.filter((ex) => (cache.failedDetails[ex.exerciseId] ?? 0) >= 2).length
  console.log(
    `  ${chosen.length - pending.length - skipped} details cached, ${pending.length} to fetch` +
      (skipped ? `, ${skipped} skipped (blocked for this plan)…` : '…'),
  )
  let done = 0
  for (const ex of pending) {
    try {
      const res = await api(`/api/v1/exercises/${ex.exerciseId}`, {}, { intervalMs: CONFIG.detailIntervalMs })
      cache.details[ex.exerciseId] = res.data
      delete cache.failedDetails[ex.exerciseId]
    } catch (err) {
      cache.failedDetails[ex.exerciseId] = (cache.failedDetails[ex.exerciseId] ?? 0) + 1
      console.warn(`  detail unavailable for ${ex.exerciseId} (${ex.name}) — continuing: ${err.message.slice(0, 80)}`)
    }
    saveCache(cache)
    done++
    if (done % 20 === 0) console.log(`  ${done}/${pending.length} details processed…`)
  }
}

// ── Output: deterministic, app-shaped static JSON ──
function writeOutput(cache, chosen) {
  const records = chosen.map((ex) => {
    const d = cache.details[ex.exerciseId] ?? {}
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      equipments: ex.equipments,
      bodyParts: ex.bodyParts,
      exerciseType: ex.exerciseType,
      targetMuscles: ex.targetMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      overview: d.overview,
      instructions: d.instructions ?? [],
      exerciseTips: d.exerciseTips ?? [],
      variations: d.variations ?? [],
      relatedExerciseIds: d.relatedExerciseIds ?? [],
      imageUrl: d.imageUrl || ex.imageUrl || undefined,
      imageUrls: d.imageUrls,
      videoUrl: d.videoUrl || undefined,
    }
  })
  // Code-point compare (not localeCompare): identical ordering — and thus an
  // identical version hash — on every machine regardless of locale/ICU.
  records.sort((a, b) => (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0))

  mkdirSync(OUT_DIR, { recursive: true })
  const json = JSON.stringify(records)
  writeFileSync(OUT_EXERCISES, json)
  writeFileSync(
    OUT_META,
    JSON.stringify({
      version: createHash('sha256').update(json).digest('hex').slice(0, 12),
      count: records.length,
      generatedAt: new Date().toISOString(),
      source: 'ExerciseDB v2 (AscendAPI via RapidAPI)',
    }),
  )
  writeFileSync(OUT_TAXONOMY, JSON.stringify(cache.taxonomy))
  console.log(`Wrote ${records.length} exercises → ${path.relative(ROOT, OUT_EXERCISES)} (${(json.length / 1024).toFixed(0)} KB)`)
}

// ── Entry ──
const arg = process.argv[2]
const cache = loadCache()

if (arg === '--status') {
  console.log(
    `cache: ${Object.keys(cache.list).length} indexed (complete: ${cache.listComplete}), ${Object.keys(cache.details).length} details, taxonomy: ${cache.taxonomy ? 'yes' : 'no'}`,
  )
  process.exit(0)
}

if (!CONFIG.key) {
  console.error(
    'Missing RAPIDAPI_KEY.\n' +
      '  1. Subscribe (free Basic plan) to "ExerciseDB with videos and images by AscendAPI" on RapidAPI\n' +
      '  2. Copy .env.example to .env and paste your X-RapidAPI-Key\n' +
      '  3. Re-run: npm run fetch:exercises',
  )
  process.exit(1)
}

if (arg === '--dry-run') {
  console.log('Config OK:', {
    host: CONFIG.host,
    reqsPerHour: CONFIG.reqsPerHour,
    intervalMs: MIN_INTERVAL_MS,
    detailCap: CONFIG.detailCap,
    pageLimit: CONFIG.pageLimit,
  })
  console.log(
    `cache: ${Object.keys(cache.list).length} indexed (complete: ${cache.listComplete}), ${Object.keys(cache.details).length} details`,
  )
  process.exit(0)
}

const started = Date.now()
await fetchTaxonomy(cache)
await fetchIndex(cache)
const chosen = selectForDetails(cache)
await fetchDetails(cache, chosen)
writeOutput(cache, chosen)
console.log(`Done — ${requestCount} API calls in ${Math.round((Date.now() - started) / 1000)}s. Re-runs only fetch what's new.`)
