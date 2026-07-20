# REPZ

Personal trainer + diet tracker. **Local-first, mobile-only PWA** — no backend, no
accounts; all user data lives in IndexedDB on the device.

- **Design source of truth:** `design/REPZ-Fitness-App.dc.html` (imported from the
  Claude Design project "Fitness App PWA Design"). Layout, colors, typography and
  components must match it; tokens are extracted into `src/styles/tokens.css`.
- **Stack:** Vite · React · TypeScript · Dexie (IndexedDB) · React Router (hash) ·
  vite-plugin-pwa · Archivo (self-hosted via Fontsource) · Capacitor (optional
  native shell).
- **Mobile-only:** built for portrait phone viewports (~360–430 px), thumb-reachable
  controls, one-handed use. The shell is a centered, phone-width column.

## What it does

| Area | Behavior |
| --- | --- |
| Setup | One-time local profile: body stats, goal, activity, split, equipment inventory. No signup. |
| Dashboard | Today's session, Kilo mascot, protein + weight-trend stats, streak. |
| Builder | Muscle sub-region **slots**; picking an exercise locks the slot. Only gear you own is offered. "Generate for me" auto-fills. Saved workouts. |
| Live | Weight/reps/effort per set, auto rest timer, plate calculator, progressive-overload nudges, notification-bar controls. |
| Fuel | Mifflin-St Jeor targets that adapt to your rolling weight average; calorie/protein rings and logging. |
| Progress | e1RM PRs with charts, weekly volume per muscle, adherence, JSON backup, Kilo collection. |

## Develop

```sh
npm install
npm run dev       # local dev server
npm run build     # type-check + production build (dist/)
npm run preview   # serve the production build
```

## Exercise catalog

The catalog is committed static JSON (`public/data/`) that seeds IndexedDB on
first load — the app makes **no API calls at runtime**, and now none at build
time either.

The current catalog is **597 exercises from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** (Unlicense /
public domain): no API key, no quota, no watermarks, no licensing questions.

```sh
npm run build:catalog              # rebuild from free-exercise-db (597 exercises)
npm run add:machines               # or merge only machine + cable into an existing catalog
npm run add:machines -- --dry-run  # report only
```

Images are downloaded and re-encoded locally (400 px webp, ~7.5 MB total)
rather than hotlinked, so they stay in the offline precache.

<details>
<summary>Optional: ExerciseDB / AscendAPI (adds videos + form tips)</summary>

The original pipeline is still here. It adds demo videos and `exerciseTips`
(form cues + injury warnings) that free-exercise-db lacks, but its free tier
caps the library at 200 watermarked exercises, and Pro is **$100/month** for a
500-exercise cap. `fetch:exercises` merges alongside the free dataset rather
than replacing it.

```sh
cp .env.example .env               # RapidAPI key, build-time only
npm run fetch:exercises            # throttled + resumable
npm run fetch:exercises -- --status
```
</details>

## Verify

```sh
npm run test:unit    # pure-logic tests: timer, overload, plates, nutrition, PRs, volume
npm run test:e2e     # browser flows: setup, builder, live, nutrition, progress+backup
npm run smoke:db     # Dexie layer round-trip
node scripts/e2e-offline.mjs   # offline check against the production build + SW
```

`test:e2e` and `smoke:db` need `npm run dev` running; the offline check starts
its own preview server.

## Native (Capacitor)

The native shell wraps this same web build so the rest timer can run a real
ongoing notification in the background — see **[NATIVE.md](NATIVE.md)**.

```sh
npm install @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run native:sync      # build + copy dist/ into the native projects
npm run native:ios       # or native:android — opens the IDE
```

## Deploy (GitHub Pages)

Pushes to `main` build and publish via `.github/workflows/deploy.yml`; the
workflow sets `BASE_PATH=/<repo>/` so assets resolve under the project page.

First-time setup:

```sh
gh auth login                                   # once
gh repo create REPZ --private --source=. --push # or add your own remote
```

Then in the repo: **Settings ▸ Pages ▸ Source = GitHub Actions**. Every later
push to `main` deploys automatically.

## Data & privacy

Everything is on the device — no accounts, no analytics, no network calls at
runtime. The app requests persistent storage so the browser won't evict it.
**Export a backup** (Progress ▸ Backup) before changing phones; PWA and native
builds use separate storage sandboxes.

## Build phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Design import, scaffold, tokens, PWA shell, Pages CI | ✅ |
| 1 | Dexie schema + build-time ExerciseDB pipeline | ✅ |
| 2 | First-run profile + dashboard | ✅ |
| 3 | Slot-based workout builder | ✅ |
| 4 | Live workout, rest timer, notification controls | ✅ |
| 5 | Nutrition engine + weight tracking | ✅ |
| 6 | Progress, PRs, mascot hooks | ✅ |
| 7 | PWA polish + Capacitor scaffold | ✅ |
