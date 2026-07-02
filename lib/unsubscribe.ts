import "server-only";

import type { TenantScope } from "@corsair-dev/app";
import { header, sendEmail, type GmailMessage } from "@/lib/gmail";

/**
 * Executes a newsletter unsubscribe from a message's List-Unsubscribe header
 * (RFC 2369) with three strategies, best first:
 *
 *  1. "one-click" — the message also carries `List-Unsubscribe-Post:
 *     List-Unsubscribe=One-Click` (RFC 8058): POST the https target from the
 *     server, no user interaction needed.
 *  2. "mailto"   — send the unsubscribe email through the user's own Gmail
 *     (senders honor it because it comes from the subscribed address).
 *  3. "link"     — only a plain http(s) target exists; we can't safely GET it
 *     blind (many are confirmation pages), so return it for the user to open.
 */

export type UnsubscribeMethod = "one-click" | "mailto" | "link";

export type UnsubscribeResult =
  | { ok: true; method: UnsubscribeMethod; link?: string }
  | { ok: false; error: string };

type ParsedTargets = { mailto: string | null; url: string | null };

/** Parse `<mailto:a@b?subject=x>, <https://y/unsub>` into its first targets. */
export function parseListUnsubscribe(value: string): ParsedTargets {
  let mailto: string | null = null;
  let url: string | null = null;
  for (const match of value.matchAll(/<([^>]+)>/g)) {
    const target = match[1].trim();
    if (!mailto && /^mailto:/i.test(target)) mailto = target;
    if (!url && /^https?:\/\//i.test(target)) url = target;
  }
  return { mailto, url };
}

/** Reject targets that would let a crafted header aim requests at our network. */
function isSafeHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "0.0.0.0" ||
    host.startsWith("[") // IPv6 literals — not worth allowing
  ) {
    return false;
  }
  return true;
}

/** RFC 8058 one-click: a bare POST with the fixed form body. */
async function postOneClick(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send the mailto: unsubscribe through the user's own mailbox. */
async function sendMailtoUnsubscribe(
  t: TenantScope,
  target: string,
): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return false;
  }
  const to = decodeURIComponent(u.pathname).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const subject = u.searchParams.get("subject") || "unsubscribe";
  const body =
    u.searchParams.get("body") ||
    "Please unsubscribe me from this mailing list.";
  const res = await sendEmail(t, { to, subject, text: body });
  return res.success;
}

/**
 * Read a message's unsubscribe headers and execute the best available method.
 * `messageId` is any recent message from the sender (we use the latest cached
 * one — newsletters keep their unsubscribe endpoints stable across issues).
 */
export async function performUnsubscribe(
  t: TenantScope,
  messageId: string,
): Promise<UnsubscribeResult> {
  const res = await t.run<GmailMessage>("gmail.api.messages.get", {
    id: messageId,
    format: "metadata",
  });
  if (!res.success) return { ok: false, error: "Could not read the message." };

  const listUnsub = header(res.data.payload, "List-Unsubscribe");
  if (!listUnsub) {
    return { ok: false, error: "This sender has no unsubscribe header." };
  }
  const oneClick = /one-click/i.test(
    header(res.data.payload, "List-Unsubscribe-Post"),
  );
  const { mailto, url } = parseListUnsubscribe(listUnsub);
  const safeUrl = url && isSafeHttpUrl(url) ? url : null;

  if (oneClick && safeUrl && (await postOneClick(safeUrl))) {
    return { ok: true, method: "one-click" };
  }
  if (mailto && (await sendMailtoUnsubscribe(t, mailto))) {
    return { ok: true, method: "mailto" };
  }
  if (safeUrl) {
    return { ok: true, method: "link", link: safeUrl };
  }
  return { ok: false, error: "No usable unsubscribe target on this sender." };
}
