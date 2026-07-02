"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SenderAvatar } from "@/components/mail/SenderAvatar";
import { useToast } from "@/components/ui/Toast";
import { UnsubscribeCelebration } from "@/components/mail/UnsubscribeCelebration";
import {
  unsubscribeSendersAction,
  type SenderUnsubscribeResult,
} from "@/app/(app)/mail/subscriptions/actions";

export type SubscriptionSender = {
  /** Lower-cased bare email — the row key and grouping key. */
  addr: string;
  name: string;
  /** Raw From header value of the latest message (for the avatar). */
  from: string;
  /** How many messages from this sender are in the local cache. */
  count: number;
  /** Latest message id — the unsubscribe headers are read from it. */
  messageId: string;
  latestSubject: string;
  latestDate: string;
};

/**
 * The Subscriptions manager: every newsletter sender in one place, with
 * per-sender and select-all → bulk unsubscribe. Rows swoosh out as they're
 * freed, and finishing a batch plays the calm "breathe out" celebration.
 */
export function SubscriptionsList({ senders }: { senders: SubscriptionSender[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Rows currently animating out (action succeeded). */
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  /** Rows fully removed from the list. */
  const [gone, setGone] = useState<Set<string>>(new Set());
  /** Which addrs are mid-flight, to disable just those rows. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<{
    count: number;
    links: { name: string; url: string }[];
  } | null>(null);

  const visible = useMemo(
    () => senders.filter((s) => !gone.has(s.addr)),
    [senders, gone],
  );
  const allSelected = visible.length > 0 && visible.every((s) => selected.has(s.addr));
  const selectedCount = visible.filter((s) => selected.has(s.addr)).length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visible.map((s) => s.addr)));
  };
  const toggleOne = (addr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  const run = (targets: SubscriptionSender[]) => {
    if (targets.length === 0 || isPending) return;
    const addrs = new Set(targets.map((s) => s.addr));
    setBusy(addrs);
    startTransition(async () => {
      let results: SenderUnsubscribeResult[];
      try {
        const res = await unsubscribeSendersAction({
          senders: targets.map((s) => ({
            addr: s.addr,
            name: s.name,
            messageId: s.messageId,
          })),
        });
        results = res.results;
      } catch {
        setBusy(new Set());
        toast("Couldn't unsubscribe right now — please try again.");
        return;
      }
      setBusy(new Set());

      const okResults = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const okAddrs = new Set(okResults.map((r) => r.addr));
      const nameOf = (addr: string) =>
        targets.find((s) => s.addr === addr)?.name ?? addr;

      if (okAddrs.size > 0) {
        // Swoosh the freed rows out, then drop them and celebrate.
        setLeaving(okAddrs);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const a of okAddrs) next.delete(a);
          return next;
        });
        setTimeout(() => {
          setGone((prev) => new Set([...prev, ...okAddrs]));
          setLeaving(new Set());
          setCelebration({
            count: okAddrs.size,
            links: okResults
              .filter((r) => r.method === "link" && r.link)
              .map((r) => ({ name: nameOf(r.addr), url: r.link! })),
          });
        }, 450);
      }
      if (failed.length > 0) {
        toast(
          failed.length === 1
            ? `Couldn't unsubscribe from ${nameOf(failed[0].addr)}: ${failed[0].error ?? "unknown error"}`
            : `Couldn't unsubscribe from ${failed.length} senders — try them individually.`,
          { duration: 6000 },
        );
      }
    });
  };

  if (visible.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-20 text-center shadow-(--shadow-card)">
        <span aria-hidden className="text-3xl">🕊️</span>
        <p className="mt-3 font-serif text-lg text-(--ink)">Nothing to unsubscribe from</p>
        <p className="mt-1 text-sm text-(--muted)">
          No active newsletters found in your recent mail. Enjoy the quiet.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-3 shadow-(--shadow-card) sm:px-5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-(--ink-soft)">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-(--accent)"
          />
          {allSelected ? "Deselect all" : "Select all"}
          <span className="text-xs text-(--muted)">
            {selectedCount > 0 ? `${selectedCount} selected` : `${visible.length} senders`}
          </span>
        </label>
        <button
          type="button"
          disabled={selectedCount === 0 || isPending}
          onClick={() => run(visible.filter((s) => selected.has(s.addr)))}
          className="flex items-center gap-1.5 rounded-full bg-(--ink) px-4 py-2 text-sm font-semibold text-(--bg) transition enabled:hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              <path d="m17 17 4 4m0-4-4 4" />
            </svg>
          )}
          Unsubscribe{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>
      </div>

      {/* Sender rows */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        <ul className="divide-y divide-(--line-soft)">
          {visible.map((s) => {
            const isLeaving = leaving.has(s.addr);
            const isBusy = busy.has(s.addr);
            return (
              <li
                key={s.addr}
                className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-(--bg) sm:px-5"
                style={
                  isLeaving
                    ? { animation: "zsRowFly 450ms ease-in forwards" }
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.addr)}
                  onChange={() => toggleOne(s.addr)}
                  disabled={isBusy || isLeaving}
                  aria-label={`Select ${s.name}`}
                  className="h-4 w-4 shrink-0 accent-(--accent)"
                />
                <SenderAvatar from={s.from} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-(--ink)">{s.name}</span>
                    <span className="hidden truncate text-xs text-(--muted) sm:inline">{s.addr}</span>
                  </div>
                  <p className="truncate text-xs text-(--muted)">
                    {s.count} recent {s.count === 1 ? "email" : "emails"}
                    {s.latestSubject ? ` · latest: ${s.latestSubject}` : ""}
                  </p>
                </div>
                <span className="hidden shrink-0 text-xs text-(--muted) md:inline">{s.latestDate}</span>
                <button
                  type="button"
                  disabled={isBusy || isLeaving || isPending}
                  onClick={() => run([s])}
                  className="shrink-0 rounded-full border border-(--line) px-3.5 py-1.5 text-xs font-semibold text-(--ink-soft) transition enabled:hover:border-(--accent) enabled:hover:bg-(--accent-soft) enabled:hover:text-(--accent-deep) disabled:opacity-40"
                >
                  {isBusy ? "Working…" : "Unsubscribe"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <style>{`
        @keyframes zsRowFly {
          0% { opacity: 1; transform: translateX(0) }
          60% { opacity: 0.4; transform: translateX(48px) }
          100% { opacity: 0; transform: translateX(96px); max-height: 0; padding-top: 0; padding-bottom: 0 }
        }
      `}</style>

      {celebration && (
        <UnsubscribeCelebration
          count={celebration.count}
          links={celebration.links}
          onClose={() => {
            setCelebration(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
