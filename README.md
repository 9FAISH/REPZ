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

## Exercise catalog (build-time pipeline)

The app never calls the ExerciseDB API at runtime — a build-time script fetches
the catalog and commits it as static JSON (`public/data/`), which seeds IndexedDB
on first load. The RapidAPI key lives only in a gitignored `.env`.

```sh
cp .env.example .env  # then paste your RapidAPI key (free Basic plan works)
npm run fetch:exercises            # throttled + resumable; safe to interrupt
npm run fetch:exercises -- --status   # show cached progress
```

Free-tier notes (observed): 2,000 requests/month, catalog capped at 200
exercises, burst limit on the detail endpoint (script paces details at 15s and
rides out `MITIGATION_REDIRECT` cooloffs). Media is watermarked (URLs referenced
as-is; swap via `src/lib/media.ts` when upgrading — paid tiers also unlock the
full ~12.8k-exercise catalog with the same script).

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
