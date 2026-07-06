import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import DocumentTree from '../components/documents/DocumentTree.jsx'
import DocumentDetail from '../components/documents/DocumentDetail.jsx'
import * as docs from '../api/documents.js'

export default function DocumentsPage() {
  const { user } = useAuth()
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const [f, d] = await Promise.all([docs.listFolders(), docs.listDocuments()])
    setFolders(f)
    setDocuments(d)
    return d
  }, [])

  useEffect(() => {
    docs.setActor(user)
    reload().then((d) => {
      setSelectedId((cur) => cur ?? d[0]?.id ?? null)
      setReady(true)
    })
  }, [user, reload])

  async function handleNewDocument(folderId) {
    const doc = await docs.createDocument({
      title: 'Untitled',
      folder: folderId,
      content: '# Untitled\n\nStart writing…',
    })
    await reload()
    setSelectedId(doc.id)
  }

  async function handleNewFolder() {
    const name = window.prompt('Folder name')
    if (!name) return
    await docs.createFolder({ name })
    await reload()
  }

  async function purgeFolder(folder, recursive) {
    await docs.deleteFolder(folder.id, { recursive })
    const d = await reload()
    if (!d.some((x) => x.id === selectedId)) setSelectedId(d[0]?.id ?? null)
  }

  async function handleDeleteFolder(folder) {
    try {
      await purgeFolder(folder, false)
    } catch (e) {
      if (e.code === 409) {
        if (window.confirm(`"${folder.name}" isn't empty. Delete it and everything inside?`)) {
          await purgeFolder(folder, true)
        }
      } else {
        throw e
      }
    }
  }

  async function handleDeleted() {
    const d = await reload()
    setSelectedId(d[0]?.id ?? null)
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Team wiki — Markdown docs in folders, with version history & attachments"
      />

      <div className="grid h-[70vh] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-[16rem_1fr]">
        <div className="border-b border-slate-200 md:border-b-0 md:border-r">
          <DocumentTree
            folders={folders}
            documents={documents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNewDocument={handleNewDocument}
            onNewFolder={handleNewFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        </div>

        <div className="min-w-0">
          {selectedId ? (
            <DocumentDetail
              key={selectedId}
              docId={selectedId}
              folders={folders}
              onChanged={reload}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-400">
              {ready ? 'Select or create a document to get started.' : 'Loading…'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
