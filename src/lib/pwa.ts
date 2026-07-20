/** PWA install/update/offline helpers.
 *
 *  Platform reality (this app targets an installed iPhone PWA):
 *   - Android/Chromium fires `beforeinstallprompt`, so installation can be
 *     driven from a button.
 *   - iOS Safari has no such event — installing is Share ▸ Add to Home
 *     Screen, so we show instructions instead.
 *   - Once installed, both report `display-mode: standalone` (iOS also sets
 *     the legacy `navigator.standalone`). */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Subscribe to the install prompt event (Android). Returns unsubscribe. */
export function onInstallAvailable(cb: (e: BeforeInstallPromptEvent) => void): () => void {
  const handler = (e: Event) => {
    e.preventDefault() // keep the mini-infobar from appearing; we own the UI
    cb(e as BeforeInstallPromptEvent)
  }
  window.addEventListener('beforeinstallprompt', handler)
  return () => window.removeEventListener('beforeinstallprompt', handler)
}

/** Subscribe to online/offline transitions. Returns unsubscribe. */
export function onConnectivityChange(cb: (online: boolean) => void): () => void {
  const on = () => cb(true)
  const off = () => cb(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}
