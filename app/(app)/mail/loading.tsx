export default function MailLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="h-8 w-28 rounded-lg bg-(--bg-deep)" />
          <div className="mt-2 h-3.5 w-32 rounded bg-(--bg-deep)" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-56 rounded-full bg-(--bg-deep)" />
          <div className="h-9 w-24 rounded-full bg-(--bg-deep)" />
          <div className="h-9 w-28 rounded-full bg-(--bg-deep)" />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex items-center gap-5 border-b border-(--line-soft) pb-2.5">
        <div className="h-3.5 w-8 rounded bg-(--bg-deep)" />
        <div className="h-3.5 w-20 rounded bg-(--bg-deep)" />
        <div className="h-3.5 w-14 rounded bg-(--bg-deep)" />
      </div>

      {/* Rows */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        <ul className="divide-y divide-(--line-soft)">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
              <div className="h-9 w-9 shrink-0 rounded-full bg-(--bg-deep)" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-3.5 w-40 rounded bg-(--bg-deep)" />
                  <div className="h-3 w-12 rounded bg-(--bg-deep)" />
                </div>
                <div className="mt-2 h-3.5 w-2/3 rounded bg-(--bg-deep)" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-(--bg-deep)/60" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
