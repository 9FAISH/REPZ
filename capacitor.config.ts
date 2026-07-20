import type { CapacitorConfig } from '@capacitor/cli'

/** Capacitor wraps the EXISTING web build — `dist/` is the app. No rewrite:
 *  `npm run build && npx cap sync` ships whatever the PWA ships.
 *
 *  Why this exists: iOS Safari can't keep a rest-timer countdown alive in
 *  the background or render notification action buttons. The native shell
 *  lets src/lib/liveSession/nativeTimer.ts drive a real ongoing
 *  notification while the web code stays unchanged. */
const config: CapacitorConfig = {
  appId: 'app.repz.trainer',
  appName: 'REPZ',
  webDir: 'dist',
  backgroundColor: '#0B0C0F',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0B0C0F',
  },
  android: {
    backgroundColor: '#0B0C0F',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_repz',
      iconColor: '#2CE8F5',
    },
  },
}

export default config
