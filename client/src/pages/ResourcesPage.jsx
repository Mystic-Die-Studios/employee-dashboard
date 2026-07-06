import { PageHeader, Card } from '../components/ui.jsx'
import { IconExternalSm } from '../components/icons.jsx'
import { RESOURCE_GROUPS, QUICK_REFS } from '../data/resources.js'

export default function ResourcesPage() {
  return (
    <div>
      <PageHeader title="Resources" subtitle="Links, tools, and quick references for the team" />

      <div className="grid gap-4 md:grid-cols-2">
        {RESOURCE_GROUPS.map((g) => (
          <Card key={g.title} className="p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</h2>
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.label}>
                  <a
                    href={it.href}
                    target={it.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 group-hover:text-violet-700">
                        {it.label}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{it.desc}</span>
                    </span>
                    <IconExternalSm width={15} height={15} className="shrink-0 text-slate-300 transition group-hover:text-violet-500" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick references</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_REFS.map((q) => (
            <div key={q.label}>
              <div className="mb-1 text-xs text-slate-500">{q.label}</div>
              <code className="block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
                {q.code}
              </code>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
