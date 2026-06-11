"use client";

import { useEffect, useState } from "react";

/**
 * Progressively types an HTML string, emitting whole tags at once so markup
 * never renders half-open. Respects prefers-reduced-motion by rendering the
 * full string immediately.
 */
export function useTypewriter(
  html: string,
  { speed = 18, delay = 0 }: { speed?: number; delay?: number } = {}
) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(html);
      setDone(true);
      return;
    }

    setText("");
    setDone(false);
    let i = 0;
    let out = "";
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function step() {
      if (cancelled) return;
      if (i >= html.length) {
        setDone(true);
        return;
      }
      if (html[i] === "<") {
        const close = html.indexOf(">", i);
        out += html.slice(i, close + 1);
        i = close + 1;
      } else {
        out += html[i];
        i++;
      }
      setText(out);
      timer = setTimeout(step, speed + Math.random() * 22);
    }

    timer = setTimeout(step, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [html, speed, delay]);

  return { text, done };
}
