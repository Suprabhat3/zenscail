"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "transcribing";

/** Pick a mime type the browser's MediaRecorder actually supports. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `recording.${ext}`);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/**
 * A voice-command mic button. Click to start recording, click again to stop;
 * the audio is transcribed (gpt-4o-mini-transcribe) and handed to `onText`,
 * which appends it to whatever input it's wired into. Requests mic permission
 * on first use and surfaces failures via `onError` (toast). Fully reusable —
 * dropped into the chat dock and the quick-add bar.
 */
export function MicButton({
  onText,
  onError,
  disabled,
  size = "md",
  title = "Speak your command",
}: {
  onText: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Voice input isn't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError?.("Microphone permission denied.");
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      cleanup();
      onError?.("Couldn't start recording.");
      return;
    }
    recorderRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      cleanup();
      if (blob.size === 0) {
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        const text = await transcribe(blob);
        if (text) onText(text);
        else onError?.("Didn't catch that — try again.");
      } catch {
        onError?.("Couldn't transcribe the audio.");
      } finally {
        setStatus("idle");
      }
    };

    rec.start();
    setStatus("recording");
  }, [cleanup, onError, onText]);

  const onClick = useCallback(() => {
    if (status === "recording") stop();
    else if (status === "idle") void start();
  }, [status, start, stop]);

  const dim = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const iconSize = size === "sm" ? 14 : 16;
  const isBusy = status === "transcribing";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isBusy}
      aria-label={status === "recording" ? "Stop recording" : title}
      title={status === "recording" ? "Stop recording" : title}
      aria-pressed={status === "recording"}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
        status === "recording"
          ? "animate-pulse border-(--accent) bg-(--accent) text-(--paper)"
          : "border-(--line) text-(--ink-soft) hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
      }`}
    >
      {isBusy ? (
        <svg className="animate-spin" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : status === "recording" ? (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
        </svg>
      )}
    </button>
  );
}
