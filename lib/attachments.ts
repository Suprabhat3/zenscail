import { z } from "zod";

/**
 * Shared limits + schema for outgoing email attachments. Imported by both the
 * client compose UI (to enforce the cap before upload and render a friendly
 * error) and the server actions (to re-validate untrusted input at the
 * boundary).
 *
 * NOTE on the small cap: outgoing mail is sent through Corsair's `/run` proxy,
 * whose request body is capped at ~100KB. The attachment bytes ride inside the
 * base64 `raw` message, which roughly doubles their size on the wire, so the
 * usable ceiling for all attachments combined is ~40KB. Anything larger is
 * rejected by Corsair with a 413 before it ever reaches Gmail. (Lifting this
 * needs a direct Gmail upload path that bypasses Corsair — see the attachment
 * notes.) The UI surfaces this limit explicitly.
 */

/** Hard cap on the combined size of all attachments on a single email. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024; // 40 KB (Corsair /run body limit)

/** Human-readable form of the cap, for UI copy and error messages. */
export const MAX_TOTAL_ATTACHMENT_LABEL = "40 KB";

/** Format a byte count for chips/errors, e.g. "1.4 MB", "812 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * One attachment as it crosses the client→server boundary: base64-encoded
 * content plus the metadata needed to build the MIME part.
 */
export const outgoingAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(255).default("application/octet-stream"),
  /** Standard base64 (not url-safe) of the raw file bytes. */
  dataBase64: z.string().min(1),
});

export type OutgoingAttachmentInput = z.input<typeof outgoingAttachmentSchema>;

/**
 * A list of attachments, capped in count and decoded size. The byte cap is
 * checked against the decoded length (base64 is ~33% larger than the bytes).
 */
export const outgoingAttachmentsSchema = z
  .array(outgoingAttachmentSchema)
  .max(25, "Too many attachments")
  .refine(
    (atts) =>
      atts.reduce((sum, a) => sum + decodedBase64Length(a.dataBase64), 0) <=
      MAX_TOTAL_ATTACHMENT_BYTES,
    { error: `Attachments exceed the ${MAX_TOTAL_ATTACHMENT_LABEL} limit` },
  );

/** Decoded byte length of a base64 string without allocating the buffer. */
export function decodedBase64Length(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}
