import "server-only";

/**
 * In-memory per-user event bus backing the SSE stream (app/api/stream).
 * The Corsair webhook receiver publishes here; connected browsers subscribe
 * via EventSource and re-fetch the affected feed.
 *
 * LIMITATION: in-memory means it only fans out within a single Node process.
 * That's exactly right for `pnpm dev` and a single-instance demo deploy. A
 * multi-instance/serverless deployment would need a shared broker (Redis
 * pub/sub, Postgres LISTEN/NOTIFY, etc.) in place of this Map — the public
 * `publish`/`subscribe` surface is designed to be swappable for that.
 */

/** A Corsair feed change (gmail/calendar) — the client re-fetches that feed. */
export type InboxRealtimeEvent = {
  channel?: "inbox";
  /** Which Corsair plugin produced this. */
  plugin: "gmail" | "googlecalendar";
  /** Coarse event kind; the client just re-fetches the matching feed. */
  type: string;
  /** Epoch ms, stamped by the publisher (webhook handler). */
  at: number;
};

/** A subscription change (e.g. admin granted Cloud) — the client celebrates. */
export type SubscriptionRealtimeEvent = {
  channel: "subscription";
  /** What happened to the subscription. */
  type: "granted" | "revoked";
  /** Epoch ms, stamped by the publisher. */
  at: number;
};

export type RealtimeEvent = InboxRealtimeEvent | SubscriptionRealtimeEvent;

type Listener = (event: RealtimeEvent) => void;

declare global {
  // Survive HMR / module reloads in dev so subscriptions aren't dropped.
  var __zenscailRealtime: Map<string, Set<Listener>> | undefined;
}

function bus(): Map<string, Set<Listener>> {
  if (!globalThis.__zenscailRealtime) {
    globalThis.__zenscailRealtime = new Map();
  }
  return globalThis.__zenscailRealtime;
}

/** Subscribe a listener for one user. Returns an unsubscribe function. */
export function subscribe(userId: string, listener: Listener): () => void {
  const map = bus();
  let set = map.get(userId);
  if (!set) {
    set = new Set();
    map.set(userId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) map.delete(userId);
  };
}

/** Push an event to every browser currently subscribed for this user. */
export function publish(userId: string, event: RealtimeEvent): void {
  const set = bus().get(userId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      console.error("realtime: listener threw", err);
    }
  }
}
