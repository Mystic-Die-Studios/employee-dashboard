import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { IconImage } from '../components/icons.jsx'
import * as tracker from '../api/tracker.js'

const STATUS = {
  pending: { t: 'slate', l: 'Pending' },
  approved: { t: 'green', l: 'Approved' },
  changes_requested: { t: 'amber', l: 'Changes requested' },
}

export default function ArtReviewsPage() {
  const [items, setItems] = useState([])
  const load = () => tracker.list('art').then(setItems)
  useEffect(() => {
    load()
  }, [])

  async function set(id, status) {
    await tracker.setStatus('art', id, status)
    load()
  }

  return (
    <div>
      <PageHeader title="Art Reviews" subtitle="Assets submitted for review & sign-off" />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-violet-100 to-slate-100 text-violet-300">
              <IconImage width={36} height={36} />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-800">{a.title}</div>
                <Badge tone={STATUS[a.status].t}>{STATUS[a.status].l}</Badge>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                by {a.submitter} · reviewer {a.reviewer} · {a.created_at}
              </div>
              {a.note && <p className="mt-2 text-sm text-slate-500">“{a.note}”</p>}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => set(a.id, 'approved')}
                  className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => set(a.id, 'changes_requested')}
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Request changes
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
