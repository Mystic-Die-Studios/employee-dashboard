// Local-first document store for the wiki.
//
// It mirrors the backend contract in BACKEND_PLAN.md (folders / documents / revisions /
// attachments, same payload shapes) so switching to the real API is a contained change:
// replace each function body with the axios call noted above it. Until the Django endpoints
// are live, this persists to localStorage so the wiki is fully usable offline.
//
// Caveat: attachment files use in-session blob URLs; their `url` won't survive a page reload
// (metadata does). Real file storage arrives with the backend.

const KEY = 'wiki.v1'

let actor = { login: 'demo-employee', name: 'Demo Employee', avatar_url: null }

// Called once from the Documents page so authorship reflects the signed-in user.
export function setActor(user) {
  if (user) actor = { login: user.login, name: user.name, avatar_url: user.avatar_url ?? null }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const nowISO = () => new Date().toISOString()
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'untitled'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to seed */
  }
  const seeded = seed()
  save(seeded)
  return seeded
}

function save(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage unavailable — ignore */
  }
}

// ---- Folders -------------------------------------------------------------

// GET /api/folders/
export async function listFolders() {
  return load().folders
}

// POST /api/folders/  { name, parent }
export async function createFolder({ name, parent = null }) {
  const db = load()
  const t = nowISO()
  const folder = {
    id: uid(),
    name: name || 'New folder',
    slug: slugify(name || 'folder'),
    parent,
    created_by: actor,
    created_at: t,
    updated_at: t,
  }
  db.folders.push(folder)
  save(db)
  return { ...folder }
}

// DELETE /api/folders/{id}/?recursive=
export async function deleteFolder(id, { recursive = false } = {}) {
  const db = load()
  const hasDocs = db.documents.some((d) => d.folder === id)
  const hasSub = db.folders.some((f) => f.parent === id)
  if ((hasDocs || hasSub) && !recursive) {
    const e = new Error('Folder is not empty')
    e.code = 409
    throw e
  }
  const doomed = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const f of db.folders) {
      if (f.parent && doomed.has(f.parent) && !doomed.has(f.id)) {
        doomed.add(f.id)
        changed = true
      }
    }
  }
  db.documents = db.documents.filter((d) => !doomed.has(d.folder))
  db.folders = db.folders.filter((f) => !doomed.has(f.id))
  db.revisions = db.revisions.filter((r) => db.documents.some((d) => d.id === r.document))
  save(db)
}

// ---- Documents -----------------------------------------------------------

// GET /api/documents/  (?q=)  — list omits `content`, adds attachment_count
export async function listDocuments({ q } = {}) {
  const db = load()
  let docs = db.documents
  if (q) {
    const needle = q.toLowerCase()
    docs = docs.filter(
      (d) => d.title.toLowerCase().includes(needle) || d.content.toLowerCase().includes(needle),
    )
  }
  return docs.map(({ content, ...rest }) => ({ ...rest, attachment_count: rest.attachments.length }))
}

// GET /api/documents/{id}/  — full content
export async function getDocument(id) {
  const doc = load().documents.find((d) => d.id === id)
  if (!doc) throw new Error('Document not found')
  return { ...doc }
}

// POST /api/documents/  → writes revision 1
export async function createDocument({ title, folder = null, content = '' }) {
  const db = load()
  const t = nowISO()
  const doc = {
    id: uid(),
    title: title || 'Untitled',
    slug: slugify(title || 'untitled'),
    folder,
    content,
    revision_number: 1,
    attachments: [],
    created_by: actor,
    updated_by: actor,
    created_at: t,
    updated_at: t,
  }
  db.documents.push(doc)
  db.revisions.push({
    id: uid(),
    document: doc.id,
    revision_number: 1,
    title: doc.title,
    content,
    edited_by: actor,
    comment: 'Created',
    created_at: t,
  })
  save(db)
  return { ...doc }
}

// PATCH /api/documents/{id}/  → appends a revision, sets updated_by
export async function updateDocument(id, { title, content, comment = '' }) {
  const db = load()
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) throw new Error('Document not found')
  const t = nowISO()
  if (title != null) {
    doc.title = title
    doc.slug = slugify(title)
  }
  if (content != null) doc.content = content
  doc.revision_number += 1
  doc.updated_by = actor
  doc.updated_at = t
  db.revisions.push({
    id: uid(),
    document: doc.id,
    revision_number: doc.revision_number,
    title: doc.title,
    content: doc.content,
    edited_by: actor,
    comment,
    created_at: t,
  })
  save(db)
  return { ...doc }
}

