import { createHashRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { SetupScreen } from '../screens/setup/SetupScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { BuilderScreen } from '../screens/train/BuilderScreen'
import { ExerciseDetailScreen } from '../screens/train/ExerciseDetailScreen'
import { LibraryScreen } from '../screens/train/LibraryScreen'
import { LiveScreen } from '../screens/train/LiveScreen'
import { FoodScreen } from '../screens/food/FoodScreen'
import { ProgressScreen } from '../screens/progress/ProgressScreen'
import { RecordsScreen } from '../screens/progress/RecordsScreen'
import { ShelfScreen } from '../screens/progress/ShelfScreen'

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
