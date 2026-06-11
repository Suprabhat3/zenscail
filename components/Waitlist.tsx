"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions";

const initialState: WaitlistState = { status: "idle" };

export function Waitlist({ showNote = false }: { showNote?: boolean }) {
  const [state, formAction, pending] = useActionState(
    joinWaitlist,
    initialState
  );

  const joined = state.status === "success" || state.status === "already";

  return (
    <div className={`waitlist-wrap${joined ? " joined" : ""}`}>
      <form className="waitlist" action={formAction}>
        <input
          type="email"
          name="email"
          required
          placeholder="you@work.com"
          aria-label="Email address"
          disabled={pending}
        />
        <button className="btn btn-accent" type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </form>
      {state.status === "error" && (
        <p className="waitlist-note" role="alert" style={{ color: "var(--accent-deep)" }}>
          {state.message}
        </p>
      )}
      {showNote && state.status !== "error" && (
        <p className="waitlist-note">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path
              d="M 2 8 L 6 12 L 13 3"
              fill="none"
              stroke="var(--sage)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Free forever with your own API keys. No spam, ever.</span>
        </p>
      )}
      <div className="waitlist-success" role="status">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <circle cx="13" cy="13" r="12" fill="var(--sage)" />
          <path
            d="M 7.5 13.5 L 11.5 17.5 L 18.5 9"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <strong>{state.title}</strong>
          <p>{state.message}</p>
        </div>
      </div>
    </div>
  );
}
