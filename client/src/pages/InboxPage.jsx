import { useEffect, useState } from 'react'
import { PageHeader, Badge } from '../components/ui.jsx'
import Avatar from '../components/Avatar.jsx'
import { IconSlack, IconBell, IconSend, IconPlus } from '../components/icons.jsx'
import * as messagesApi from '../api/messages.js'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'internal', label: 'Messages' },
  { key: 'slack', label: 'Slack' },
  { key: 'system', label: 'Notifications' },
]

// Icon/avatar that encodes a message's source at a glance.
function SourceMark({ m, size = 36 }) {
  if (m.source === 'slack') {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"
        style={{ width: size, height: size }}
      >
        <IconSlack width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
      </span>
    )
  }
  if (m.source === 'system') {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600"
        style={{ width: size, height: size }}
      >
        <IconBell width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
      </span>
    )
  }
  const who = m.direction === 'out' ? m.to : m.sender
  return <Avatar user={who} size={size} />
}

function headline(m) {
  if (m.source === 'slack') return m.channel || 'Slack'
  if (m.direction === 'out') return `To ${m.to?.name || m.to?.login}`
  return m.sender?.name || m.sender?.login
}

export default function InboxPage() {
  const [messages, setMessages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [composing, setComposing] = useState(false)

  async function reload() {
    const list = await messagesApi.list()
    setMessages(list)
    return list
  }

  useEffect(() => {
    reload().then((list) => setSelectedId((cur) => cur ?? list[0]?.id ?? null))
  }, [])

  const filtered = messages.filter((m) => (filter === 'all' ? true : m.source === filter))
  const selected = messages.find((m) => m.id === selectedId)
  const unread = messages.filter((m) => m.unread).length

  async function open(id) {
    setSelectedId(id)
    const m = messages.find((x) => x.id === id)
    if (m?.unread) {
      await messagesApi.markRead(id)
      reload()
    }
  }

  return (
    <div>
      <PageHeader title="Inbox" subtitle={unread ? `${unread} unread` : 'All caught up'}>
        <button
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          <IconPlus width={15} height={15} />
          New message
        </button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Nothing here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => open(m.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      selectedId === m.id ? 'bg-violet-50' : ''
                    }`}
                  >
                    <SourceMark m={m} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            m.unread ? 'font-semibold text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {headline(m)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                          {m.unread && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                          {m.created_at}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-slate-600">{m.subject}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {m.body.replace(/\n/g, ' ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {selected ? (
            <article>
              <h2 className="text-lg font-semibold text-slate-900">{selected.subject}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 text-sm text-slate-500">
                <SourceMark m={selected} size={22} />
                <span className="font-medium text-slate-700">{headline(selected)}</span>
                {selected.source === 'internal' && selected.direction !== 'out' && selected.sender?.role && (
                  <Badge tone="slate">{selected.sender.role}</Badge>
                )}
                {selected.source === 'slack' && <Badge tone="slate">Slack</Badge>}
                {selected.source === 'system' && <Badge tone="blue">Notification</Badge>}
                {selected.direction === 'out' && <Badge tone="violet">Sent</Badge>}
                <span className="ml-auto text-xs">{selected.created_at}</span>
              </div>
              <div className="whitespace-pre-line pt-4 text-sm leading-relaxed text-slate-600">
                {selected.body}
              </div>
            </article>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              Select a message to read.
            </div>
          )}
        </div>
      </div>

      {composing && (
        <ComposeModal
          onClose={() => setComposing(false)}
          onSent={async () => {
            setComposing(false)
            const list = await reload()
            setFilter('all')
            setSelectedId(list[0]?.id ?? null)
          }}
        />
      )}
    </div>
  )
}

function ComposeModal({ onClose, onSent }) {
  const [dir, setDir] = useState([])
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    messagesApi.directory().then((d) => {
      setDir(d)
      setTo(d[0]?.login || '')
    })
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!to || !body.trim()) return
    setBusy(true)
    await messagesApi.send({ to, subject, body })
    setBusy(false)
    onSent()
  }

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-semibold text-slate-900">New message</h3>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {dir.map((u) => (
                <option key={u.login} value={u.login}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write your message…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <IconSend width={15} height={15} />
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
