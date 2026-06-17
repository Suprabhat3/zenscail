"use client";

import { useSyncExternalStore } from "react";

// A single shared clock that ticks every 30s, exposed via useSyncExternalStore
// so React stays the source of truth (no setState-in-effect, no impure render).
let current = 0;
let started = false;
const listeners = new Set<() => void>();

function ensureTicking() {
  if (started) return;
  started = true;
  current = Date.now();
  setInterval(() => {
    current = Date.now();
    for (const l of listeners) l();
  }, 30_000);
}

function subscribe(cb: () => void) {
  ensureTicking();
  current = Date.now();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Current epoch ms, refreshed every 30s. Returns 0 on the server and on the
 * first client render (so hydration matches) — treat 0 as "not ready yet".
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
