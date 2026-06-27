import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { rateLimit, type RateResult } from "@/lib/rate-limit";
import { DEMO_COOKIE } from "@/lib/demo-shared";

// Expensive LLM / transcription routes get a tighter per-IP ceiling than the
// rest of the API. Matched by exact path or as a prefix (e.g. /api/compose/...).
const AI_PATHS = [
  "/api/chat",
  "/api/compose-complete",
  "/api/compose/prettify",
  "/api/transcribe",
];

// Per-IP tiers (window: 60s). Generous enough for 100–200 concurrent users; the
// goal is only to stop a single client from hammering us. All tunable here.
const PER_IP_AI = 30;
const PER_IP_COMPOSE = 90; // smart-compose fires often while typing
const PER_IP_STREAM = 30; // /api/stream connection attempts
const PER_IP_DEFAULT = 120;
const PER_IP_WINDOW_MS = 60_000;

// Platform-wide ceiling across all (non-exempt) API traffic — a backstop so the
// server as a whole can't be overwhelmed. 500 requests / 10s.
const GLOBAL_LIMIT = 500;
const GLOBAL_WINDOW_MS = 10_000;

/** First hop in X-Forwarded-For is the real client (nginx sets it). */
function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function tooManyRequests(result: RateResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

function rateLimitApi(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Cron and webhooks authenticate by secret / signature and arrive from a
  // single upstream IP (the cron container, Corsair, Razorpay). Per-IP limits
  // would make them throttle themselves, so they're exempt here.
  if (pathname.startsWith("/api/cron") || pathname.startsWith("/api/webhooks")) {
    return null;
  }

  const ip = clientIp(request);
  const now = Date.now();

  const isComposeComplete = pathname === "/api/compose-complete";
  const isAi =
    !isComposeComplete &&
    AI_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isStream = pathname === "/api/stream";

  // Per-IP tier first: a blocked client shouldn't consume a global slot.
  const perIp = isComposeComplete
    ? rateLimit(`ip:compose:${ip}`, PER_IP_COMPOSE, PER_IP_WINDOW_MS, now)
    : isAi
      ? rateLimit(`ip:ai:${ip}`, PER_IP_AI, PER_IP_WINDOW_MS, now)
      : isStream
      ? rateLimit(`ip:stream:${ip}`, PER_IP_STREAM, PER_IP_WINDOW_MS, now)
      : rateLimit(`ip:default:${ip}`, PER_IP_DEFAULT, PER_IP_WINDOW_MS, now);
  if (!perIp.ok) return tooManyRequests(perIp);

  const global = rateLimit("global", GLOBAL_LIMIT, GLOBAL_WINDOW_MS, now);
  if (!global.ok) return tooManyRequests(global);

  return null;
}

export function proxy(request: NextRequest) {
  // API surface: rate limit, no auth redirect (a 401/redirect to an HTML login
  // page would be wrong for fetch/XHR callers).
  if (request.nextUrl.pathname.startsWith("/api")) {
    return rateLimitApi(request) ?? NextResponse.next();
  }

  // App pages: optimistic auth check only (cookie presence) — real session
  // validation happens in requireSession() inside the (app) layout/pages.
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    // Demo tour: a visitor flagged with the demo cookie may browse the app's
    // pages with no session. This only opens the read-only render path — every
    // mutating action still calls requireSession() and is blocked client-side.
    if (request.cookies.get(DEMO_COOKIE)?.value === "1") {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/mail/:path*",
    "/calendar/:path*",
    "/chat/:path*",
    "/connect",
    "/settings/:path*",
  ],
};
