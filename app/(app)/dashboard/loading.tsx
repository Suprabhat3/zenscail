export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-8">
      <div className="h-3 w-40 rounded bg-(--bg-deep)" />
      <div className="mt-3 h-10 w-72 rounded-lg bg-(--bg-deep)" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-(--bg-deep)" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-(--line-soft) bg-(--paper)" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div className="h-48 rounded-2xl border border-(--line-soft) bg-(--paper)" />
          <div className="h-72 rounded-2xl border border-(--line-soft) bg-(--paper)" />
        </div>
        <div className="space-y-6">
          <div className="h-64 rounded-2xl border border-(--line-soft) bg-(--paper)" />
          <div className="h-40 rounded-2xl border border-(--line-soft) bg-(--paper)" />
        </div>
      </div>
    </div>
  );
}
