import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/800.css'
import '@fontsource/archivo/900.css'
import './styles/tokens.css'
import './styles/global.css'
import { router } from './app/routes'
import { seedExercises } from './db/seed'
import { db } from './db/db'
import * as repo from './db/repo'

// Fire-and-forget: refreshes the local exercise catalog from the
// committed static JSON when its version changes.
const seedDone = seedExercises()

// This phone holds the only copy of the user's data — ask the browser to
// exempt IndexedDB from storage-pressure eviction. (Best-effort; installed
// iOS PWAs already persist, but this hardens browser-tab usage.)
void navigator.storage?.persist?.().catch(() => {})

// Dev-only console/testing handle; stripped from production builds.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).repz = { db, repo, seedDone }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
