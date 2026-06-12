type Priority = "urgent" | "normal" | "low";

const STYLES: Record<Priority, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
  },
  normal: {
    label: "Normal",
    className: "border-neutral-600 bg-neutral-800 text-neutral-300",
  },
  low: {
    label: "Low",
    className: "border-neutral-700 bg-neutral-900 text-neutral-500",
  },
};

export function PriorityBadge({
  priority,
  reason,
}: {
  priority: Priority;
  reason?: string | null;
}) {
  const s = STYLES[priority];
  return (
    <span
      title={reason ?? undefined}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}
