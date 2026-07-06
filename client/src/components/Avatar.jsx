// Renders a user's GitHub avatar, or an initials fallback when none is set.
export default function Avatar({ user, size = 32 }) {
  const dim = { width: size, height: size }

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        style={dim}
        className="rounded-full bg-slate-200 object-cover"
      />
    )
  }

  const label = (user?.name || user?.login || '?').slice(0, 2).toUpperCase()
  return (
    <div
      style={dim}
      className="grid place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700"
    >
      {label}
    </div>
  )
}
