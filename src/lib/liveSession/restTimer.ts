/** Standalone rest timer — deliberately free of React/DOM/Dexie so a
 *  Capacitor native layer can drive the exact same interface later for a
 *  true ongoing notification (Android foreground service / iOS Live
 *  Activity via a plugin).
 *
 *  PWA reality check (why this stays swappable):
 *   - Android Chrome: service-worker notifications with action buttons work
 *     while the app is alive, but JS timers throttle heavily once the tab
 *     is backgrounded — the countdown can stall until refocus.
 *   - iOS Safari (installed PWA, 16.4+): notifications need a user-gesture
 *     permission grant, action buttons are NOT supported, and background
 *     JS is suspended almost immediately. A native layer is the only path
 *     to a real lock-screen countdown there. */

export interface RestTimerState {
  running: boolean
  remainingSec: number
  totalSec: number
}

export type RestTimerListener = (state: RestTimerState, event: 'start' | 'tick' | 'extend' | 'done' | 'skip') => void

export class RestTimer {
  private remaining = 0
  private total = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<RestTimerListener>()
  /** Wall-clock deadline — survives timer throttling in background tabs. */
  private deadline = 0

  get state(): RestTimerState {
    return { running: this.interval != null, remainingSec: this.remaining, totalSec: this.total }
  }

  subscribe(fn: RestTimerListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(event: 'start' | 'tick' | 'extend' | 'done' | 'skip') {
    for (const fn of this.listeners) fn(this.state, event)
  }

  start(totalSec: number) {
    this.stopInterval()
    this.total = totalSec
    this.remaining = totalSec
    this.deadline = Date.now() + totalSec * 1000
    this.interval = setInterval(() => this.onTick(), 1000)
    this.emit('start')
  }

  private onTick() {
    // Recompute from the wall clock: throttled background intervals then
    // catch up instead of drifting.
    this.remaining = Math.max(0, Math.round((this.deadline - Date.now()) / 1000))
    if (this.remaining <= 0) {
      this.stopInterval()
      this.emit('done')
      return
    }
    this.emit('tick')
  }

  extend(sec: number) {
    if (this.interval == null) return
    this.deadline += sec * 1000
    this.total += sec
    this.remaining = Math.max(0, Math.round((this.deadline - Date.now()) / 1000))
    this.emit('extend')
  }

  skip() {
    if (this.interval == null) return
    this.stopInterval()
    this.remaining = 0
    this.emit('skip')
  }

  private stopInterval() {
    if (this.interval != null) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  dispose() {
    this.stopInterval()
    this.listeners.clear()
  }
}

export const formatRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
