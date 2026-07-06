import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, Card } from '../components/ui.jsx'
import { IconTodo, IconInbox, IconDocuments, IconChevronRight } from '../components/icons.jsx'
import * as kanban from '../api/kanban.js'
import * as messagesApi from '../api/messages.js'
import * as docsApi from '../api/documents.js'

const TONES = {
  violet: 'bg-violet-100 text-violet-600',
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
}

function sourceLabel(m) {
  if (m.source === 'slack') return `Slack · ${m.channel || ''}`
  if (m.direction === 'out') return `To ${m.to?.name || m.to?.login}`
  return m.sender?.name || m.sender?.login
}

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = (user?.name || user?.login || '').split(' ')[0]

  const [tasks, setTasks] = useState([])
  const [messages, setMessages] = useState([])
  const [docCount, setDocCount] = useState(0)

  useEffect(() => {
    kanban.myTasks().then(setTasks)
    messagesApi.list().then(setMessages)
    docsApi.listDocuments().then((d) => setDocCount(d.length))
  }, [])

  const openTasks = tasks.filter((t) => !t.done)
  const unread = messages.filter((m) => m.unread).length

  const stats = [
    { to: '/dashboard/todo', label: 'Open tasks', value: openTasks.length, Icon: IconTodo, tone: 'violet' },
    { to: '/dashboard/inbox', label: 'Unread messages', value: unread, Icon: IconInbox, tone: 'blue' },
    { to: '/dashboard/documents', label: 'Documents', value: docCount, Icon: IconDocuments, tone: 'amber' },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${firstName} — here's your day at a glance.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.to} to={s.to} className="block">
            <Card className="p-5 transition hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${TONES[s.tone]}`}>
                  <s.Icon width={20} height={20} />
                </span>
                <IconChevronRight width={18} height={18} className="text-slate-300" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Today&apos;s tasks</h2>
            <Link to="/dashboard/todo" className="text-sm font-medium text-violet-600 hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-2.5">
            {openTasks.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="h-4 w-4 shrink-0 rounded border border-slate-300" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{t.due}</span>
              </li>
            ))}
            {openTasks.length === 0 && <li className="text-sm text-slate-400">All caught up 🎉</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent messages</h2>
            <Link to="/dashboard/inbox" className="text-sm font-medium text-violet-600 hover:underline">
              Open inbox
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {messages.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{m.subject}</div>
                  <div className="truncate text-xs text-slate-400">{sourceLabel(m)}</div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{m.created_at}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Link
        to="/dashboard/kanban"
        className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div>
          <div className="font-medium text-slate-900">Sprint board</div>
          <div className="text-sm text-slate-500">
            Track the team&apos;s Kanban from kanban.mysticdie.com
          </div>
        </div>
        <IconChevronRight width={18} height={18} className="shrink-0 text-slate-300" />
      </Link>
    </div>
  )
}
