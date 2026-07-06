import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { IconExternalSm } from '../components/icons.jsx'
import { myPulls } from '../api/prs.js'

const STATUS = {
  open: { t: 'blue', l: 'Open' }, draft: { t: 'slate', l: 'Draft' },
  merged: { t: 'violet', l: 'Merged' }, closed: { t: 'red', l: 'Closed' },
}
const REVIEW = {
  approved: { t: 'green', l: 'Approved' },
  changes_requested: { t: 'amber', l: 'Changes requested' },
  review_required: { t: 'slate', l: 'Review required' },
}
const CHECKS = {
  passing: { t: 'green', l: 'Checks passing' },
  failing: { t: 'red', l: 'Checks failing' },
  pending: { t: 'amber', l: 'Checks pending' },
}

export default function PullRequestsPage() {
  const [prs, setPrs] = useState([])
  useEffect(() => {
    myPulls().then(setPrs)
  }, [])

  const open = prs.filter((p) => p.status === 'open' || p.status === 'draft')

  return (
    <div>
      <PageHeader title="My Pull Requests" subtitle={`${open.length} open across your repos`} />
      <Card>
        <ul className="divide-y divide-slate-100">
          {prs.map((p) => (
            <li key={p.id} className="p-4">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-800 transition hover:text-violet-600"
              >
                <span className="min-w-0 truncate">{p.title}</span>
                <IconExternalSm width={14} height={14} className="shrink-0 text-slate-400" />
              </a>
              <div className="mt-1 text-xs text-slate-400">
                {p.repo} #{p.number} · updated {p.updated}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={STATUS[p.status].t}>{STATUS[p.status].l}</Badge>
                <Badge tone={REVIEW[p.review].t}>{REVIEW[p.review].l}</Badge>
                <Badge tone={CHECKS[p.checks].t}>{CHECKS[p.checks].l}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Your GitHub PRs. Live data connects once the backend GitHub proxy is enabled.
      </p>
    </div>
  )
}
