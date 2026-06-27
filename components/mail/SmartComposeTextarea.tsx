"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const SMART_COMPOSE_KEY = "zenscail:smartCompose";

/**
 * Composer textarea with Gmail-style "ghost text" autocomplete. When enabled
 * (localStorage `zenscail:smartCompose` === "on", off by default), it asks
 * /api/compose-complete for a short continuation after a typing pause and
 * renders it as gray text after the caret. Tab accepts, Esc/typing dismisses.
 *
 * The ghost is drawn by an underlay div mirroring the textarea's text (made
 * transparent) plus the gray completion; the textarea sits on top with a
 * transparent background so the underlay shows through. Both share identical
 * typography + padding so the ghost lines up with the caret.
 */
export function SmartComposeTextarea({
  name = "body",
  defaultValue = "",
  rows = 13,
  required,
  placeholder,
  className = "",
  subjectId,
  toName,
}: {
  name?: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** id of the subject <input> to include as context (optional). */
  subjectId?: string;
  /** name of the recipient hidden input to include as context (optional). */
  toName?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [ghost, setGhost] = useState("");
  const [enabled, setEnabled] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchAtRef = useRef(0);
  const seqRef = useRef(0);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(SMART_COMPOSE_KEY) === "on");
    function onStorage(e: StorageEvent) {
      if (e.key === SMART_COMPOSE_KEY) {
        setEnabled(e.newValue === "on");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const clearGhost = useCallback(() => {
    setGhost("");
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const fetchCompletion = useCallback(
    (text: string, attempt = 0) => {
      const now = Date.now();
      const minGapMs = 700;
      if (attempt === 0 && now - lastFetchAtRef.current < minGapMs) {
        const wait = minGapMs - (now - lastFetchAtRef.current);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => fetchCompletion(text, 0), wait);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++seqRef.current;
      lastFetchAtRef.current = Date.now();

      const subject = subjectId
        ? (document.getElementById(subjectId) as HTMLInputElement | null)?.value
        : undefined;
      const to = toName
        ? (document.querySelector<HTMLInputElement>(`input[name='${toName}']`)?.value ?? undefined)
        : undefined;

      fetch("/api/compose-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, subject, to }),
        signal: controller.signal,
      })
        .then(async (r) => {
          if (r.status === 429 && attempt < 2) {
            const retryAfter = Number(r.headers.get("Retry-After") || "2");
            const delay = Math.min(8000, Math.max(1000, retryAfter * 1000));
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (seq !== seqRef.current || controller.signal.aborted) return null;
            return fetchCompletion(text, attempt + 1);
          }
          if (!r.ok) return { completion: "" };
          try {
            return (await r.json()) as { completion?: string };
          } catch {
            return { completion: "" };
          }
        })
        .then((d) => {
          if (!d || controller.signal.aborted || seq !== seqRef.current) return;
          if (taRef.current && taRef.current.value === text) {
            setGhost(typeof d.completion === "string" ? d.completion : "");
          }
        })
        .catch(() => {});
    },
    [subjectId, toName],
  );

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    setGhost("");
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const atEnd = e.target.selectionStart === next.length;
    if (!atEnd || next.trim().length < 2) return;
    timerRef.current = setTimeout(() => fetchCompletion(next), 350);
  }

  function accept() {
    if (!ghost) return;
    const next = value + ghost;
    setValue(next);
    setGhost("");
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(next.length, next.length);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ghost && e.key === "Tab") {
      e.preventDefault();
      accept();
    } else if (ghost && e.key === "Escape") {
      e.preventDefault();
      clearGhost();
    }
  }

  function syncScroll() {
    if (overlayRef.current && taRef.current) {
      overlayRef.current.scrollTop = taRef.current.scrollTop;
    }
  }

  const shared =
    "w-full resize-none whitespace-pre-wrap break-words bg-transparent text-sm leading-relaxed";

  return (
    <div className="relative">
      <div
        ref={overlayRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden text-transparent ${shared} ${className}`}
      >
        {value}
        {ghost && <span className="text-(--muted)">{ghost}</span>}
      </div>
      <textarea
        ref={taRef}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        onBlur={clearGhost}
        rows={rows}
        required={required}
        placeholder={placeholder}
        spellCheck
        className={`relative text-(--ink) placeholder:text-(--muted) focus:outline-none ${shared} ${className}`}
      />
      {ghost && (
        <span className="pointer-events-none absolute right-2 bottom-1.5 rounded bg-(--ink)/80 px-1.5 py-0.5 text-[10px] font-medium text-(--bg)">
          Tab to complete
        </span>
      )}
    </div>
  );
}
