"use client";

import { BetaCta } from "./BetaCta";
import { useTypewriter } from "./useTypewriter";
import { useRef, useState, useEffect, useCallback } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

const BRIEF_HTML =
  "Good morning, Maya. <mark>3 emails</mark> need a reply — the Linear contract is the urgent one. Your <mark>1:1 with Sam</mark> moved to 2:30pm, so your afternoon is clear for deep work. I drafted a reply to the invoice thread; one tap to send.";

type CardId = "cal" | "brief" | "event" | "reminder" | "reply";

/** CSS rotation each card starts with (matches design/zenscail.css) */
const CARD_ROTATIONS: Record<CardId, number> = {
  cal: 2.5,
  brief: 0,
  event: -1.5,
  reminder: -2,
  reply: 1.2,
};

interface Offset { x: number; y: number }
type Offsets = Record<CardId, Offset>;

interface DragState {
  cardId: CardId;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  /** Card's natural (no-JS-transform) position relative to the hero-visual container */
  naturalLeft: number;
  naturalTop: number;
  cardWidth: number;
  cardHeight: number;
  containerWidth: number;
  containerHeight: number;
}

const ZERO: Offset = { x: 0, y: 0 };
const INITIAL_OFFSETS: Offsets = {
  cal: ZERO, brief: ZERO, event: ZERO, reminder: ZERO, reply: ZERO,
};

