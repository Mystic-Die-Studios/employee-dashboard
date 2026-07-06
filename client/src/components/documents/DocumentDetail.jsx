import { useEffect, useState } from 'react'
import Markdown from '../Markdown.jsx'
import Avatar from '../Avatar.jsx'
import { IconTrash, IconUpload, IconDownload } from '../icons.jsx'
import * as docs from '../../api/documents.js'

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// View / edit a single document, with attachments and revision history.
export default function DocumentDetail({ docId, folders, onChanged, onDeleted }) {
  const [doc, setDoc] = useState(null)
  const [mode, setMode] = useState('view')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [revisions, setRevisions] = useState(null) // null = panel hidden
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setMode('view')
    setRevisions(null)
    docs.getDocument(docId).then((d) => {
      if (cancelled) return
      setDoc(d)
      setTitle(d.title)
      setContent(d.content)
    })
    return () => {
      cancelled = true
    }
  }, [docId])

  if (!doc) {
    return <div className="grid h-full place-items-center text-sm text-slate-400">Loading…</div>
  }

  const folderName = doc.folder ? folders.find((f) => f.id === doc.folder)?.name || '' : ''

  async function save() {
    setBusy(true)
    const updated = await docs.updateDocument(doc.id, { title, content })
    setDoc(updated)
    setMode('view')
    setBusy(false)
    onChanged?.()
  }

  function cancel() {
    setTitle(doc.title)
    setContent(doc.content)
    setMode('view')
  }

  async function remove() {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return
    await docs.deleteDocument(doc.id)
    onDeleted?.()
  }

  async function toggleHistory() {
    if (revisions) return setRevisions(null)
    setRevisions(await docs.listRevisions(doc.id))
  }

  async function restore(n) {
    if (!window.confirm(`Restore revision ${n} as a new revision?`)) return
    const updated = await docs.restoreRevision(doc.id, n)
    setDoc(updated)
    setTitle(updated.title)
    setContent(updated.content)
    setRevisions(await docs.listRevisions(doc.id))
    onChanged?.()
  }

  async function upload(e) {
    const files = Array.from(e.target.files || [])
    for (const f of files) await docs.addAttachment(doc.id, f)
    setDoc(await docs.getDocument(doc.id))
    e.target.value = ''
    onChanged?.()
  }

  async function removeAttachment(attId) {
    await docs.removeAttachment(doc.id, attId)
    setDoc(await docs.getDocument(doc.id))
    onChanged?.()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400">
            {folderName ? `${folderName} · ` : ''}
            {mode === 'edit' ? 'Editing' : `revision ${doc.revision_number}`}
          </div>
          {mode === 'edit' ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-lg font-semibold text-slate-900 outline-none focus:border-violet-400"
            />
          ) : (
            <h1 className="truncate text-xl font-semibold text-slate-900">{doc.title}</h1>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Avatar user={doc.updated_by} size={16} />
            {doc.updated_by?.name || doc.updated_by?.login} · updated {formatDate(doc.updated_at)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mode === 'view' ? (
            <>
              <button
                onClick={toggleHistory}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                History
              </button>
              <button
                onClick={() => setMode('edit')}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
              >
                Edit
              </button>
              <button
                onClick={remove}
                title="Delete document"
                className="rounded-md border border-slate-200 p-1.5 text-slate-400 transition hover:text-red-500"
              >
                <IconTrash width={15} height={15} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={cancel}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {mode === 'edit' ? (
          <div className="grid h-full grid-cols-1 lg:grid-cols-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write Markdown…"
              className="min-h-[320px] resize-none border-b border-slate-100 p-4 font-mono text-sm outline-none lg:border-b-0 lg:border-r"
            />
            <div className="overflow-auto p-4">
              <Markdown>{content}</Markdown>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <Markdown>{doc.content}</Markdown>
          </div>
        )}
      </div>

      {revisions && (
        <div className="max-h-44 overflow-auto border-t border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Revision history
          </div>
          <ul className="space-y-1">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-mono text-slate-400">#{r.revision_number}</span>
                <span className="flex-1 truncate">
                  {r.comment || 'Edited'} · {r.edited_by?.name || r.edited_by?.login} ·{' '}
                  {formatDate(r.created_at)}
                </span>
                {r.revision_number !== doc.revision_number && (
                  <button onClick={() => restore(r.revision_number)} className="text-violet-600 hover:underline">
                    restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Attachments ({doc.attachments.length})
          </span>
          <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-violet-600 hover:underline">
            <IconUpload width={13} height={13} />
            Upload
            <input type="file" multiple className="hidden" onChange={upload} />
          </label>
        </div>
        {doc.attachments.length === 0 ? (
          <p className="text-xs text-slate-400">No files attached.</p>
        ) : (
          <ul className="space-y-1">
            {doc.attachments.map((a) => (
              <li key={a.id} className="group flex items-center gap-2 text-xs">
                <a
                  href={a.url}
                  download={a.original_name}
                  className="flex items-center gap-1 text-slate-700 transition hover:text-violet-600"
                >
                  <IconDownload width={13} height={13} />
                  {a.original_name}
                </a>
                <span className="text-slate-400">{humanSize(a.size)}</span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="ml-auto text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                >
                  <IconTrash width={13} height={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
