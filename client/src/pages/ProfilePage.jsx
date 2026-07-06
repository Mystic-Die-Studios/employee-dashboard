import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { PageHeader, Card } from '../components/ui.jsx'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your account details" />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {user?.name || user?.login}
            </div>
            <div className="text-sm text-slate-500">@{user?.login}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
          </div>
        </div>
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Profile fields come from your GitHub account via the backend once sign-in is live.
      </p>
    </div>
  )
}
