import { createHashRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { HomeScreen } from '../screens/HomeScreen'
import { TrainScreen } from '../screens/TrainScreen'
import { FoodScreen } from '../screens/FoodScreen'
import { ProgressScreen } from '../screens/ProgressScreen'

// Hash routing keeps deep links working on GitHub Pages (no server rewrites).
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'train', element: <TrainScreen /> },
      { path: 'food', element: <FoodScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
    ],
  },
])
