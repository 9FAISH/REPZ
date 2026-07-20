import { registerSW } from 'virtual:pwa-register'

/** Service-worker registration + update state.
 *
 *  Registration happens at app STARTUP, not inside a screen: first-run users
 *  land on /setup (outside the app shell), and a component-scoped
 *  registration would leave a fresh install with no service worker — so no
 *  offline support until setup was finished. */

let needRefresh = false
const listeners = new Set<() => void>()

const notify = () => {
  for (const fn of listeners) fn()
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh = true
    notify()
  },
})

export const getNeedRefresh = () => needRefresh

export function subscribeNeedRefresh(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Activate the waiting worker and reload. */
export const applyUpdate = () => updateSW(true)
