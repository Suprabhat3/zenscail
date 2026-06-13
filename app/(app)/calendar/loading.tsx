export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <div className="h-8 w-36 rounded-lg bg-(--bg-deep)" />
          <div className="h-4 w-24 rounded bg-(--bg-deep)" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded-full bg-(--bg-deep)" />
          <div className="h-9 w-24 rounded-full bg-(--bg-deep)" />
          <div className="h-9 w-28 rounded-full bg-(--bg-deep)" />
        </div>
      </div>

      {/* Week grid */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        {/* Day headers */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-(--line-soft) bg-(--bg)">
          <div className="px-2 py-3" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3">
              <div className="h-3 w-8 rounded bg-(--bg-deep)" />
              <div className="h-8 w-8 rounded-full bg-(--bg-deep)" />
            </div>
          ))}
        </div>

        {/* Hour rows with scattered event blocks */}
        {Array.from({ length: 6 }).map((_, r) => (
          <div
            key={r}
            className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-(--line-soft)"
          >
            <div className="px-2 py-4">
              <div className="h-3 w-9 rounded bg-(--bg-deep)" />
            </div>
            {Array.from({ length: 7 }).map((_, c) => (
              <div key={c} className="border-l border-(--line-soft) p-1.5">
                {(r + c) % 3 === 0 && (
                  <div className="h-10 rounded-lg border-l-2 border-(--line) bg-(--bg-deep)" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
