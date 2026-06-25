"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  MAX_TOTAL_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_LABEL,
  type OutgoingAttachmentInput,
} from "@/lib/attachments";

/** A file the user has staged on the current compose/reply session. */
export type StagedAttachment = {
  /** Stable client id so chips have a key and removal is unambiguous. */
  id: string;
  file: File;
};

type AttachmentsContextValue = {
  files: StagedAttachment[];
  totalBytes: number;
  /** Add files, rejecting any that would push the total past the cap. */
  add: (files: FileList | File[]) => { rejected: string[] } | void;
  remove: (id: string) => void;
  clear: () => void;
  /** Read + base64-encode all staged files for the send payload. */
  toPayload: () => Promise<OutgoingAttachmentInput[]>;
};

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

let counter = 0;
function nextId(): string {
  counter += 1;
  return `att-${counter}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // btoa needs a binary string; chunk to avoid blowing the call stack on big files.
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Holds the files staged on a single compose/reply form. Both AttachmentField
 * (the UI) and SendBar (which encodes them into the send payload) read from the
 * same provider instance, so it must wrap both. Files live only in this client
 * session — they are NOT autosaved with the draft; reopening a draft starts with
 * no attachments. They are uploaded only when the user actually sends.
 */
export function AttachmentsProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<StagedAttachment[]>([]);

  const totalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.file.size, 0),
    [files],
  );

  const add = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;
      const rejected: string[] = [];
      setFiles((prev) => {
        let running = prev.reduce((sum, f) => sum + f.file.size, 0);
        const next = [...prev];
        for (const file of list) {
          if (running + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
            rejected.push(file.name);
            continue;
          }
          running += file.size;
          next.push({ id: nextId(), file });
        }
        return next;
      });
      if (rejected.length > 0) return { rejected };
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  const toPayload = useCallback(async () => {
    return Promise.all(
      files.map(async (f) => ({
        filename: f.file.name,
        mimeType: f.file.type || "application/octet-stream",
        dataBase64: await fileToBase64(f.file),
      })),
    );
  }, [files]);

  const value = useMemo(
    () => ({ files, totalBytes, add, remove, clear, toPayload }),
    [files, totalBytes, add, remove, clear, toPayload],
  );

  return (
    <AttachmentsContext.Provider value={value}>
      {children}
    </AttachmentsContext.Provider>
  );
}

/**
 * Access the staged-attachments store. Returns null when used outside a
 * provider, so SendBar (shared with forms that have no attach UI) can no-op
 * gracefully instead of throwing.
 */
export function useAttachments(): AttachmentsContextValue | null {
  return useContext(AttachmentsContext);
}

export { MAX_TOTAL_ATTACHMENT_LABEL };
