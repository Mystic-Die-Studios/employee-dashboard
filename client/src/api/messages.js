// Inbox — a unified feed of three sources:
//   internal  → person-to-person messages between employees (compose/send)
//   system    → app/service notifications (GitHub, People Ops)
//   slack     → alerts mirrored from Slack channels
//
// Real source is the backend (see AGENT_UPDATES.md):
//   GET   /api/messages/                  → the feed, newest first
//   GET   /api/messages/unread_count/     → { count }
//   PATCH /api/messages/{id}/  { read }   → mark read
//   POST  /api/messages/  { to, subject, body }  → send an internal message
//   GET   /api/users/                     → org directory for the recipient picker
// Until then this is local-first: seed feed + a localStorage overlay for read
// state and sent messages.

export const SOURCES = ['internal', 'system', 'slack']

const KEY = 'inbox.state.v1'
const ME = { login: 'demo-employee', name: 'Demo Employee', avatar_url: null }

const SEED = [
  {
    id: 'm1', source: 'internal', direction: 'in',
    sender: { name: 'Ava Chen', login: 'ava', role: 'Producer' },
    subject: 'Milestone 3 timeline', unread: true, created_at: '9:12 AM',
    body: 'Can you confirm the combat vertical slice will be ready for the March 15 milestone review?\n\nIf the party-relationship scoring needs another sprint, tell me today so I can adjust the roadmap.',
  },
  {
    id: 'm2', source: 'slack', channel: '#deploys', sender: { name: 'Slack' },
    subject: 'CI: build 0.3.128 passed ✅', unread: true, created_at: '8:47 AM',
    body: 'main → build 0.3.128 passed in 4m 12s. Artifacts uploaded.\nTriggered by @dev (PR #42).',
  },
  {
    id: 'm3', source: 'system', sender: { name: 'GitHub' },
    subject: 'PR #42 ready for review', unread: false, created_at: '8:03 AM',
    body: '@dev opened pull request #42: "Add party relationship scoring to combat".\n12 files changed · +480 −96. Two reviewers requested.',
  },
  {
    id: 'm4', source: 'slack', channel: '#combat-team', sender: { name: 'Slack' },
    subject: '@here playtest at 3pm', unread: false, created_at: 'Yesterday',
    body: 'Reminder: combat playtest in the Green room at 3pm. Bring the latest build.',
  },
  {
    id: 'm5', source: 'internal', direction: 'in',
    sender: { name: 'Marcus Lee', login: 'marcus', role: 'Art Lead' },
    subject: 'Tileset handoff', unread: false, created_at: 'Yesterday',
    body: 'Uploaded the forest tilesets (v3) to the Documents area. Let me know if the palette works with the current lighting pass.',
  },
  {
    id: 'm6', source: 'system', sender: { name: 'People Ops' },
    subject: 'Quarterly check-in', unread: false, created_at: 'Mon',
    body: 'Reminder: please schedule your quarterly check-in before the end of the month.',
  },
]

const DIRECTORY = [
  { login: 'ava', name: 'Ava Chen', role: 'Producer' },
  { login: 'marcus', name: 'Marcus Lee', role: 'Art Lead' },
  { login: 'priya', name: 'Priya Rao', role: 'Engineering' },
  { login: 'sam', name: 'Sam Okafor', role: 'Audio' },
  { login: 'nina', name: 'Nina Petrova', role: 'QA' },
]

function state() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { read: {}, sent: [] }
  } catch {
    return { read: {}, sent: [] }
  }
}
function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export async function list() {
  const s = state()
  const seeded = SEED.map((m) => ({ ...m, unread: s.read[m.id] ? false : m.unread }))
  return [...s.sent, ...seeded]
}

export async function unreadCount() {
  return (await list()).filter((m) => m.unread).length
}

export async function markRead(id) {
  const s = state()
  s.read[id] = true
  saveState(s)
}

export async function send({ to, subject, body }) {
  const s = state()
  const recipient = DIRECTORY.find((u) => u.login === to) || { name: to, login: to }
  const msg = {
    id: 'sent_' + Date.now(),
    source: 'internal',
    direction: 'out',
    sender: ME,
    to: recipient,
    subject: subject?.trim() || '(no subject)',
    body,
    unread: false,
    created_at: 'Just now',
  }
  s.sent = [msg, ...s.sent]
  saveState(s)
  return msg
}

export async function directory() {
  return DIRECTORY
}
