import { IconPlus, IconTrash, IconDocuments } from '../icons.jsx'

// Left-hand navigator: a folder tree with documents, plus create/delete controls.
export default function DocumentTree({
  folders,
  documents,
  selectedId,
  onSelect,
  onNewDocument,
  onNewFolder,
  onDeleteFolder,
}) {
  const rootFolders = folders.filter((f) => f.parent === null)
  const rootDocs = documents.filter((d) => d.folder === null)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-100 p-2">
        <button
          onClick={() => onNewDocument(null)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
        >
          <IconPlus width={14} height={14} />
          New doc
        </button>
        <button
          onClick={onNewFolder}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          New folder
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {rootDocs.map((d) => (
          <DocRow key={d.id} doc={d} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))}
        {rootFolders.map((f) => (
          <FolderNode
            key={f.id}
            folder={f}
            depth={0}
            folders={folders}
            documents={documents}
            selectedId={selectedId}
            onSelect={onSelect}
            onNewDocument={onNewDocument}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
        {folders.length === 0 && documents.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">No documents yet.</p>
        )}
      </div>
    </div>
  )
}

function FolderNode({ folder, depth, folders, documents, selectedId, onSelect, onNewDocument, onDeleteFolder }) {
  const childFolders = folders.filter((f) => f.parent === folder.id)
  const childDocs = documents.filter((d) => d.folder === folder.id)

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="flex-1 truncate">{folder.name}</span>
        <button
          onClick={() => onNewDocument(folder.id)}
          title="New doc in folder"
          className="text-slate-300 opacity-0 transition hover:text-violet-600 group-hover:opacity-100"
        >
          <IconPlus width={13} height={13} />
        </button>
        <button
          onClick={() => onDeleteFolder(folder)}
          title="Delete folder"
          className="text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
        >
          <IconTrash width={13} height={13} />
        </button>
      </div>
      {childDocs.map((d) => (
        <DocRow key={d.id} doc={d} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
      {childFolders.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          depth={depth + 1}
          folders={folders}
          documents={documents}
          selectedId={selectedId}
          onSelect={onSelect}
          onNewDocument={onNewDocument}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </div>
  )
}

function DocRow({ doc, depth, selectedId, onSelect }) {
  const active = doc.id === selectedId
  return (
    <button
      onClick={() => onSelect(doc.id)}
      style={{ paddingLeft: 8 + depth * 12 }}
      className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition ${
        active ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <IconDocuments width={15} height={15} className="shrink-0 text-slate-400" />
      <span className="truncate">{doc.title}</span>
    </button>
  )
}
