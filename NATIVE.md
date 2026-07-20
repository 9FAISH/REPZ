# Going native (Capacitor)

REPZ is a PWA first. Capacitor **wraps the existing web build** — there is no
second codebase, no rewrite. `dist/` is the app; the native projects are shells
around it.

## Why bother?

One thing a PWA genuinely cannot do on iPhone: keep the rest timer alive and
interactive in the background.

| Capability | PWA on iOS | PWA on Android | Capacitor (both) |
| --- | --- | --- | --- |
| Rest countdown while backgrounded | ✗ suspended | ~ throttled | ✓ |
| Notification action buttons | ✗ unsupported | ✓ | ✓ |
| Ongoing / sticky notification | ✗ | ✗ | ✓ |
| Lock-screen live countdown | ✗ | ✗ | ✓ (extra work, see below) |

The web app already runs everything through two seams, so no screen code
changes when a native shell is present:

- `src/lib/liveSession/restTimer.ts` — counting (wall-clock based, no DOM).
- `src/lib/liveSession/notifications.ts` — notification UI, which delegates to
  `nativeTimer.ts` whenever `Capacitor.isNativePlatform()` is true.

## First-time setup

```sh
npm install                      # Capacitor CLI/core are already devDependencies
npm install @capacitor/ios @capacitor/android

npx cap add ios                  # macOS + Xcode required
npx cap add android              # Android Studio required
```

`capacitor.config.ts` is already committed (appId `app.repz.trainer`,
`webDir: dist`), so `cap add` picks it up as-is.

## Every build after that

```sh
npm run build                    # produces dist/ — the same build the PWA ships
npx cap sync                     # copies dist/ into both native projects
npx cap open ios                 # → Xcode: run on device/simulator
npx cap open android             # → Android Studio: run
```

Or the shortcuts: `npm run native:sync`, `npm run native:ios`,
`npm run native:android`.

> Build with the default `BASE_PATH` (`/`) for native. The `/REPZ/` base is only
> for GitHub Pages project-page hosting.

## Wiring the ongoing notification

`src/lib/liveSession/nativeTimer.ts` is the whole bridge — it lazily imports
`@capacitor/local-notifications` and no-ops on web:

- `registerNativeActions()` — declares the Log set / +1 rep / +15s / Skip
  buttons (call once at startup in a native shell).
- `scheduleRestEnd(state)` — schedules the rest-over notification; Android gets
  `ongoing: true` so it stays put.
- `cancelRestNotification()` — on skip/finish.
- `onNativeAction(cb)` — action taps arrive with the **same** action ids the web
  service worker relays (`done-set`, `add-rep`, `extend`, `skip`), so
  `LiveScreen`'s existing handler works untouched.

### Android: keep it alive the whole rest period

Add a foreground service so the countdown survives Doze:

1. In `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
   ```
2. Drop a monochrome `ic_stat_repz` into `android/app/src/main/res/drawable/`
   (referenced by `capacitor.config.ts`).

### iOS: notification vs Live Activity

`scheduleRestEnd` already gives a local notification when rest ends. A
*live* lock-screen countdown needs an ActivityKit widget extension in Xcode:

1. File ▸ New ▸ Target ▸ Widget Extension, tick **Include Live Activity**.
2. Model the attributes on `RestNotificationState` (exercise, next set,
   deadline).
3. Bridge it with a small `@objc` Capacitor plugin exposing
   `start/update/end`, then call it from `nativeTimer.ts` alongside
   `scheduleRestEnd`.

Add `NSUserNotificationsUsageDescription` to `ios/App/App/Info.plist`, and
`NSSupportsLiveActivities = YES` if you build the widget.

## What stays identical

Dexie/IndexedDB works unchanged inside the native WebView, so profile,
sessions, set logs, nutrition and weight history behave exactly as they do in
the PWA. Export a JSON backup (Progress ▸ Backup) before switching between the
PWA and a native build — they use separate storage sandboxes.
