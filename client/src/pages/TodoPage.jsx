import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { IconCheck, IconExternal } from '../components/icons.jsx'
import * as kanban from '../api/kanban.js'

const STATUS_TONE = { 'To Do': 'slate', 'In Progress': 'blue', 'In Review': 'violet', Done: 'green' }
const FILTERS = ['active', 'all', 'completed']

// The To-Do list is a view of the current user's Kanban cards.
export default function TodoPage() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    kanban.myTasks().then(setTasks)
  }, [])

  async function toggle(t) {
    await kanban.setTaskDone(t.id, !t.done)
    setTasks(await kanban.myTasks())
  }

  const visible = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.done : t.done,
  )
  const remaining = tasks.filter((t) => !t.done).length

  return (
    <div>
      <PageHeader
        title="To-Do List"
        subtitle={`${remaining} open ${remaining === 1 ? 'task' : 'tasks'} assigned to you on the Kanban board`}
      >
        <a
          href={kanban.KANBAN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          View board
          <IconExternal width={15} height={15} />
        </a>
      </PageHeader>

      <Card className="p-5">
        <div className="mb-3 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400">Nothing here.</li>
          )}
          {visible.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <button
                onClick={() => toggle(t)}
                aria-label={t.done ? 'Move out of Done' : 'Mark done'}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition ${
                  t.done
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-300 hover:border-violet-400'
                }`}
              >
                {t.done && <IconCheck width={12} height={12} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${t.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {t.title}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <Badge tone={STATUS_TONE[t.status] || 'slate'}>{t.status}</Badge>
                  <span>due {t.due}</span>
                  <span>· {t.points} pts</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          Tasks sync from the team board at{' '}
          <a
            href={kanban.KANBAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline"
          >
            kanban.mysticdie.com
          </a>
          . Checking one moves the card to Done on the board.
        </p>
      </Card>
    </div>
  )
}
