/**
 * In-memory sliding-window rate limiter.
 *
 * The app runs as a single Node process (one Docker container behind the host's
 * nginx — see docker-compose.yml), so a module-level Map is shared across every
 * request and is the right tool here: no Redis, no extra infra. If we ever scale
 * to multiple app replicas this would need a shared store (Redis/Upstash),
 * because each process would otherwise keep its own counts.
 *
 * The algorithm is a sliding-window log: per key we keep the timestamps of the
 * requests still inside the window and prune the rest. Exact (no fixed-window
 * boundary bursts) and cheap at our scale — a few hundred IPs × a couple hundred
 * timestamps is trivial memory, kept bounded by the periodic sweep below.
 */

type Bucket = { times: number[]; windowMs: number };

const buckets = new Map<string, Bucket>();

export type RateResult = {
  ok: boolean;
  /** The configured ceiling for this bucket. */
  limit: number;
  /** Slots left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the next slot frees — for the `Retry-After` header. */
  retryAfterSec: number;
};

// Drop keys whose window has fully elapsed so one-off IPs don't accumulate
// forever. Swept opportunistically (no setInterval) on a time check.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    const cutoff = now - bucket.windowMs;
    if (bucket.times.length === 0 || bucket.times[bucket.times.length - 1] <= cutoff) {
      buckets.delete(key);
    }
  }
}

/**
 * Record a hit against `key` and report whether it's allowed. A key combines a
 * tier and an identity, e.g. `ip:ai:1.2.3.4`, `global`, `user:ai:<id>`.
 *
 * `now` is passed in (rather than read internally) so callers that already have
 * a timestamp can reuse it across several buckets in one request.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateResult {
  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    sweep(now);
  }

  const cutoff = now - windowMs;
  const bucket = buckets.get(key);
  // Prune timestamps that have aged out of the window.
  const recent = bucket ? bucket.times.filter((t) => t > cutoff) : [];

  if (recent.length >= limit) {
    // The oldest in-window hit decides when a slot opens up again.
    const retryAfterMs = recent[0] + windowMs - now;
    buckets.set(key, { times: recent, windowMs });
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  buckets.set(key, { times: recent, windowMs });
  return { ok: true, limit, remaining: limit - recent.length, retryAfterSec: 0 };
}

/**
 * Per-user limit for expensive AI server actions (LLM calls). Mirrors the
 * per-IP AI tier the proxy applies to the `/api/*` AI routes, but keyed on the
 * authenticated user so it survives shared IPs (offices, NAT). 30 / minute.
 */
export function checkUserAiLimit(userId: string): RateResult {
  return rateLimit(`user:ai:${userId}`, 30, 60_000, Date.now());
}
