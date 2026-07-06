import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import * as tracker from '../api/tracker.js'

const STATUS = {
  open: { t: 'blue', l: 'Open' }, in_review: { t: 'amber', l: 'In review' },
  approved: { t: 'green', l: 'Approved' }, rejected: { t: 'red', l: 'Rejected' },
}
const PRIORITY = { low: { t: 'slate', l: 'Low' }, medium: { t: 'blue', l: 'Medium' }, high: { t: 'red', l: 'High' } }
const STATUS_OPTS = ['open', 'in_review', 'approved', 'rejected']

export default function ChangeRequestsPage() {
  const [items, setItems] = useState([])
  const load = () => tracker.list('cr').then(setItems)
  useEffect(() => {
    load()
  }, [])

  async function set(id, status) {
    await tracker.setStatus('cr', id, status)
    load()
  }

  return (
    <div>
      <PageHeader title="Change Requests" subtitle="Proposed changes to the game & process" />
      <Card>
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{c.title}</div>
                  <div className="mt-1 text-xs text-slate-400">by {c.requester} · {c.created_at}</div>
                  {c.description && <p className="mt-2 text-sm text-slate-500">{c.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone={PRIORITY[c.priority].t}>{PRIORITY[c.priority].l} priority</Badge>
                  <select
                    value={c.status}
                    onChange={(e) => set(c.id, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 outline-none focus:border-violet-400"
                  >
                    {STATUS_OPTS.map((o) => (
                      <option key={o} value={o}>{STATUS[o].l}</option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
