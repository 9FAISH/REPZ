# REPZ

Personal trainer + diet tracker. **Local-first, mobile-only PWA** — no backend, no
accounts; all user data lives in IndexedDB on the device.

- **Design source of truth:** `design/REPZ-Fitness-App.dc.html` (imported from the
  Claude Design project "Fitness App PWA Design"). Layout, colors, typography and
  components must match it; tokens are extracted into `src/styles/tokens.css`.
- **Stack:** Vite · React · TypeScript · Dexie (IndexedDB) · React Router (hash) ·
  vite-plugin-pwa · Archivo (self-hosted via Fontsource).
- **Mobile-only:** built for portrait phone viewports (~360–430 px), thumb-reachable
  controls, one-handed use. The shell is a centered, phone-width column.

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
npm run smoke:db   # end-to-end Dexie layer test in a real browser (needs dev server running)
```

## Deploy

Pushes to `main` build and publish to GitHub Pages via
`.github/workflows/deploy.yml` (set the repo's Pages source to "GitHub Actions").
The workflow sets `BASE_PATH=/<repo>/` so assets resolve under the project page.

## Build phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Design import, scaffold, tokens, PWA shell, Pages CI | ✅ |
| 1 | Dexie schema + build-time ExerciseDB pipeline | — |
| 2 | First-run profile + dashboard | — |
| 3 | Slot-based workout builder | — |
| 4 | Live workout, rest timer, notification controls | — |
| 5 | Nutrition engine + weight tracking | — |
| 6 | Progress, PRs, mascot hooks | — |
| 7 | PWA polish + Capacitor scaffold | — |
