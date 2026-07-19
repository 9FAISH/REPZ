import { Navigate, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { hasProfile } from '../db/repo'
import { TabBar } from '../components/TabBar'

export function AppShell() {
  const profileExists = useLiveQuery(hasProfile)

  // undefined = still loading (blank shell beats a flash of the wrong screen);
  // false = first run → setup. With a profile the app always opens here.
  if (profileExists === undefined) return <div className="phone-shell" />
  if (!profileExists) return <Navigate to="/setup" replace />

  return (
    <div className="phone-shell">
      <main className="screen-scroll">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
