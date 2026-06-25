"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button for `<form action={serverAction}>` that disables itself and
 * swaps its icon for a spinner while the action is in flight.
 *
 * This is our double-submit guard: server actions can take a few seconds (a
 * round-trip to Google), and an un-disabled button let impatient users fire the
 * same action several times — e.g. "Meet now" creating five meetings. While
 * `pending` is true the button is disabled, so only the first click counts.
 *
 * Must be rendered as a descendant of the `<form>` whose status it reflects
 * (that's how `useFormStatus` finds it).
 */
export function SubmitButton({
  children,
  icon,
  pendingLabel,
  className,
  title,
}: {
  /** The button label shown when idle. */
  children: React.ReactNode;
  /** Optional leading icon, replaced by a spinner while pending. */
  icon?: React.ReactNode;
  /** Label to show while pending (defaults to the idle label). */
  pendingLabel?: string;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-busy={pending}
      className={`${className ?? ""}${pending ? " cursor-wait opacity-70" : ""}`}
    >
      {pending ? (
        <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        icon
      )}
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
