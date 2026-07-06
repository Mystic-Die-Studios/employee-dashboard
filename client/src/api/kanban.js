// Kanban integration — the To-Do list and Kanban section are backed by the team
// board at kanban.mysticdie.com (the external IssueKanbanWrapper app).
//
// Real source is the backend bridge (server/kanban_app):
//   GET   /api/kanban/my-tasks/         → cards assigned to the current user
//   PATCH /api/kanban/my-tasks/{id}/    → { done } moves the card to/from Done
//   GET   /api/kanban/status/?summary=1 → board column summary
// Until that's wired, this is local-first: seed cards + a localStorage overlay
// for optimistic done-toggles. Swap each body for the fetch when the bridge is live.

export const KANBAN_URL = 'https://kanban.mysticdie.com'

const KEY = 'kanban.overlay.v1'

const SEED_TASKS = [
  { id: 'k1', title: 'Review combat prototype PR', status: 'In Progress', due: 'Today', points: 3, done: false },
  { id: 'k2', title: 'Write patch notes for build 0.3', status: 'To Do', due: 'Jul 4', points: 2, done: false },
  { id: 'k3', title: 'Fix party-affinity rounding bug', status: 'In Progress', due: 'Jul 5', points: 1, done: false },
  { id: 'k4', title: 'Prep Milestone 3 demo build', status: 'To Do', due: 'Jul 8', points: 5, done: false },
  { id: 'k5', title: 'Sync with art team on tilesets', status: 'Done', due: 'Jul 2', points: 2, done: true },
]

const SEED_BOARD = {
  connected: false, // true once the backend bridge (KANBAN_BRIDGE_URL/SECRET) is configured
  columns: [
    { name: 'To Do', count: 7 },
    { name: 'In Progress', count: 4 },
    { name: 'In Review', count: 2 },
    { name: 'Done', count: 23 },
  ],
  recent: [
    { title: 'Add party relationship scoring to combat', status: 'In Review', assignee: 'You' },
    { title: 'Forest tileset v3 import', status: 'Done', assignee: 'Marcus Lee' },
    { title: 'Save/load system spike', status: 'In Progress', assignee: 'Priya Rao' },
  ],
}

function overlay() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function saveOverlay(o) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    /* ignore */
  }
}

export async function myTasks() {
  const o = overlay()
  return SEED_TASKS.map((t) => {
    const done = o[t.id] ?? t.done
    return { ...t, done, status: done ? 'Done' : t.status }
  })
}

export async function setTaskDone(id, value) {
  const o = overlay()
  o[id] = value
  saveOverlay(o)
}

export async function boardSummary() {
  return SEED_BOARD
}
