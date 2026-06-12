import "server-only";

import type { TenantScope } from "@corsair-dev/app";

// --- Gmail API payload types (subset we use) ---

export type GmailHeader = { name?: string; value?: string };

export type GmailPayload = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPayload[];
};

export type GmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string | number | null;
  payload?: GmailPayload;
};

export type GmailThread = {
  id?: string;
  snippet?: string;
  messages?: GmailMessage[];
};

/**
 * Hydrated inbox row for the UI. NOTE: Corsair's gmail.db.messages.search cache
 * only stores `{ entity_id, data: { id, threadId, createdAt } }` — it does NOT
 * cache subject/from/snippet/body. So we get the message refs (id + threadId)
 * and hydrate sender/subject/snippet via gmail.api.messages.get (format=metadata).
 */
export type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: number;
  unread: boolean;
};

// --- Helpers ---

export function header(payload: GmailPayload | undefined, name: string): string {
  return (
    payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Walk MIME parts and return { text, html } bodies. */
export function extractBodies(payload: GmailPayload | undefined): {
  text: string;
  html: string;
} {
  let text = "";
  let html = "";
  function walk(part?: GmailPayload) {
    if (!part) return;
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain" && !text) text = decoded;
      if (part.mimeType === "text/html" && !html) html = decoded;
    }
    part.parts?.forEach(walk);
  }
  walk(payload);
  return { text, html };
}

/** Build a base64url-encoded RFC 2822 message for gmail.api.messages.send. */
export function buildRawEmail(opts: {
  to: string;
  subject: string;
  text: string;
  cc?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ``,
    opts.text,
  ];
  return encodeBase64Url(lines.join("\r\n"));
}

// --- Operations (all take a tenant scope from corsairTenant()) ---

type MessageRef = { id: string; threadId: string };

/** Hydrate message refs into UI rows via gmail.api.messages.get (metadata only). */
async function hydrate(t: TenantScope, refs: MessageRef[]): Promise<InboxMessage[]> {
  const rows = await Promise.all(
    refs.map(async (ref) => {
      // NOTE: do NOT pass `metadataHeaders` — when present Corsair returns
      // `payload.headers: undefined`. Omitting it returns all headers.
      const res = await t.run<GmailMessage>("gmail.api.messages.get", {
        id: ref.id,
        format: "metadata",
      });
      if (!res.success) return null;
      const m = res.data;
      return {
        id: ref.id,
        threadId: m.threadId ?? ref.threadId,
        from: header(m.payload, "From"),
        subject: header(m.payload, "Subject"),
        snippet: m.snippet ?? "",
        internalDate: toMillis(m.internalDate),
        unread: (m.labelIds ?? []).includes("UNREAD"),
      } satisfies InboxMessage;
    }),
  );
  return rows.filter((r): r is InboxMessage => r !== null);
}

/**
 * List inbox messages (or search results), hydrated with sender/subject/snippet.
 * Returns `ok: false` when the tenant isn't connected (caller redirects to /connect).
 */
export async function listInboxMessages(
  t: TenantScope,
  opts: { query?: string; limit?: number } = {},
): Promise<{ ok: boolean; messages: InboxMessage[] }> {
  const { query, limit = 25 } = opts;
  // The db cache has no searchable content columns, so we list message refs via
  // the API: Gmail `q` for search, INBOX label for the default view.
  const input = query
    ? { q: query, maxResults: limit }
    : { labelIds: ["INBOX"], maxResults: limit };
  const res = await t.run<{ messages?: { id?: string; threadId?: string }[] }>(
    "gmail.api.messages.list",
    input,
  );
  if (!res.success) return { ok: false, messages: [] };

  const refs: MessageRef[] = (res.data?.messages ?? [])
    .filter((m): m is { id: string; threadId?: string } => Boolean(m.id))
    .map((m) => ({ id: m.id, threadId: m.threadId ?? "" }));

  const messages = (await hydrate(t, refs)).sort(
    (a, b) => b.internalDate - a.internalDate,
  );
  return { ok: true, messages };
}

function toMillis(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(n) && n > 0) return n;
  const d = Date.parse(String(value));
  return Number.isNaN(d) ? 0 : d;
}

/** Pull fresh messages from the Gmail API into Corsair's cache. */
export async function refreshMessages(t: TenantScope, maxResults = 50) {
  return t.run("gmail.api.messages.list", { maxResults });
}

export async function getThread(t: TenantScope, id: string) {
  return t.run<GmailThread>("gmail.api.threads.get", { id, format: "full" });
}

export async function sendEmail(
  t: TenantScope,
  opts: Parameters<typeof buildRawEmail>[0] & { threadId?: string },
) {
  const raw = buildRawEmail(opts);
  return t.run("gmail.api.messages.send", {
    raw,
    ...(opts.threadId ? { threadId: opts.threadId } : {}),
  });
}

export async function trashMessage(t: TenantScope, id: string) {
  return t.run("gmail.api.messages.trash", { id });
}

/** Clear the UNREAD label from every message in a thread. */
export async function markThreadRead(t: TenantScope, id: string) {
  return t.run("gmail.api.threads.modify", { id, removeLabelIds: ["UNREAD"] });
}

export async function modifyMessage(
  t: TenantScope,
  id: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return t.run("gmail.api.messages.modify", { id, ...changes });
}
