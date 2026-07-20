import { useEffect, useState, useSyncExternalStore } from 'react'
import { getNeedRefresh, subscribeNeedRefresh, applyUpdate } from '../lib/swUpdate'
import { kvGet, kvSet } from '../db/repo'
import {
  isIos,
  isStandalone,
  onConnectivityChange,
  onInstallAvailable,
  type BeforeInstallPromptEvent,
} from '../lib/pwa'
import './PwaBanners.css'

const DISMISS_KEY = 'pwa.installDismissed'

/** Thin status strip above the tab bar: offline state, update-ready, and
 *  the install nudge. Nothing here blocks the app. */
export function PwaBanners() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  const needRefresh = useSyncExternalStore(subscribeNeedRefresh, getNeedRefresh, () => false)

  useEffect(() => onConnectivityChange((online) => setOffline(!online)), [])
  useEffect(() => onInstallAvailable(setInstallEvent), [])

  useEffect(() => {
    void kvGet<boolean>(DISMISS_KEY).then((v) => setDismissed(!!v))
  }, [])

  const dismiss = () => {
    setDismissed(true)
    setShowIosHint(false)
    void kvSet(DISMISS_KEY, true)
  }

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === 'accepted') dismiss()
      setInstallEvent(null)
      return
    }
    setShowIosHint(true)
  }

  // Never nag once installed, or after an explicit dismissal.
  const canOfferInstall = !isStandalone() && !dismissed && (installEvent != null || isIos())

  if (!offline && !needRefresh && !canOfferInstall) return null

  return (
    <div className="pwa-banners">
      {offline && (
        <div className="pwa-banner pwa-banner-offline">
          Offline — everything still works. Your data is on this phone.
        </div>
      )}

      {needRefresh && (
        <div className="pwa-banner pwa-banner-update">
          <span>New version ready.</span>
          <button className="pwa-banner-action" onClick={() => void applyUpdate()}>
            Reload
          </button>
        </div>
      )}

      {canOfferInstall && !showIosHint && (
        <div className="pwa-banner pwa-banner-install">
          <span>Add REPZ to your home screen for full-screen, offline lifting.</span>
          <button className="pwa-banner-action" onClick={() => void install()}>
            Install
          </button>
          <button className="pwa-banner-close" onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {showIosHint && (
        <div className="pwa-banner pwa-banner-install">
          <span>
            Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.
          </span>
          <button className="pwa-banner-close" onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
