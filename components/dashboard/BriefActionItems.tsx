"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BriefActionItem, BriefItemStates } from "@/lib/ai/brief";
import { setBriefItemStateAction } from "@/app/(app)/dashboard/actions";
import { useDemo } from "@/components/demo/DemoProvider";
import { AskItemButton } from "./BriefChatButtons";
import { useNow } from "./useNow";

const URGENCY: Record<
  BriefActionItem["urgency"],
  { label: string; chip: string; bar: string }
> = {
  high: { label: "Urgent", chip: "bg-(--accent-soft) text-(--accent-deep)", bar: "bg-(--accent)" },
  medium: { label: "Today", chip: "bg-[#F7ECD8] text-[#8A5F1E]", bar: "bg-(--gold)" },
  low: { label: "Soon", chip: "bg-(--bg-deep) text-(--muted)", bar: "bg-(--line)" },
};

/** Mirror of itemKey() in lib/ai/brief.ts (kept here to avoid a server-only import). */
function keyOf(item: BriefActionItem): string {
  return [item.threadId ?? "", item.title].join("|");
}

/** Snooze presets, resolved to an ISO time relative to `now`. */
function snoozeOptions(): { label: string; at: () => string }[] {
  return [
    {
      label: "This afternoon",
      at: () => {
        const d = new Date();
        d.setHours(14, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setTime(Date.now() + 3 * 3600_000);
        return d.toISOString();
      },
    },
    {
      label: "This evening",
      at: () => {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setTime(Date.now() + 2 * 3600_000);
        return d.toISOString();
      },
    },
    {
      label: "Tomorrow",
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d.toISOString();
      },
    },
  ];
}

function fmtShort(iso: string, now: number): string {
  const d = new Date(iso);
  const sameDay = now > 0 && d.toDateString() === new Date(now).toDateString();
  return d.toLocaleString("en-US", {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActionItemRow({
  item,
  onDone,
  onSnooze,
}: {
  item: BriefActionItem;
  onDone: () => void;
  onSnooze: (at: string) => void;
}) {
  const u = URGENCY[item.urgency] ?? URGENCY.low;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li className="group relative flex gap-4 rounded-xl border border-(--line-soft) bg-(--bg) p-4 transition hover:border-(--line) hover:shadow-(--shadow-card)">
      <button
        onClick={onDone}
        title="Mark done"
        aria-label="Mark done"
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-(--line) text-transparent transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
      <span className={`w-1 shrink-0 self-stretch rounded-full ${u.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-(--ink)">{item.title}</p>
          <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase ${u.chip}`}>
            {u.label}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-(--ink-soft)">{item.detail}</p>
        {item.subject && (
          <p className="mt-1.5 truncate text-xs text-(--muted)">
            ✉ {item.subject} — {item.from}
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          {item.threadId && (
            <Link
              href={`/mail/thread/${item.threadId}`}
              className="rounded-full bg-(--ink) px-3 py-1 text-xs font-semibold text-(--bg) transition hover:bg-(--accent)"
            >
              View email →
            </Link>
          )}
          <AskItemButton title={item.title} subject={item.subject} from={item.from} />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="rounded-full border border-(--line) px-3 py-1 text-xs font-semibold text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
            >
              Snooze
            </button>
            {menuOpen && (
              <div className="absolute z-10 mt-1 w-40 overflow-hidden rounded-xl border border-(--line) bg-(--paper) shadow-(--shadow-card)">
                {snoozeOptions().map((o) => (
                  <button
                    key={o.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onSnooze(o.at());
                    }}
                    className="block w-full px-3 py-2 text-left text-xs font-semibold text-(--ink-soft) transition hover:bg-(--accent-soft) hover:text-(--accent-deep)"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function BriefActionItems({
  items,
  initialStates,
}: {
  items: BriefActionItem[];
  initialStates: BriefItemStates;
}) {
  const router = useRouter();
  const { active: demo, requireLogin } = useDemo();
  const [states, setStates] = useState<BriefItemStates>(initialStates);
  const [, startTransition] = useTransition();
  const now = useNow();

  function commit(key: string, next: BriefItemStates[string] | null) {
    if (demo) {
      requireLogin("Sign in to check off and snooze the things on your plate.");
      return;
    }
    setStates((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    startTransition(async () => {
      await setBriefItemStateAction(key, next);
      router.refresh();
    });
  }

  // Classify each item by its current (optimistic) state.
  const active: BriefActionItem[] = [];
  const snoozed: { item: BriefActionItem; until: string }[] = [];
  const done: BriefActionItem[] = [];
  for (const item of items) {
    const st = states[keyOf(item)];
    if (st?.status === "done") done.push(item);
    else if (st?.status === "snoozed" && st.until && Date.parse(st.until) > now) {
      snoozed.push({ item, until: st.until });
    } else active.push(item);
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-sm text-(--muted)">Nothing pressing — enjoy the quiet inbox.</p>
    );
  }

  return (
    <div className="mt-4">
      {active.length > 0 ? (
        <ul className="space-y-3">
          {active.map((item) => {
            const key = keyOf(item);
            return (
              <ActionItemRow
                key={key}
                item={item}
                onDone={() => commit(key, { status: "done" })}
                onSnooze={(until) => commit(key, { status: "snoozed", until })}
              />
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-(--line) px-4 py-6 text-center text-sm text-(--muted)">
          {done.length > 0 ? "All caught up — every item handled. 🎉" : "Nothing pressing right now."}
        </p>
      )}

      {snoozed.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-bold tracking-widest text-(--muted) uppercase">Snoozed</p>
          {snoozed.map(({ item, until }) => (
            <div
              key={keyOf(item)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-(--muted)"
            >
              <span className="min-w-0 flex-1 truncate">💤 {item.title}</span>
              <span className="shrink-0">until {fmtShort(until, now)}</span>
              <button
                onClick={() => commit(keyOf(item), null)}
                className="shrink-0 font-semibold text-(--accent) hover:text-(--accent-deep)"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-5 space-y-1.5">
          <p className="text-[11px] font-bold tracking-widest text-[#4D5C40] uppercase">
            Done today · {done.length}
          </p>
          {done.map((item) => (
            <div
              key={keyOf(item)}
              className="flex items-center gap-2.5 rounded-lg border border-[#D6E0CB] bg-[#EAEFE4] px-3 py-2 text-sm"
            >
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-(--sage) text-white">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-[#4D5C40] line-through">{item.title}</span>
              <button
                onClick={() => commit(keyOf(item), null)}
                className="shrink-0 text-xs font-semibold text-(--sage) hover:text-[#4D5C40]"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
