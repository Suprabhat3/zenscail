"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const SLIDES = [
  {
    prefix: "Your day,",
    emphasis: "already sorted.",
    sub: "Start each morning knowing exactly what needs your attention.",
  },
  {
    prefix: "Your inbox,",
    emphasis: "finally quiet.",
    sub: "AI triage cuts the noise so only what matters reaches you.",
  },
  {
    prefix: "Your week,",
    emphasis: "fully visible.",
    sub: "One calendar view to plan, schedule, and never double-book.",
  },
  {
    prefix: "Your focus,",
    emphasis: "finally back.",
    sub: "An assistant that handles the logistics while you do the thinking.",
  },
];

const FEATURES = [
  "Read, reply and triage Gmail without the noise",
  "See your week and send invites in two clicks",
  "Ask the assistant — “book us 30 minutes next Thursday”",
];

type Phase = "idle" | "exit" | "enter";

export function BrandingPanel() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  function goTo(next: number) {
    if (next === idx) return;
    setPhase("exit");
    setTimeout(() => {
      setIdx(next);
      setPhase("enter");
      setTimeout(() => setPhase("idle"), 400);
    }, 280);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase("exit");
      setTimeout(() => {
        setIdx((i) => {
          const next = (i + 1) % SLIDES.length;
          return next;
        });
        setPhase("enter");
        setTimeout(() => setPhase("idle"), 400);
      }, 280);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[idx];

  const style: React.CSSProperties =
    phase === "exit"
      ? { opacity: 0, transform: "translateY(-12px)", transition: "opacity 280ms ease, transform 280ms ease" }
      : phase === "enter"
      ? { opacity: 0, transform: "translateY(12px)", transition: "none" }
      : { opacity: 1, transform: "translateY(0)", transition: "opacity 400ms ease, transform 400ms ease" };

  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-(--line-soft) bg-(--bg-deep) p-10 lg:flex">
      <Link href="/" className="flex items-center gap-2 font-serif text-xl text-(--ink)">
        <Image src="/logo.png" alt="ZenScail" width={31} height={28} />
        ZenScail
      </Link>

      <div>
        {/* Animated block */}
        <div style={style}>
          <h2 className="max-w-md font-serif text-4xl leading-tight text-(--ink)">
            {slide.prefix}{" "}
            <em className="text-(--accent)">{slide.emphasis}</em>
          </h2>
          <p className="mt-4 max-w-sm text-(--ink-soft)">{slide.sub}</p>
        </div>

        {/* Dot indicators */}
        <div className="mt-6 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? "w-5 bg-(--accent)" : "w-1.5 bg-(--line) hover:bg-(--muted)"
              }`}
            />
          ))}
        </div>

        <ul className="mt-8 space-y-3 text-sm text-(--ink-soft)">
          {FEATURES.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-0.5 font-bold text-(--sage)">✓</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-(--muted)">© {new Date().getFullYear()} ZenScail</p>

      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full border border-(--line-soft)" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full border border-(--line)" />
    </div>
  );
}
