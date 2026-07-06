// Internal trackers — art reviews, change requests, and bugs.
// Real source: the Django tracker_app (see server/tracker_app):
//   GET/POST  /api/art-reviews/ | /api/change-requests/ | /api/bugs/
//   PATCH     /api/{collection}/{id}/   { status }
// Local-first: seed + a localStorage overlay for status changes and new items.

const KEY = 'tracker.v1'

const SEED = {
  art: [
    { id: 'a1', title: 'Combat UI — ability icons v2', submitter: 'Marcus Lee', reviewer: 'Ava Chen', status: 'changes_requested', note: 'Tighten contrast on cooldown states.', created_at: 'Jul 2' },
    { id: 'a2', title: 'Forest tileset v3', submitter: 'Marcus Lee', reviewer: 'You', status: 'approved', note: 'Palette matches the lighting pass.', created_at: 'Jul 1' },
    { id: 'a3', title: 'Main menu key art', submitter: 'Nina Petrova', reviewer: 'Ava Chen', status: 'pending', note: '', created_at: 'Jul 3' },
  ],
  cr: [
    { id: 'c1', title: 'Rebalance ally support bonus to +12%', requester: 'Priya Rao', status: 'in_review', priority: 'high', created_at: 'Jul 3', description: 'Ally support at +15% overshadows rival builds in playtests.' },
    { id: 'c2', title: 'Add colorblind palette option', requester: 'Nina Petrova', status: 'open', priority: 'medium', created_at: 'Jul 2', description: 'QA flagged red/green cooldown states as hard to distinguish.' },
    { id: 'c3', title: 'Move sprint planning to Mondays', requester: 'Ava Chen', status: 'approved', priority: 'low', created_at: 'Jun 30', description: '' },
  ],
  bugs: [
    { id: 'b1', title: 'Save corrupts on quit during combat', severity: 'critical', status: 'in_progress', reporter: 'Nina Petrova', assignee: 'Priya Rao', created_at: 'Jul 3', description: 'Quitting mid-turn writes a partial save that fails to load.' },
    { id: 'b2', title: 'Affinity value shows 2 decimals in UI', severity: 'low', status: 'open', reporter: 'Sam Okafor', assignee: 'You', created_at: 'Jul 2', description: '' },
    { id: 'b3', title: 'Tileset seam visible at chunk borders', severity: 'medium', status: 'open', reporter: 'Marcus Lee', assignee: '—', created_at: 'Jul 1', description: '' },
    { id: 'b4', title: 'Audio ducking not resetting after cutscene', severity: 'high', status: 'fixed', reporter: 'Sam Okafor', assignee: 'Sam Okafor', created_at: 'Jun 28', description: '' },
  ],
}

function store() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { status: {}, added: {} }
  } catch {
    return { status: {}, added: {} }
  }
}
function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export async function list(type) {
  const s = store()
  const withStatus = (i) => ({ ...i, status: s.status[i.id] || i.status })
  const added = (s.added[type] || []).map(withStatus)
  const seeded = SEED[type].map(withStatus)
  return [...added, ...seeded]
}

export async function setStatus(type, id, status) {
  const s = store()
  s.status[id] = status
  save(s)
}

export async function create(type, item) {
  const s = store()
  const it = { id: 'x' + Date.now(), created_at: 'Just now', ...item }
  s.added = s.added || {}
  s.added[type] = [it, ...(s.added[type] || [])]
  save(s)
  return it
}
