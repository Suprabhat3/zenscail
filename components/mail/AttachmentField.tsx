"use client";

import { useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, MAX_TOTAL_ATTACHMENT_LABEL } from "@/lib/attachments";
import { useAttachments } from "@/components/mail/AttachmentsContext";

/**
 * Gmail-style attach control: a paperclip button that opens the native file
 * picker, plus a row of chips for the staged files (each removable). Reads/writes
 * the shared AttachmentsProvider, so the SendBar can encode the same files into
 * the send payload. No-ops if rendered without a provider.
 */
export function AttachmentField() {
  const att = useAttachments();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!att) return null;
  const { files, totalBytes, add, remove } = att;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (picked && picked.length > 0) {
      const result = add(picked);
      if (result?.rejected.length) {
        toast(
          `Skipped ${result.rejected.length} file${result.rejected.length === 1 ? "" : "s"} — over the ${MAX_TOTAL_ATTACHMENT_LABEL} limit`,
        );
      }
    }
    // Reset so picking the same file again re-fires change.
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-(--line) bg-(--bg) py-1 pr-1 pl-2.5 text-xs text-(--ink-soft)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-(--muted)">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="max-w-48 truncate" title={f.file.name}>
                {f.file.name}
              </span>
              <span className="text-(--muted)">{formatBytes(f.file.size)}</span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={`Remove ${f.file.name}`}
                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-(--muted) transition hover:bg-(--line-soft) hover:text-(--ink)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          Attach
        </button>
        {files.length > 0 ? (
          <span className="text-xs text-(--muted)">
            {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} of {MAX_TOTAL_ATTACHMENT_LABEL}
          </span>
        ) : (
          <span className="text-xs text-(--muted)">Small files only — up to {MAX_TOTAL_ATTACHMENT_LABEL}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onPick}
          className="hidden"
        />
      </div>
    </div>
  );
}
