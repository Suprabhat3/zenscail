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

  useEffect(() => {
    setEnabled(window.localStorage.getItem(SMART_COMPOSE_KEY) === "on");
  }, []);

  const clearGhost = useCallback(() => {
    setGhost("");
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const fetchCompletion = useCallback(
    (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
        .then((r) => (r.ok ? r.json() : { completion: "" }))
        .then((d: { completion?: string }) => {
          // Ignore if the textarea changed since the request started.
          if (controller.signal.aborted) return;
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
    timerRef.current = setTimeout(() => fetchCompletion(next), 550);
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
