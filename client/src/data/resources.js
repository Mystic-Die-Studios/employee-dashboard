// Curated resource directory shown on the Resources page. Static config for now;
// a backend-managed version can come later (GET /api/resources/).

export const RESOURCE_GROUPS = [
  {
    title: 'Engineering',
    items: [
      { label: 'Project-Reconnection', href: 'https://github.com/Mystic-Die-Studios/Project-Reconnection', desc: 'Main game repo' },
      { label: 'Employee Dashboard', href: 'https://github.com/Mystic-Die-Studios/employee-dashboard', desc: 'This app' },
      { label: 'CI / Builds', href: '#', desc: 'Latest builds & artifacts' },
      { label: 'Coding standards', href: '#', desc: 'Style guide & PR checklist' },
    ],
  },
  {
    title: 'Design & Art',
    items: [
      { label: 'Art Style Guide', href: '#', desc: 'Palette, tilesets, outlines' },
      { label: 'Figma — UI kit', href: '#', desc: 'Screens & components' },
      { label: 'Reference board', href: '#', desc: 'Mood & concept refs' },
    ],
  },
  {
    title: 'Project & Ops',
    items: [
      { label: 'Kanban board', href: 'https://kanban.mysticdie.com', desc: 'Sprints, timeline & stats' },
      { label: 'Milestone roadmap', href: '#', desc: 'Milestone 3 timeline' },
      { label: 'Slack', href: '#', desc: '#general · #deploys · #combat-team' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Time off / PTO', href: '#', desc: 'Requests & balances' },
      { label: 'Benefits & payroll', href: '#', desc: 'People Ops portal' },
      { label: 'Org chart', href: '#', desc: 'Who does what' },
    ],
  },
]

export const QUICK_REFS = [
  { label: 'Run the whole stack', code: 'docker-compose up' },
  { label: 'Frontend dev server', code: 'npm run dev --prefix client' },
  { label: 'Backend tests (sqlite)', code: 'DB_ENGINE=sqlite python manage.py test' },
  { label: 'Build number format', code: '0.<minor>.<ci-run>' },
]