// DELETE /api/documents/{id}/
export async function deleteDocument(id) {
  const db = load()
  db.documents = db.documents.filter((d) => d.id !== id)
  db.revisions = db.revisions.filter((r) => r.document !== id)
  save(db)
}

// ---- Revisions -----------------------------------------------------------

// GET /api/documents/{id}/revisions/
export async function listRevisions(docId) {
  return load()
    .revisions.filter((r) => r.document === docId)
    .sort((a, b) => b.revision_number - a.revision_number)
}

// POST /api/documents/{id}/revisions/{n}/restore/  → restores as a NEW revision
export async function restoreRevision(docId, n) {
  const rev = load().revisions.find((r) => r.document === docId && r.revision_number === n)
  if (!rev) throw new Error('Revision not found')
  return updateDocument(docId, {
    title: rev.title,
    content: rev.content,
    comment: `Restored from revision ${n}`,
  })
}

// ---- Attachments ---------------------------------------------------------

// POST /api/documents/{id}/attachments/  (multipart, field `file`)
export async function addAttachment(docId, file) {
  const db = load()
  const doc = db.documents.find((d) => d.id === docId)
  if (!doc) throw new Error('Document not found')
  const att = {
    id: uid(),
    original_name: file.name,
    size: file.size,
    content_type: file.type || 'application/octet-stream',
    url: URL.createObjectURL(file),
    uploaded_by: actor,
    created_at: nowISO(),
  }
  doc.attachments.push(att)
  save(db)
  return att
}

// DELETE /api/attachments/{id}/
export async function removeAttachment(docId, attId) {
  const db = load()
  const doc = db.documents.find((d) => d.id === docId)
  if (!doc) return
  doc.attachments = doc.attachments.filter((a) => a.id !== attId)
  save(db)
}

// ---- Seed ----------------------------------------------------------------

function seed() {
  const t = nowISO()
  const eng = { id: uid(), name: 'Engineering', slug: 'engineering', parent: null, created_by: actor, created_at: t, updated_at: t }
  const design = { id: uid(), name: 'Design', slug: 'design', parent: null, created_by: actor, created_at: t, updated_at: t }

  const mk = (title, folder, content) => ({
    id: uid(),
    title,
    slug: slugify(title),
    folder,
    content,
    revision_number: 1,
    attachments: [],
    created_by: actor,
    updated_by: actor,
    created_at: t,
    updated_at: t,
  })

  const documents = [
    mk('Welcome to the Wiki', null, WELCOME_MD),
    mk('Combat System Spec', eng.id, COMBAT_MD),
    mk('Onboarding Checklist', eng.id, ONBOARDING_MD),
    mk('Art Style Guide', design.id, ART_MD),
  ]
  const revisions = documents.map((d) => ({
    id: uid(),
    document: d.id,
    revision_number: 1,
    title: d.title,
    content: d.content,
    edited_by: actor,
    comment: 'Created',
    created_at: t,
  }))

  return { folders: [eng, design], documents, revisions }
}

const WELCOME_MD = `# Welcome to the Mystic Die Wiki

This is the team's shared knowledge base. Anyone signed in can **create**, **edit**, and
**organize** documents — every save keeps a full revision history.

## How it works
- Pick a document from the tree on the left, or create a new one.
- Click **Edit** to write in Markdown — the preview updates as you type.
- Attach files (specs, art, spreadsheets) directly to a document.

> Tip: use folders to group docs by team — Engineering, Design, and so on.

Happy writing! ✨
`

const COMBAT_MD = `# Combat System Spec

The combat loop is **turn-based** with party-relationship modifiers.

## Turn order
1. Compute initiative from \`speed + affinity_bonus\`
2. Resolve actions highest-first
3. Apply status effects at end of round

## Relationship modifiers
| Bond level | Damage | Support |
|------------|--------|---------|
| Rival      | +5%    | −10%    |
| Neutral    | 0%     | 0%      |
| Ally       | +10%   | +15%    |

See the [Art Style Guide](#) for VFX direction.
`

const ONBOARDING_MD = `# Onboarding Checklist

- [x] Get a GitHub account added to the org
- [x] Clone the repos
- [ ] Read the Combat System Spec
- [ ] Set up the local docker stack
- [ ] Say hi in #general

Reach out to **People Ops** if anything is blocking you.
`

const ART_MD = `# Art Style Guide

Our palette leans **warm dusk** tones with a single cool accent.

- Primary: \`#aa3bff\` (Mystic violet)
- Ink: \`#0f172a\`
- Parchment: \`#f4f3ec\`

Keep tilesets at **32×32**, hand-painted, minimal outlines.
`
