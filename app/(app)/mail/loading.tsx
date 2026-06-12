export default function MailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-24 animate-pulse rounded bg-neutral-800" />
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-800" />
      </div>
      <ul className="mt-6 divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-40 animate-pulse rounded bg-neutral-800" />
              <div className="h-3 w-12 animate-pulse rounded bg-neutral-800" />
            </div>
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-neutral-800" />
            <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-neutral-800/60" />
          </li>
        ))}
      </ul>
    </div>
  );
}
