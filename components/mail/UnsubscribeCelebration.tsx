"use client";

import { useEffect, useRef } from "react";

/**
 * The "breathe out" moment after unsubscribing: a full-screen calm overlay —
 * soft petals drifting up and away on a canvas (the noise leaving), a slow
 * breathing halo around the checkmark, and a quiet message. Deliberately the
 * opposite energy of CloudCelebration's confetti: this one is relief, not
 * fireworks.
 */
export function UnsubscribeCelebration({
  count,
  links,
  onClose,
}: {
  /** How many senders were just unsubscribed. */
  count: number;
  /** Unsubscribe pages the user still has to open (method "link"). */
  links: { name: string; url: string }[];
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unsubscribed"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(37, 32, 26, 0.5)",
        backdropFilter: "blur(5px)",
        animation: "zsUnsubFade 400ms ease-out",
      }}
    >
      <DriftingPetals />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(430px, 100%)",
          borderRadius: 24,
          border: "1px solid var(--line)",
          background: "var(--paper)",
          padding: "38px 32px 30px",
          textAlign: "center",
          boxShadow: "var(--shadow-card)",
          animation: "zsUnsubRise 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Breathing halo + check */}
        <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 22px" }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: "var(--accent-soft)",
              animation: "zsUnsubBreathe 3.2s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 10,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              background:
                "radial-gradient(120% 120% at 30% 20%, var(--accent-soft), var(--accent-tint))",
              border: "1px solid var(--accent-tint)",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M4 12.5 9.5 18 20 6.5"
                style={{
                  strokeDasharray: 26,
                  strokeDashoffset: 26,
                  animation: "zsUnsubCheck 600ms 350ms ease-out forwards",
                }}
              />
            </svg>
          </span>
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
          Ahh&hellip; breathe out.
        </h2>

        <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink-soft)" }}>
          You just unsubscribed from{" "}
          <strong style={{ color: "var(--accent)" }}>
            {count} {count === 1 ? "newsletter" : "newsletters"}
          </strong>
          .
        </p>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "var(--muted)" }}>
          That noise is gone for good. Your inbox is calmer already.
        </p>

        {links.length > 0 && (
          <div
            style={{
              margin: "0 0 22px",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid var(--line-soft)",
              background: "var(--bg)",
              textAlign: "left",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
              {links.length === 1 ? "One sender needs" : `${links.length} senders need`} a quick
              confirmation in the browser:
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {links.map((l) => (
                <li key={l.url} style={{ fontSize: 13, lineHeight: 1.9 }}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    {l.name} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn btn-accent"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Back to my calm inbox
        </button>
      </div>

      <style>{`
        @keyframes zsUnsubFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes zsUnsubRise {
          0% { opacity: 0; transform: translateY(18px) scale(0.96) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes zsUnsubBreathe {
          0%, 100% { transform: scale(1); opacity: 0.45 }
          50% { transform: scale(1.18); opacity: 0.9 }
        }
        @keyframes zsUnsubCheck { to { stroke-dashoffset: 0 } }
      `}</style>
    </div>
  );
}

/**
 * Canvas of soft petals/leaves drifting slowly upward and fading — the visual
 * of clutter floating out of the inbox. Gentle sway, no gravity, no confetti.
 */
function DriftingPetals() {
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

    const colors = ["#FBD3DC", "#F9DFE5", "#EAD9BE", "#DCE8DB", "#F3E7D3"];
    const petals = Array.from({ length: 46 }, () => ({
      x: Math.random() * w,
      y: h * 0.35 + Math.random() * h * 0.75,
      r: 5 + Math.random() * 9,
      vy: 0.35 + Math.random() * 0.75, // slow, upward
      sway: 0.4 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.02,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    let raf = 0;
    const maxFrames = 460;

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, w, h);
      const fade = frame > 360 ? Math.max(0, 1 - (frame - 360) / 100) : 1;

      for (const p of petals) {
        p.y -= p.vy;
        p.x += Math.sin(frame / 60 + p.phase) * p.sway * 0.5;
        p.rot += p.vrot;
        // Each petal also fades as it climbs.
        const climb = Math.max(0, Math.min(1, p.y / (h * 0.9)));
        ctx.globalAlpha = fade * (0.25 + climb * 0.55);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (frame < maxFrames) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
