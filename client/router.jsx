import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './src/layouts/AppLayout.jsx'
import ProtectedRoute from './src/components/ProtectedRoute.jsx'
import AuthPage from './src/pages/AuthPage.jsx'
import DashboardPage from './src/pages/DashboardPage.jsx'
import TodoPage from './src/pages/TodoPage.jsx'
import KanbanPage from './src/pages/KanbanPage.jsx'
import InboxPage from './src/pages/InboxPage.jsx'
import DocumentsPage from './src/pages/DocumentsPage.jsx'
import ProfilePage from './src/pages/ProfilePage.jsx'
import PullRequestsPage from './src/pages/PullRequestsPage.jsx'
import ArtReviewsPage from './src/pages/ArtReviewsPage.jsx'
import ChangeRequestsPage from './src/pages/ChangeRequestsPage.jsx'
import BugsPage from './src/pages/BugsPage.jsx'
import ResourcesPage from './src/pages/ResourcesPage.jsx'
import NotFound from './src/pages/NotFound.jsx'

// Route map for the employee dashboard.
//   /               public landing + "Sign in with GitHub"
//   /dashboard/*    protected app shell (sidebar), the four main sections
export const router = createBrowserRouter([
  { path: '/', element: <AuthPage /> },
  {
    // Pathless gate: redirects to "/" when not authenticated.
    element: <ProtectedRoute />,
    children: [
      {
        // Pathless layout: sidebar shell wrapping all dashboard pages.
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/dashboard/todo', element: <TodoPage /> },
          { path: '/dashboard/kanban', element: <KanbanPage /> },
          { path: '/dashboard/prs', element: <PullRequestsPage /> },
          { path: '/dashboard/art-reviews', element: <ArtReviewsPage /> },
          { path: '/dashboard/change-requests', element: <ChangeRequestsPage /> },
          { path: '/dashboard/bugs', element: <BugsPage /> },
          { path: '/dashboard/resources', element: <ResourcesPage /> },
          { path: '/dashboard/inbox', element: <InboxPage /> },
          { path: '/dashboard/documents', element: <DocumentsPage /> },
          { path: '/dashboard/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
