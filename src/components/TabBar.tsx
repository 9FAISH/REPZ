import { NavLink } from 'react-router-dom'
import './TabBar.css'

// Tab icons are inlined from the design file so strokes/fills can
// follow the active color via currentColor.
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1V9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <rect x="1" y="7" width="3" height="6" rx="1" />
      <rect x="16" y="7" width="3" height="6" rx="1" />
      <rect x="4.5" y="5" width="3" height="10" rx="1" />
      <rect x="12.5" y="5" width="3" height="10" rx="1" />
      <rect x="7.5" y="9" width="5" height="2" />
    </svg>
  )
}

function FoodIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 3a7 7 0 017 7"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="11" width="3.5" height="7" rx="1" />
      <rect x="8.2" y="7" width="3.5" height="11" rx="1" />
      <rect x="14.4" y="2.5" width="3.5" height="15.5" rx="1" />
    </svg>
  )
}

const tabs = [
  { to: '/', label: 'Home', icon: <HomeIcon /> },
  { to: '/train', label: 'Train', icon: <TrainIcon /> },
  { to: '/food', label: 'Food', icon: <FoodIcon /> },
  { to: '/progress', label: 'Progress', icon: <ProgressIcon /> },
]

export function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `tab${isActive ? ' tab-active' : ''}`}
        >
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
