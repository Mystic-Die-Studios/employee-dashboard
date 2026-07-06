import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { IconPlus } from '../components/icons.jsx'
import * as tracker from '../api/tracker.js'

const SEVERITY = {
  low: { t: 'slate', l: 'Low' }, medium: { t: 'blue', l: 'Medium' },
  high: { t: 'amber', l: 'High' }, critical: { t: 'red', l: 'Critical' },
}
const STATUS = {
  open: { t: 'blue', l: 'Open' }, in_progress: { t: 'amber', l: 'In progress' },
  fixed: { t: 'green', l: 'Fixed' }, wontfix: { t: 'slate', l: "Won't fix" },
}
const STATUS_OPTS = ['open', 'in_progress', 'fixed', 'wontfix']
const FILTERS = ['open', 'all', 'fixed']

export default function BugsPage() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('open')
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('medium')

  const load = () => tracker.list('bugs').then(setItems)
  useEffect(() => {
    load()
  }, [])

  async function set(id, status) {
    await tracker.setStatus('bugs', id, status)
    load()
  }
  async function add(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    await tracker.create('bugs', { title: t, severity, status: 'open', reporter: 'You', assignee: '—' })
    setTitle('')
    load()
  }

  const visible = items.filter((b) =>
    filter === 'all' ? true : filter === 'open' ? b.status === 'open' || b.status === 'in_progress' : b.status === 'fixed',
  )
  const openCount = items.filter((b) => b.status === 'open' || b.status === 'in_progress').length

  return (
    <div>
      <PageHeader title="Bug Tracking" subtitle={`${openCount} open`} />
      <Card className="p-5">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Report a bug…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 outline-none focus:border-violet-400"
          >
            {Object.keys(SEVERITY).map((s) => (
              <option key={s} value={s}>{SEVERITY[s].l}</option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <IconPlus width={15} height={15} />
            Report
          </button>
        </form>

        <div className="mb-1 mt-4 flex gap-1">
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
            <li className="py-8 text-center text-sm text-slate-400">No bugs here.</li>
          )}
          {visible.map((b) => (
            <li key={b.id} className="flex items-start gap-3 py-3">
              <Badge tone={SEVERITY[b.severity].t}>{SEVERITY[b.severity].l}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">{b.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {b.reporter} → {b.assignee} · {b.created_at}
                </div>
              </div>
              <select
                value={b.status}
                onChange={(e) => set(b.id, e.target.value)}
                className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 outline-none focus:border-violet-400"
              >
                {STATUS_OPTS.map((o) => (
                  <option key={o} value={o}>{STATUS[o].l}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
