"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { ASK_AI_PROVIDERS } from "@/lib/ask-ai";

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 13.6 8.4 19.5 10 13.6 11.6 12 17.5 10.4 11.6 4.5 10 10.4 8.4 12 2.5Z"
        fill="currentColor"
      />
      <path
        d="M19 14.5 19.8 17.2 22.5 18 19.8 18.8 19 21.5 18.2 18.8 15.5 18 18.2 17.2 19 14.5Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

export function AskAiWidget() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`ask-ai${open ? " is-open" : ""}`}
      aria-live="polite"
    >
      <div
        className="ask-ai-panel"
        id={panelId}
        role="region"
        aria-label="Ask AI about ZenScail"
        hidden={!open}
      >
        <div className="ask-ai-head">
          <span className="ask-ai-spark" aria-hidden="true">
            <SparkIcon />
          </span>
          <div>
            <p className="ask-ai-title">Ask about ZenScail</p>
            <p className="ask-ai-sub">from your favorite AI</p>
          </div>
        </div>
        <div className="ask-ai-options">
          {ASK_AI_PROVIDERS.map((provider) => (
            <a
              key={provider.id}
              className={`ask-ai-option ask-ai-option--${provider.id}`}
              href={provider.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="ask-ai-option-icon">
                <Image
                  src={provider.icon}
                  alt=""
                  width={22}
                  height={22}
                  className="ask-ai-option-logo"
                />
              </span>
              <span>{provider.label}</span>
            </a>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="ask-ai-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ask-ai-trigger-icon" aria-hidden="true">
          <SparkIcon />
        </span>
        <span className="ask-ai-trigger-text">
          Ask about ZenScail
          <span className="ask-ai-trigger-sub">from your favorite AI</span>
        </span>
      </button>
    </div>
  );
}
