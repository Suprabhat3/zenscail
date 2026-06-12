"use client";

import { useCallback, useRef } from "react";

/**
 * Renders an HTML email body in a sandboxed iframe that auto-sizes to its
 * content (no inner scrollbars, no giant empty box for short emails).
 *
 * Sandbox notes: scripts stay disabled (no `allow-scripts`), so the email
 * can't run code; `allow-same-origin` is needed so we can measure the
 * document height; `allow-popups` + an injected <base target="_blank"> let
 * links open in a new tab instead of dying inside the sandbox.
 */
export function EmailFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  const resize = useCallback(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight ?? 0,
    );
    frame.style.height = `${Math.min(Math.max(height + 16, 60), 1600)}px`;
  }, []);

  const srcDoc = [
    "<!doctype html><html><head><meta charset='utf-8'>",
    "<base target='_blank' rel='noopener noreferrer'>",
    // Keep runaway newsletter layouts inside the card.
    "<style>body{margin:8px;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#25201A;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>",
    "</head><body>",
    html,
    "</body></html>",
  ].join("");

  return (
    <iframe
      ref={ref}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      onLoad={() => {
        resize();
        // Images load after the document does — re-measure as they land.
        setTimeout(resize, 350);
        setTimeout(resize, 1500);
      }}
      title={title}
      className="w-full rounded-xl border border-(--line-soft) bg-white"
      style={{ height: 120 }}
    />
  );
}
