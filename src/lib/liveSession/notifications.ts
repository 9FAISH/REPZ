/** Notification-bar rest controls (PWA best-effort tier).
 *
 *  Posts a service-worker notification with action buttons while resting;
 *  the SW (public/sw-notifications.js, imported into the generated worker)
 *  relays taps back here as messages. Feature-detected throughout:
 *   - Android Chrome: actions render (up to Notification.maxActions, ~3);
 *     updates re-post silently under one tag.
 *   - iOS installed PWA: plain notification only, no action buttons.
 *   - Dev server / denied permission: everything no-ops.
 *  The interface mirrors what a Capacitor plugin would implement natively. */

export type NotifAction = 'skip' | 'extend' | 'done-set' | 'add-rep'

export interface RestNotificationState {
  exerciseName: string
  nextSetLabel: string
  remainingSec: number
  weightKg: number
  reps: number
}

const TAG = 'repz-rest-timer'

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

async function registrationOrNull(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function showRestNotification(state: RestNotificationState): Promise<void> {
  const reg = await registrationOrNull()
  if (!reg) return
  const maxActions = (Notification as unknown as { maxActions?: number }).maxActions ?? 0
  const actions = [
    { action: 'done-set', title: `✓ Log ${state.weightKg} kg × ${state.reps}` },
    { action: 'add-rep', title: '+1 rep' },
    { action: 'extend', title: '+15 s' },
    { action: 'skip', title: 'Skip rest' },
  ].slice(0, maxActions)
  try {
    await reg.showNotification('REPZ · Rest timer', {
      tag: TAG,
      body: `${state.exerciseName} — next: ${state.nextSetLabel} · ${Math.floor(state.remainingSec / 60)}:${String(state.remainingSec % 60).padStart(2, '0')}`,
      silent: true,
      // @ts-expect-error actions is valid in SW-backed notifications
      actions,
      data: { kind: TAG },
    })
  } catch {
    /* some engines reject actions/options — the in-app timer remains */
  }
}

export async function closeRestNotification(): Promise<void> {
  const reg = await registrationOrNull()
  if (!reg) return
  for (const n of await reg.getNotifications({ tag: TAG })) n.close()
}

/** Listen for action taps relayed by the SW. Returns an unsubscribe fn. */
export function onNotificationAction(cb: (action: NotifAction) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'repz-notif-action') cb(e.data.action as NotifAction)
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}
