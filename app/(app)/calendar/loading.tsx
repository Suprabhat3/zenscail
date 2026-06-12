export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-800" />
        <div className="h-8 w-56 animate-pulse rounded bg-neutral-800" />
      </div>
      <div className="mt-6 grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="min-h-48 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900 p-2"
          >
            <div className="h-3 w-8 rounded bg-neutral-800" />
            <div className="mt-1 h-5 w-6 rounded bg-neutral-800" />
            <div className="mt-3 h-8 rounded bg-neutral-800/60" />
            <div className="mt-1.5 h-8 rounded bg-neutral-800/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
