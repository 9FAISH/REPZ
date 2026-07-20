import type { RestNotificationState } from './notifications.ts'

/** Native bridge for the rest timer (Capacitor).
 *
 *  The web app already talks to an interface — `RestTimer` for counting and
 *  `notifications.ts` for the notification-bar UI. This module is the
 *  native implementation of the *notification* half: when running inside
 *  Capacitor it schedules a real local notification that survives
 *  backgrounding, which neither iOS nor Android can do from a PWA.
 *
 *  Loading is fully lazy and guarded, so the web build never pulls in
 *  Capacitor code and nothing here runs in a browser.
 *
 *  Platform notes:
 *   - Android: LocalNotifications renders an ongoing notification with
 *     action buttons; a foreground service (added in the native project)
 *     keeps it alive for the full rest period.
 *   - iOS: a scheduled notification fires when rest ends. Live Activity
 *     style countdowns need a small Swift extension in the iOS project —
 *     the hook point is `scheduleRestEnd` below. */

const REST_NOTIFICATION_ID = 4201

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

/** True only inside a Capacitor native shell. */
export function isNative(): boolean {
  return capacitor()?.isNativePlatform?.() === true
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  const p = capacitor()?.getPlatform?.()
  return p === 'ios' || p === 'android' ? p : 'web'
}

type LocalNotificationsApi = {
  requestPermissions: () => Promise<{ display: string }>
  schedule: (opts: unknown) => Promise<unknown>
  cancel: (opts: { notifications: { id: number }[] }) => Promise<void>
  registerActionTypes: (opts: unknown) => Promise<void>
  addListener: (event: string, cb: (e: { actionId: string }) => void) => Promise<unknown>
}

async function loadPlugin(): Promise<LocalNotificationsApi | null> {
  if (!isNative()) return null
  try {
    const mod = (await import('@capacitor/local-notifications')) as unknown as {
      LocalNotifications: LocalNotificationsApi
    }
    return mod.LocalNotifications
  } catch {
    return null // plugin not installed in this shell
  }
}

/** Register the rest-timer action buttons (once per app start). */
export async function registerNativeActions(): Promise<void> {
  const plugin = await loadPlugin()
  if (!plugin) return
  await plugin.registerActionTypes({
    types: [
      {
        id: 'REPZ_REST',
        actions: [
          { id: 'done-set', title: 'Log set' },
          { id: 'add-rep', title: '+1 rep' },
          { id: 'extend', title: '+15s' },
          { id: 'skip', title: 'Skip', destructive: false },
        ],
      },
    ],
  })
}

/** Schedule the "rest is over" notification. Called when rest starts;
 *  cancelled if the user skips. */
export async function scheduleRestEnd(state: RestNotificationState): Promise<void> {
  const plugin = await loadPlugin()
  if (!plugin) return
  const at = new Date(Date.now() + state.remainingSec * 1000)
  await plugin.schedule({
    notifications: [
      {
        id: REST_NOTIFICATION_ID,
        title: 'Rest done — next set',
        body: `${state.exerciseName} · ${state.nextSetLabel} @ ${state.weightKg} kg × ${state.reps}`,
        actionTypeId: 'REPZ_REST',
        schedule: { at, allowWhileIdle: true },
        ongoing: true, // Android: sticky while resting
        autoCancel: false,
      },
    ],
  })
}

export async function cancelRestNotification(): Promise<void> {
  const plugin = await loadPlugin()
  if (!plugin) return
  await plugin.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] })
}

/** Native action taps → the same action names the web SW relay emits, so
 *  LiveScreen's handler works unchanged. */
export async function onNativeAction(cb: (action: string) => void): Promise<void> {
  const plugin = await loadPlugin()
  if (!plugin) return
  await plugin.addListener('localNotificationActionPerformed', (e) => cb(e.actionId))
}

export async function requestNativePermission(): Promise<boolean> {
  const plugin = await loadPlugin()
  if (!plugin) return false
  return (await plugin.requestPermissions()).display === 'granted'
}
