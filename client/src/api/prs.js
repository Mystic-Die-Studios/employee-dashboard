// My pull requests. Real source: GET /api/github/pulls/ (backend proxies the GitHub
// Search API — is:pr author:@me — with a token). Local-first seed until that's wired.

const SEED = [
  {
    id: 1, title: 'Add party relationship scoring to combat', repo: 'Project-Reconnection',
    number: 42, status: 'open', review: 'changes_requested', checks: 'passing', updated: '2h ago',
    url: 'https://github.com/Mystic-Die-Studios/Project-Reconnection/pull/42',
  },
  {
    id: 2, title: 'Fix save/load race on quit', repo: 'Project-Reconnection',
    number: 39, status: 'open', review: 'approved', checks: 'passing', updated: 'yesterday',
    url: 'https://github.com/Mystic-Die-Studios/Project-Reconnection/pulls',
  },
  {
    id: 3, title: 'Wire employee dashboard auth', repo: 'employee-dashboard',
    number: 7, status: 'draft', review: 'review_required', checks: 'failing', updated: '3d ago',
    url: 'https://github.com/Mystic-Die-Studios/employee-dashboard/pulls',
  },
  {
    id: 4, title: 'Forest tileset v3 import', repo: 'Project-Reconnection',
    number: 36, status: 'merged', review: 'approved', checks: 'passing', updated: 'last week',
    url: 'https://github.com/Mystic-Die-Studios/Project-Reconnection/pulls',
  },
]

export async function myPulls() {
  return SEED
}
