"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastAction = { label: string; onClick: () => void };

type Toast = {
  id: number;
  message: string;
  action?: ToastAction;
  /** ms before auto-dismiss; if a countdown is shown it matches this. */
  duration: number;
  /** Show a shrinking progress bar (used by the Undo window). */
  countdown?: boolean;
  /** Fired when the toast ends WITHOUT the action being used (timeout or ✕) —
   * e.g. the undo window elapsed, so commit the deferred send. */
  onExpire?: () => void;
  createdAt: number;
};

type ToastOptions = {
  action?: ToastAction;
  duration?: number;
  countdown?: boolean;
  onExpire?: () => void;
};

type ToastContextValue = {
  toast: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  toastsRef.current = toasts;
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Guards against a toast's onExpire firing twice (StrictMode / double dismiss).
  const expired = useRef<Set<number>>(new Set());

  // `viaAction` = the action button (e.g. Undo) was used, so suppress onExpire.
  const dismiss = useCallback((id: number, viaAction = false) => {
    const target = toastsRef.current.find((t) => t.id === id);
    if (target?.onExpire && !viaAction && !expired.current.has(id)) {
      expired.current.add(id);
      target.onExpire();
    }
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = nextId++;
      const duration = opts.duration ?? 4000;
      setToasts((list) => [
        ...list,
        {
          id,
          message,
          action: opts.action,
          duration,
          countdown: opts.countdown,
          onExpire: opts.onExpire,
          createdAt: Date.now(),
        },
      ]);
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
      return id;
    },
    [dismiss],
  );

  // Snapshot the ref into a local for cleanup to satisfy lint/no-stale-ref.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{ zIndex: 70 }}
        className="pointer-events-none fixed bottom-6 left-1/2 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            toast={t}
            onDismiss={() => dismiss(t.id)}
            onAction={() => dismiss(t.id, true)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onAction,
}: {
  toast: Toast;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <div className="pointer-events-auto overflow-hidden rounded-xl border border-(--line) bg-(--ink) text-(--bg) shadow-(--shadow-float)">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm font-medium">{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onAction();
            }}
            className="shrink-0 rounded-full bg-(--bg) px-3 py-1 text-xs font-bold text-(--ink) transition hover:bg-(--accent) hover:text-(--bg)"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-(--bg)/60 transition hover:text-(--bg)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {toast.countdown && (
        <div
          className="h-0.5 origin-left bg-(--accent)"
          style={{ animation: `toast-countdown ${toast.duration}ms linear forwards` }}
        />
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
