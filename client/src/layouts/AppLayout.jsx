import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import {
  IconDashboard,
  IconTodo,
  IconKanban,
  IconPullRequest,
  IconImage,
  IconGitBranch,
  IconBug,
  IconInbox,
  IconDocuments,
  IconBook,
  IconLogout,
} from '../components/icons.jsx'

const NAV = [
  {
    group: 'Work',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard, end: true },
      { to: '/dashboard/todo', label: 'To-Do', Icon: IconTodo },
      { to: '/dashboard/kanban', label: 'Kanban', Icon: IconKanban },
      { to: '/dashboard/prs', label: 'My PRs', Icon: IconPullRequest },
    ],
  },
  {
    group: 'Reviews & Issues',
    items: [
      { to: '/dashboard/art-reviews', label: 'Art Reviews', Icon: IconImage },
      { to: '/dashboard/change-requests', label: 'Change Requests', Icon: IconGitBranch },
      { to: '/dashboard/bugs', label: 'Bugs', Icon: IconBug },
    ],
  },
  {
    group: 'Team',
    items: [
      { to: '/dashboard/inbox', label: 'Inbox', Icon: IconInbox },
      { to: '/dashboard/documents', label: 'Documents', Icon: IconDocuments },
      { to: '/dashboard/resources', label: 'Resources', Icon: IconBook },
    ],
  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
            MD
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Mystic Die</div>
            <div className="text-xs text-slate-400">Employee Dashboard</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
            <div key={section.group} className="mb-4 last:mb-0">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.group}
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map(({ to, label, Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon width={18} height={18} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <Link
            to="/dashboard/profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50"
          >
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-slate-800">
                  {user?.name || user?.login}
                </span>
                {user?.demo && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    demo
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-400">@{user?.login}</div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <IconLogout width={16} height={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
