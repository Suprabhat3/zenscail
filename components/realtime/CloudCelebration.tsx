"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyCloudStatus,
  acknowledgeCloudWelcome,
} from "@/app/cloud-status-actions";

/**
 * Detects the moment a signed-in user gains *usable* Cloud access — active
 * subscription AND a connected mailbox — and plays a one-time celebration, then
 * routes them into the app. Mounted on onboarding and inside the (app) shell.
 *
 * Whether to celebrate is decided server-side (`shouldCelebrate`), so it's
 * correct regardless of ordering and survives the full page reload that Gmail
 * OAuth causes:
 *  - Granted Cloud *before* connecting the mailbox → no celebration yet (routing
 *    them in would fail the gate); the listener keeps watching.
 *  - After they connect, `shouldCelebrate` flips true → "you're upgraded" plays.
 *  - Established Cloud users are already `cloudCelebratedAt` → never re-fire.
 *
 * Two detection paths, whichever fires first wins (`done` + the server flag
 * de-dupe): an SSE `subscription` push (sub-second, in-process) and a 2.5s poll
 * fallback (also the only signal for the connect-after-grant case, since
 * connecting a mailbox emits no subscription event).
 */

const POLL_MS = 2500;

function formatEnd(iso: string | null): string {
  if (!iso) return "one month from today";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function CloudCelebration({
  immediate = false,
  endsOnIso = null,
}: {
  /** Show the celebration at once (the page already knows the user is on Cloud,
   *  e.g. the onboarding choice step for an already-upgraded user) — no status
   *  round-trip, so the choice UI never flashes. */
  immediate?: boolean;
  /** currentEnd ISO to display in `immediate` mode. */
  endsOnIso?: string | null;
} = {}) {
  const router = useRouter();
  const [endsOn, setEndsOn] = useState<string | null>(endsOnIso);
  const [show, setShow] = useState(immediate);

  const done = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const teardown = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const check = useCallback(async () => {
    if (done.current) return;
    let status;
    try {
      status = await getMyCloudStatus();
    } catch {
      return; // transient — the next poll/event retries
    }
    if (done.current) return;
    if (status.shouldCelebrate) {
      done.current = true;
      teardown();
      // Stamp it shown immediately so a reload (or another tab) won't replay.
      void acknowledgeCloudWelcome();
      setEndsOn(status.currentEnd);
      setShow(true);
    }
  }, [teardown]);

  useEffect(() => {
    // Immediate mode: the server already decided to celebrate. Just mark it shown
    // (so a reload won't replay) — no watching needed.
    if (immediate) {
      done.current = true;
      void acknowledgeCloudWelcome();
      return;
    }

    let cancelled = false;

    (async () => {
      let status;
      try {
        status = await getMyCloudStatus();
      } catch {
        return;
      }
      if (cancelled) return;

      // Already usable + not yet celebrated → fire now (e.g. returning from the
      // Gmail OAuth reload after Cloud was granted mid-onboarding).
      if (status.shouldCelebrate) {
        done.current = true;
        void acknowledgeCloudWelcome();
        setEndsOn(status.currentEnd);
        setShow(true);
        return;
      }

      // Nothing to wait for (logged out, or an established welcomed Cloud user).
      if (!status.keepWatching) return;

      // Watch for an upgrade: instant SSE push + a poll fallback (the poll is the
      // only signal when the change is "mailbox connected", not "sub activated").
      pollTimer.current = setInterval(check, POLL_MS);
      const source = new EventSource("/api/stream");
      sourceRef.current = source;
      source.addEventListener("subscription", () => void check());
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [check, teardown, immediate]);

  const enter = useCallback(() => {
    setShow(false);
    router.refresh();
    router.push("/dashboard");
  }, [router]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cloud upgrade"
      onClick={enter}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(37, 32, 26, 0.55)",
        backdropFilter: "blur(4px)",
        animation: "zsCelebFade 220ms ease-out",
      }}
    >
      <Confetti />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          borderRadius: 24,
          border: "1px solid var(--line)",
          background: "var(--paper)",
          padding: "36px 32px 30px",
          textAlign: "center",
          boxShadow: "var(--shadow-card)",
          animation: "zsCelebPop 420ms cubic-bezier(0.18, 0.89, 0.32, 1.28)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 20px",
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            fontSize: 34,
            background:
              "radial-gradient(120% 120% at 30% 20%, var(--accent-soft), var(--accent-tint))",
            border: "1px solid var(--accent-tint)",
          }}
        >
          ✦
        </div>

        <h2
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-display)",
            fontSize: 28,
            lineHeight: 1.15,
            color: "var(--ink)",
          }}
        >
          You&rsquo;re on ZenScail Cloud!
        </h2>

        <p style={{ margin: "0 0 8px", fontSize: 15, color: "var(--ink-soft)" }}>
          Your Cloud AI subscription is active for the next{" "}
          <strong style={{ color: "var(--accent)" }}>one month</strong> — no API
          key needed.
        </p>

        <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--muted)" }}>
          Access through <strong>{formatEnd(endsOn)}</strong>. Renew anytime from
          Billing in Settings.
        </p>

        <button
          type="button"
          onClick={enter}
          className="btn btn-accent"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Enter ZenScail
        </button>
      </div>

      <style>{`
        @keyframes zsCelebFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes zsCelebPop {
          0% { opacity: 0; transform: translateY(12px) scale(0.94) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}

/**
 * Self-contained canvas confetti burst — no dependency. Spawns ~140 particles
 * from the top, lets gravity pull them down, fades out, then stops the loop.
 */
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#E11D48", "#C98A2D", "#FBD3DC", "#B81239", "#F9DFE5"];
    // Vary the burst without Math.random where possible isn't required here —
    // this is purely decorative client-side animation.
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.3,
      r: 4 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    let raf = 0;
    const maxFrames = 220;

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, w, h);
      const fade = frame > 160 ? Math.max(0, 1 - (frame - 160) / 60) : 1;
      ctx.globalAlpha = fade;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      }

      if (frame < maxFrames) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
