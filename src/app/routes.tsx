import { lazy } from 'react'
import { createHashRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { HomeScreen } from '../screens/HomeScreen'

// Home ships in the main chunk (it's the landing screen); every other
// route is split so first paint stays small on a phone connection.
const SetupScreen = lazy(() => import('../screens/setup/SetupScreen').then((m) => ({ default: m.SetupScreen })))
const BuilderScreen = lazy(() => import('../screens/train/BuilderScreen').then((m) => ({ default: m.BuilderScreen })))
const ExerciseDetailScreen = lazy(() => import('../screens/train/ExerciseDetailScreen').then((m) => ({ default: m.ExerciseDetailScreen })))
const LibraryScreen = lazy(() => import('../screens/train/LibraryScreen').then((m) => ({ default: m.LibraryScreen })))
const LiveScreen = lazy(() => import('../screens/train/LiveScreen').then((m) => ({ default: m.LiveScreen })))
const FoodScreen = lazy(() => import('../screens/food/FoodScreen').then((m) => ({ default: m.FoodScreen })))
const ProgressScreen = lazy(() => import('../screens/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })))
const RecordsScreen = lazy(() => import('../screens/progress/RecordsScreen').then((m) => ({ default: m.RecordsScreen })))
const ShelfScreen = lazy(() => import('../screens/progress/ShelfScreen').then((m) => ({ default: m.ShelfScreen })))

// Hash routing keeps deep links working on GitHub Pages (no server rewrites).
export const router = createHashRouter([
  { path: '/setup', element: <SetupScreen /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'train', element: <BuilderScreen /> },
      { path: 'train/exercise/:exerciseId', element: <ExerciseDetailScreen /> },
      { path: 'train/library', element: <LibraryScreen /> },
      { path: 'train/live', element: <LiveScreen /> },
      { path: 'food', element: <FoodScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'progress/records', element: <RecordsScreen /> },
      { path: 'progress/shelf', element: <ShelfScreen /> },
    ],
  },
])
