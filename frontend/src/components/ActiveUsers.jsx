// src/components/ActiveUsers.jsx
// Small pill list showing who's currently viewing the document.

export default function ActiveUsers({ users }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">Online now:</span>
      {users.length === 0 && <span className="text-xs text-slate-400">just you</span>}
      {users.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="bg-brand/10 text-brand-dark text-xs font-medium px-2 py-1 rounded-full"
        >
          {name}
        </span>
      ))}
    </div>
  );
}
