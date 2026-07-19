import { createHashRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { SetupScreen } from '../screens/setup/SetupScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { BuilderScreen } from '../screens/train/BuilderScreen'
import { ExerciseDetailScreen } from '../screens/train/ExerciseDetailScreen'
import { LibraryScreen } from '../screens/train/LibraryScreen'
import { LiveStub } from '../screens/train/LiveStub'
import { FoodScreen } from '../screens/FoodScreen'
import { ProgressScreen } from '../screens/ProgressScreen'

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
      { path: 'train/live', element: <LiveStub /> },
      { path: 'food', element: <FoodScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
    ],
  },
])
