import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center">
      <div>
        <div className="text-6xl font-bold text-slate-300">404</div>
        <p className="mt-2 text-slate-500">This page doesn’t exist.</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-medium text-violet-600 hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}
