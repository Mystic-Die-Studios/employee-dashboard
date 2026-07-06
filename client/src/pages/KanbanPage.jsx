import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { IconExternal } from '../components/icons.jsx'
import * as kanban from '../api/kanban.js'

const STATUS_TONE = { 'To Do': 'slate', 'In Progress': 'blue', 'In Review': 'violet', Done: 'green' }

export default function KanbanPage() {
  const [board, setBoard] = useState(null)

  useEffect(() => {
    kanban.boardSummary().then(setBoard)
  }, [])

  return (
    <div>
      <PageHeader title="Kanban" subtitle="The team sprint board, from kanban.mysticdie.com">
        <a
          href={kanban.KANBAN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          Open board
          <IconExternal width={15} height={15} />
        </a>
      </PageHeader>

      {board && !board.connected && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing a cached summary — live board data appears once the Kanban bridge is connected.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {board?.columns.map((c) => (
          <Card key={c.name} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.name}</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{c.count}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Recent activity</h2>
        <ul className="divide-y divide-slate-100">
          {board?.recent.map((r, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.title}</span>
              <Badge tone={STATUS_TONE[r.status] || 'slate'}>{r.status}</Badge>
              <span className="shrink-0 text-xs text-slate-400">{r.assignee}</span>
            </li>
          ))}
        </ul>
      </Card>

      <a
        href={kanban.KANBAN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div>
          <div className="font-medium text-slate-900">Open the full interactive board</div>
          <div className="text-sm text-slate-500">
            Sprints, timeline, and per-person stats live at kanban.mysticdie.com
          </div>
        </div>
        <IconExternal width={18} height={18} className="shrink-0 text-slate-400" />
      </a>
    </div>
  )
}
