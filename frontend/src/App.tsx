// Design Ref: §5.2 — 라우팅: /login, /, /projects, /projects/:projectId, /calendar, /settings
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import { AppShell } from './components/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { ProjectDetailPage } from './features/projects/ProjectDetailPage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { HomePage } from './features/tasks/HomePage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
