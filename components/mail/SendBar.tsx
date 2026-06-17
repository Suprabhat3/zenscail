"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deferSend,
  scheduleSend,
  cancelScheduledSend,
  flushScheduledSend,
} from "@/app/(app)/mail/schedule-actions";
import { deleteDraft } from "@/app/(app)/mail/draft-actions";
import { useToast } from "@/components/ui/Toast";
import { sendLaterPresets, fmtDateTime, localInputToIso } from "@/lib/timePresets";

export const UNDO_SECS_KEY = "zenscail_undo_secs";

function readUndoSecs(): number {
  if (typeof window === "undefined") return 5;
  const raw = window.localStorage.getItem(UNDO_SECS_KEY);
  const n = raw == null ? 5 : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 5;
}

type Payload = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  threadId?: string;
  inReplyTo?: string;
};

/**
 * Replaces the plain Send button in compose/reply. "Send" defers the mail by
 * the undo window (a ScheduledSend row) and shows a countdown toast with Undo;
 * if the window elapses it flushes the row immediately (the cron is the
 * backstop for closed tabs). The caret opens "Send later" presets. We stay on
 * the page during the undo window so Undo trivially preserves the draft.
 */
export function SendBar({
  successHref,
  label = "Send",
}: {
  successHref: string;
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [custom, setCustom] = useState("");
  // Draft id of the compose form, captured at read time so we can delete the
  // saved draft once the mail actually flushes.
  const draftIdRef = useRef("");

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function readForm(): Payload | null {
    const form = wrapRef.current?.closest("form");
    if (!form) return null;
    const fd = new FormData(form);
    // Manual validation: the `to` field is a hidden required input (chips
    // mirror into it), and reportValidity() errors on non-focusable required
    // controls — so we check the values ourselves and surface a toast.
    const to = String(fd.get("to") ?? "").trim();
    const body = String(fd.get("body") ?? "");
    if (!to) {
      toast("Add at least one recipient");
      return null;
    }
    if (!body.trim()) {
      toast("Write a message first");
      return null;
    }
    draftIdRef.current = String(fd.get("draftId") ?? "");
    return {
      to,
      cc: String(fd.get("cc") ?? "") || undefined,
      subject: String(fd.get("subject") ?? ""),
      body,
      isHtml: String(fd.get("isHtml") ?? "") === "1",
      threadId: String(fd.get("threadId") ?? "") || undefined,
      inReplyTo: String(fd.get("inReplyTo") ?? "") || undefined,
    };
  }

  /** Remove the saved draft once a send has actually gone out. Best-effort. */
  async function dropDraft() {
    const id = draftIdRef.current;
    if (id) await deleteDraft(id).catch(() => {});
  }

  async function onSend() {
    const payload = readForm();
    if (!payload) return;
    setBusy(true);
    const secs = readUndoSecs();
    try {
      if (secs === 0) {
        // Undo disabled — send immediately.
        const { id } = await deferSend(payload, 0);
        await flushScheduledSend(id);
        await dropDraft();
        toast("Sent");
        router.push(successHref);
        router.refresh();
        return;
      }
      const { id } = await deferSend(payload, secs);
      let undone = false;
      toast(`Sending in ${secs}s…`, {
        duration: secs * 1000,
        countdown: true,
        action: {
          label: "Undo",
          onClick: async () => {
            undone = true;
            await cancelScheduledSend(id).catch(() => {});
            toast("Send canceled — your draft is kept");
            setBusy(false);
          },
        },
        onExpire: async () => {
          if (undone) return;
          await flushScheduledSend(id).catch(() => {});
          await dropDraft();
          router.push(successHref);
          router.refresh();
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send");
      setBusy(false);
    }
  }

  async function onScheduleLater(date: Date) {
    const payload = readForm();
    if (!payload) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      await scheduleSend(payload, date.toISOString());
      await dropDraft();
      toast(`Scheduled for ${fmtDateTime(date)}`);
      router.push("/mail?view=scheduled");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't schedule");
      setBusy(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-flex items-stretch overflow-hidden rounded-full bg-(--ink) text-(--bg) transition has-[button:hover]:bg-(--accent)"
    >
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        className="flex items-center gap-1.5 py-2.5 pr-3 pl-5 text-sm font-semibold transition disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
        {label}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={busy}
        aria-label="Send later"
        title="Send later"
        className="flex items-center border-l border-(--bg)/20 py-2.5 pr-3.5 pl-2.5 transition disabled:opacity-60"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-64 overflow-hidden rounded-xl border border-(--line) bg-(--paper) py-1.5 shadow-(--shadow-float)">
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
            Send later
          </p>
          {sendLaterPresets().map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onScheduleLater(p.date)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-(--ink) transition hover:bg-(--bg)"
            >
              <span>{p.label}</span>
              <span className="text-xs text-(--muted)">{p.hint}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-(--line-soft) px-3 pt-2 pb-1">
            <label className="block text-[11px] font-semibold text-(--muted)">Custom</label>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="datetime-local"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-(--line) bg-(--bg) px-2 py-1 text-xs text-(--ink) focus:border-(--accent) focus:outline-none"
              />
              <button
                type="button"
                disabled={!custom}
                onClick={() => {
                  const iso = localInputToIso(custom);
                  if (iso) onScheduleLater(new Date(iso));
                }}
                className="shrink-0 rounded-lg bg-(--ink) px-2.5 py-1 text-xs font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
