"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type BrandLoaderProps = {
  /** Short headline describing what's happening, e.g. "Opening your inbox". */
  title?: string;
  /** Calm one-liners that gently rotate while the page loads. */
  messages: string[];
  /** Render as a full-viewport splash (used before the app shell mounts). */
  fullScreen?: boolean;
};

/**
 * A warm, on-brand loading state — the ZenScail mark under a soft glow with a
 * slowly rotating reassuring message. Replaces the bare skeletons so the wait
 * feels intentional rather than broken.
 */
export function BrandLoader({ title, messages, fullScreen = false }: BrandLoaderProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2400);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen flex-col items-center justify-center bg-(--bg) px-6 text-center text-(--ink)"
          : "flex min-h-[72vh] flex-col items-center justify-center px-6 text-center text-(--ink)"
      }
    >
      {/* Logo: a still mark with a faint breath, a soft glow, and a single
          accent arc quietly orbiting it. */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span
          aria-hidden
          className="zs-halo absolute inset-1 rounded-full"
          style={{
            background:
              "radial-gradient(circle, var(--accent-soft) 0%, color-mix(in srgb, var(--accent-tint) 55%, transparent) 46%, transparent 70%)",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-2 rounded-full border border-(--accent)/10"
        />
        <span aria-hidden className="zs-orbit absolute inset-2 rounded-full" />
        <Image
          src="/logo.png"
          alt="ZenScail"
          width={52}
          height={46}
          priority
          className="zs-breathe relative"
        />
      </div>

      {fullScreen && (
        <p className="mt-5 font-serif text-3xl tracking-tight text-(--ink)">ZenScail</p>
      )}

      {title && (
        <h1
          className={`font-serif tracking-tight text-(--ink) ${
            fullScreen ? "mt-2 text-xl text-(--ink-soft)" : "mt-6 text-2xl"
          }`}
        >
          {title}
        </h1>
      )}

      {/* Rotating reassurance — keyed so each line fades in */}
      <p
        key={index}
        className="zs-msg mt-3 min-h-[1.6em] max-w-sm text-[15px] text-(--muted)"
        aria-live="polite"
      >
        {messages[index]}
      </p>

      {/* Slim accent shimmer */}
      <div className="zs-track mt-7 h-1 w-44 overflow-hidden rounded-full bg-(--line-soft)" />
    </div>
  );
}
