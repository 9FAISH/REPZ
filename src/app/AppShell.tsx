import { Outlet } from 'react-router-dom'
import { TabBar } from '../components/TabBar'

export function AppShell() {
  return (
    <div className="phone-shell">
      <main className="screen-scroll">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
