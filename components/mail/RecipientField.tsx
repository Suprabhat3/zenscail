"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact } from "@/app/api/contacts/route";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initial(c: Contact): string {
  return (c.name || c.email)[0]?.toUpperCase() || "?";
}

/**
 * Gmail-style recipient input: typed addresses become removable chips, and as
 * you type we suggest people you've recently corresponded with (fetched from
 * /api/contacts). The committed list is mirrored into a hidden input so the
 * existing `sendMessage` server action keeps reading a comma-joined `to`.
 */
export function RecipientField({
  name = "to",
  defaultValue = "",
  placeholder = "Add recipients",
  required,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [recipients, setRecipients] = useState<string[]>(() =>
    defaultValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the contact list once, the first time the field is focused.
  const loadedRef = useRef(false);
  function loadContacts() {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => setContacts([]));
  }

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(recipients.map((r) => r.toLowerCase()));
    const pool = contacts.filter((c) => !chosen.has(c.email.toLowerCase()));
    if (!q) return pool.slice(0, 6);
    return pool
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, contacts, recipients]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function addRecipient(value: string) {
    const v = value.trim().replace(/,$/, "").trim();
    if (!v) return;
    if (!recipients.some((r) => r.toLowerCase() === v.toLowerCase())) {
      setRecipients((prev) => [...prev, v]);
    }
    setQuery("");
    setOpen(false);
  }

  function removeAt(i: number) {
    setRecipients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (e.key === "Enter") e.preventDefault();
        if (suggestions[active]) {
          addRecipient(suggestions[active].email);
          return;
        }
      }
    }
    if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && query.trim())) {
      e.preventDefault();
      addRecipient(query);
    } else if (e.key === "Backspace" && !query && recipients.length) {
      removeAt(recipients.length - 1);
    }
  }

  const value = recipients.join(", ");
  const invalid = recipients.find((r) => !EMAIL_RE.test(r));

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-2xl border border-(--line) bg-(--bg) px-2.5 py-1.5 transition focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent-soft)"
      >
        {recipients.map((r, i) => {
          const bad = !EMAIL_RE.test(r);
          return (
            <span
              key={`${r}-${i}`}
              className={`flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-sm ${
                bad
                  ? "bg-(--accent-soft) text-(--accent-deep)"
                  : "bg-(--paper) text-(--ink) shadow-(--shadow-card)"
              }`}
              title={bad ? "Not a valid email address" : r}
            >
              <span className="max-w-52 truncate">{r}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${r}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={query}
          onFocus={() => {
            loadContacts();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => query.trim() && addRecipient(query)}
          placeholder={recipients.length ? "" : placeholder}
          className="min-w-40 flex-1 bg-transparent px-1.5 py-1 text-sm text-(--ink) placeholder:text-(--muted) focus:outline-none"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-(--line-soft) bg-(--paper) p-1.5 shadow-(--shadow-float)">
          {suggestions.map((c, i) => (
            <li key={c.email}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addRecipient(c.email);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                  i === active ? "bg-(--bg)" : "hover:bg-(--bg)"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) font-serif text-sm text-(--accent-deep)">
                  {initial(c)}
                </span>
                <span className="min-w-0">
                  {c.name && (
                    <span className="block truncate text-sm font-medium text-(--ink)">
                      {c.name}
                    </span>
                  )}
                  <span className="block truncate text-xs text-(--muted)">
                    {c.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {invalid && (
        <p className="mt-1.5 px-1 text-xs text-(--accent-deep)">
          “{invalid}” doesn’t look like a valid email address.
        </p>
      )}
    </div>
  );
}