export function Hero() {
  const { text, done } = useTypewriter(BRIEF_HTML, { speed: 18, delay: 600 });

  const heroBoundaryRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<Partial<Record<CardId, HTMLDivElement>>>({});

  const [offsets, setOffsets] = useState<Offsets>(INITIAL_OFFSETS);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const setCardRef = useCallback(
    (id: CardId) => (el: HTMLDivElement | null) => {
      cardRefs.current[id] = el ?? undefined;
    },
    []
  );

  const handlePointerDown = useCallback(
    (cardId: CardId) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const card = cardRefs.current[cardId];
      const container = heroBoundaryRef.current;
      if (!card || !container) return;

      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

      const cardR = card.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      const cur = offsets[cardId];

      setDragState({
        cardId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: cur.x,
        originY: cur.y,
        naturalLeft: cardR.left - cr.left - cur.x,
        naturalTop: cardR.top - cr.top - cur.y,
        cardWidth: cardR.width,
        cardHeight: cardR.height,
        containerWidth: cr.width,
        containerHeight: cr.height,
      });
    },
    [offsets]
  );

  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragState.pointerId) return;

      const rawX = dragState.originX + (e.clientX - dragState.startX);
      const rawY = dragState.originY + (e.clientY - dragState.startY);

      const pad = 10;
      const { naturalLeft, naturalTop, cardWidth, cardHeight, containerWidth, containerHeight } = dragState;

      const newX = Math.max(
        -naturalLeft + pad,
        Math.min(containerWidth - naturalLeft - cardWidth - pad, rawX)
      );
      const newY = Math.max(
        -naturalTop + pad,
        Math.min(containerHeight - naturalTop - cardHeight - pad, rawY)
      );

      setOffsets(prev => ({ ...prev, [dragState.cardId]: { x: newX, y: newY } }));
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragState.pointerId) return;
      setDragState(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState]);

  const cardStyle = (id: CardId): CSSProperties => {
    const { x, y } = offsets[id];
    const rot = CARD_ROTATIONS[id];
    const isDragging = dragState?.cardId === id;
    const hasMoved = x !== 0 || y !== 0;
    return {
      transform: `translate(${x}px, ${y}px)${rot ? ` rotate(${rot}deg)` : ""}`,
      cursor: isDragging ? "grabbing" : "grab",
      touchAction: "none",
      userSelect: "none",
      ...(isDragging
        ? { animation: "none", zIndex: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }
        : hasMoved
        ? { animation: "none" }
        : {}),
    };
  };

  return (
    <header className="hero" id="top" ref={heroBoundaryRef}>
      <div className="hero-horizon" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 1400 760" preserveAspectRatio="xMidYMax slice">
          <circle cx="1050" cy="780" r="520" fill="none" stroke="var(--line)" strokeWidth="1.5" />
          <circle cx="1050" cy="780" r="640" fill="none" stroke="var(--line-soft)" strokeWidth="1.5" />
          <circle cx="1050" cy="780" r="400" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" />
          <circle cx="1050" cy="780" r="760" fill="none" stroke="var(--line-soft)" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="wrap hero-grid">
        <div className="reveal in-view">
          <span className="eyebrow">
            Email + calendar + AI
            <span
              style={{
                marginLeft: 10,
                padding: "2px 10px",
                borderRadius: 99,
                background: "var(--accent-soft)",
                color: "var(--accent-deep)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              NOW IN BETA
            </span>
          </span>
          <h1 className="display" style={{ marginTop: 20 }}>
            Your day,
            <br />
            already{" "}
            <span className="underline-word">
              <em>sorted.</em>
              <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
                <path d="M 4 9 Q 50 3 100 8 T 196 7" />
              </svg>
            </span>
          </h1>
          <p className="lede">
            ZenScail reads your inbox and calendar so you don&rsquo;t have to.
            Every morning, one calm brief: what matters, what can wait, and
            what&rsquo;s already handled for you.
          </p>
          <BetaCta showNote />
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div
            ref={setCardRef("cal")}
            className="hv-card hv-cal float"
            style={cardStyle("cal")}
            onPointerDown={handlePointerDown("cal")}
          >
            <div className="hv-cal-month">
              <span>April</span>
              <span>2026</span>
            </div>
            <div className="hv-cal-days">
              <span className="dim">M</span><span className="dim">T</span><span className="dim">W</span><span className="dim">T</span><span className="dim">F</span><span className="dim">S</span><span className="dim">S</span>
              <span>6</span><span className="dot">7</span><span className="today">8</span><span className="dot">9</span><span>10</span><span className="dim">11</span><span className="dim">12</span>
              <span className="dot">13</span><span>14</span><span>15</span><span className="dot">16</span><span>17</span><span className="dim">18</span><span className="dim">19</span>
            </div>
          </div>

          <div
            ref={setCardRef("brief")}
            className="hv-card hv-brief"
            style={cardStyle("brief")}
            onPointerDown={handlePointerDown("brief")}
          >
            <div className="hv-head">
              <svg className="hv-sun" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                <circle cx="17" cy="17" r="16" fill="var(--accent-soft)" />
                <circle cx="17" cy="20" r="6" fill="var(--accent)" />
                <path d="M 7 24 H 27" stroke="var(--accent-deep)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <div>
                <strong>Your morning brief</strong>
                <span>Wednesday, April 8 · 7:00 AM</span>
              </div>
            </div>
            <p className="hv-brief-body">
              {/* our own constant — safe to inject */}
              <span dangerouslySetInnerHTML={{ __html: text }} />
              {!done && <span className="typed-cursor" />}
            </p>
          </div>

          <div
            ref={setCardRef("event")}
            className="hv-card hv-event float float-b"
            style={cardStyle("event")}
            onPointerDown={handlePointerDown("event")}
          >
            <span className="hv-event-bar" />
            <div>
              <strong>1:1 with Sam</strong>
              <span>Moved to 2:30 PM — you said yes</span>
            </div>
          </div>

          <div
            ref={setCardRef("reminder")}
            className="hv-reminder float float-c"
            style={cardStyle("reminder")}
            onPointerDown={handlePointerDown("reminder")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M 8 2 C 5.5 2 4 4 4 6.5 V 10 L 2.5 12 H 13.5 L 12 10 V 6.5 C 12 4 10.5 2 8 2 Z"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M 6.5 13.5 A 1.8 1.8 0 0 0 9.5 13.5"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>Nudge: Priya&rsquo;s contract — reply before Friday</span>
          </div>

          <div
            ref={setCardRef("reply")}
            className="hv-card hv-reply float"
            style={cardStyle("reply")}
            onPointerDown={handlePointerDown("reply")}
          >
            <span className="hv-reply-label">
              <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                <path d="M 6.5 0.5 L 7.8 4.7 L 12 6 L 7.8 7.3 L 6.5 11.5 L 5.2 7.3 L 1 6 L 5.2 4.7 Z" fill="var(--accent)" />
              </svg>
              <span>Draft ready</span>
            </span>
            <p>
              &ldquo;Hi Priya — terms look good on our side. I&rsquo;ll sign
              today so we&rsquo;re ahead of Friday&hellip;&rdquo;
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
