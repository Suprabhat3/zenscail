type Priority = "urgent" | "normal" | "low";

const STYLES: Record<Priority, { label: string; className: string; dot: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-(--accent-soft) text-(--accent-deep)",
    dot: "bg-(--accent)",
  },
  normal: {
    label: "Normal",
    className: "bg-[#EAEFE4] text-[#4D5C40]",
    dot: "bg-(--sage)",
  },
  low: {
    label: "Low",
    className: "bg-(--bg-deep) text-(--muted)",
    dot: "bg-(--line)",
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${s.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
