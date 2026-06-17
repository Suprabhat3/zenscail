import "server-only";

import { after } from "next/server";
import type { TenantScope } from "@corsair-dev/app";
import {
  getCachedMessages,
  putCachedMessages,
  getCachedThread,
  putCachedThread,
} from "@/lib/mailCache";

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
  /** Gmail system/category labels (e.g. CATEGORY_PROMOTIONS) — drives bundling. */
  labelIds: string[];
  /** True when the message carries a List-Unsubscribe header (bulk/newsletter). */
  hasListUnsubscribe: boolean;
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

/** Collapse an HTML body into a rough plain-text fallback for the text part. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build a base64url-encoded RFC 2822 message for gmail.api.messages.send.
 * Plain by default. When `html` is given we send a multipart/alternative with
 * both a plain-text fallback and the styled HTML part, so every mail client
 * shows something readable.
 */
export function buildRawEmail(opts: {
  to: string;
  subject: string;
  text: string;
  /** Inline-styled HTML body. When present the message is sent as HTML. */
  html?: string;
  cc?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers = [
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    `MIME-Version: 1.0`,
  ];

  if (!opts.html) {
    const lines = [...headers, `Content-Type: text/plain; charset="UTF-8"`, ``, opts.text];
    return encodeBase64Url(lines.join("\r\n"));
  }

  // multipart/alternative: text fallback first, HTML second (clients pick the
  // richest part they can render). Boundary is fixed but unambiguous.
  const boundary = "zenscail_boundary_a1b2c3";
  const text = opts.text?.trim() ? opts.text : htmlToPlain(opts.html);
  const lines = [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
  ];
  return encodeBase64Url(lines.join("\r\n"));
}

// --- Operations (all take a tenant scope from corsairTenant()) ---

type MessageRef = { id: string; threadId: string };

/**
 * Hydrate message refs into UI rows. When `userId` is given we read content from
 * our local CachedMessage table first and only call gmail.api.messages.get for
 * the refs we don't have cached, then persist the freshly fetched ones — so a
 * warm inbox costs one messages.list call and zero per-message gets.
 */
async function hydrate(
  t: TenantScope,
  refs: MessageRef[],
  userId?: string,
): Promise<InboxMessage[]> {
  const cached = userId
    ? await getCachedMessages(
        userId,
        refs.map((r) => r.id),
      ).catch(() => new Map<string, InboxMessage>())
    : new Map<string, InboxMessage>();

  const misses = refs.filter((r) => !cached.has(r.id));
  const fetched = await Promise.all(
    misses.map(async (ref) => {
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
        labelIds: m.labelIds ?? [],
        hasListUnsubscribe: Boolean(header(m.payload, "List-Unsubscribe")),
      } satisfies InboxMessage;
    }),
  );
  const fresh = fetched.filter((r): r is InboxMessage => r !== null);

  // Persist newly fetched rows so subsequent renders are cache-only.
  if (userId && fresh.length > 0) {
    await putCachedMessages(userId, fresh).catch(() => {});
  }

  // Return in the original ref order, content from cache or fresh fetch.
  const freshById = new Map(fresh.map((r) => [r.id, r]));
  return refs
    .map((r) => cached.get(r.id) ?? freshById.get(r.id))
    .filter((r): r is InboxMessage => r != null);
}

/**
 * List inbox messages (or search results), hydrated with sender/subject/snippet.
 * Returns `ok: false` when the tenant isn't connected (caller redirects to /connect).
 */
export async function listInboxMessages(
  t: TenantScope,
  opts: {
    query?: string;
    limit?: number;
    /** Gmail label ids to filter by (e.g. ["SENT"], ["DRAFT"], a custom label id). */
    labelIds?: string[];
    /** Needed for TRASH/SPAM folders — Gmail excludes them unless this is set. */
    includeSpamTrash?: boolean;
    /** App user id — enables the local content cache (skips per-message gets). */
    userId?: string;
  } = {},
): Promise<{ ok: boolean; messages: InboxMessage[] }> {
  const { query, limit = 25, labelIds, includeSpamTrash, userId } = opts;
  // The db cache has no searchable content columns, so we list message refs via
  // the API: Gmail `q` for search, or a label filter for folder views.
  const input: Record<string, unknown> = { maxResults: limit };
  if (query) input.q = query;
  // labelIds: a non-empty array filters by those labels; an empty array means
  // "all mail" (no filter); undefined with no query defaults to the inbox.
  if (labelIds && labelIds.length > 0) input.labelIds = labelIds;
  else if (labelIds === undefined && !query) input.labelIds = ["INBOX"];
  if (includeSpamTrash) input.includeSpamTrash = true;
  const res = await t.run<{ messages?: { id?: string; threadId?: string }[] }>(
    "gmail.api.messages.list",
    input,
  );
  if (!res.success) return { ok: false, messages: [] };

  const refs: MessageRef[] = (res.data?.messages ?? [])
    .filter((m): m is { id: string; threadId?: string } => Boolean(m.id))
    .map((m) => ({ id: m.id, threadId: m.threadId ?? "" }));

  const messages = (await hydrate(t, refs, userId)).sort(
    (a, b) => b.internalDate - a.internalDate,
  );
  return { ok: true, messages };
}

/** A user-created Gmail label (system labels are filtered out). */
export type GmailLabel = {
  id: string;
  name: string;
  unread: number;
};

/**
 * One `labels.list` call powering the whole mail sidebar: the user's own labels
 * (type === "user", sorted by name) plus a map of every label id → unread count
 * (so system folders like INBOX/SPAM can show badges). Returns empty data (never
 * throws) when the tenant isn't connected or the call fails.
 */
export async function getLabelData(
  t: TenantScope,
): Promise<{ custom: GmailLabel[]; unread: Record<string, number> }> {
  const res = await t.run<{
    labels?: {
      id?: string;
      name?: string;
      type?: string;
      messagesUnread?: number;
    }[];
  }>("gmail.api.labels.list", {});
  if (!res.success) return { custom: [], unread: {} };
  const labels = res.data?.labels ?? [];
  const unread: Record<string, number> = {};
  for (const l of labels) {
    if (l.id) unread[l.id] = l.messagesUnread ?? 0;
  }
  const custom = labels
    .filter((l): l is { id: string; name: string; type?: string; messagesUnread?: number } =>
      Boolean(l.id && l.name && l.type === "user"),
    )
    .map((l) => ({ id: l.id, name: l.name, unread: l.messagesUnread ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { custom, unread };
}

/** Extract an email address from a header value like `"Jo" <jo@x.com>`. */
function parseAddress(value: string): string | null {
  const angle = value.match(/<([^>]+)>/);
  const raw = (angle ? angle[1] : value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}

/**
 * Best-effort discovery of the connected mailbox's own address. Corsair doesn't
 * expose gmail.api.users.getProfile, so we sample a few inbox messages and take
 * the most common `Delivered-To` (falling back to `To`) header — that's the
 * address mail was delivered to, i.e. the connected mailbox. Returns null if
 * the tenant isn't connected or we can't determine it.
 */
export async function getConnectedAddress(t: TenantScope): Promise<string | null> {
  const list = await t.run<{ messages?: { id?: string }[] }>(
    "gmail.api.messages.list",
    { labelIds: ["INBOX"], maxResults: 8 },
  );
  if (!list.success) return null;

  const ids = (list.data?.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;

  const counts = new Map<string, number>();
  await Promise.all(
    ids.map(async (id) => {
      const res = await t.run<GmailMessage>("gmail.api.messages.get", {
        id,
        format: "metadata",
      });
      if (!res.success) return;
      const candidate =
        header(res.data.payload, "Delivered-To") || header(res.data.payload, "To");
      const addr = parseAddress(candidate);
      if (addr) counts.set(addr, (counts.get(addr) ?? 0) + 1);
    }),
  );

  let best: string | null = null;
  let bestN = 0;
  for (const [addr, n] of counts) {
    if (n > bestN) {
      best = addr;
      bestN = n;
    }
  }
  return best;
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

/**
 * Cache-first thread fetch for the conversation view. On a cache hit we return
 * the stored payload instantly (and, if stale, kick a non-blocking background
 * refresh via `after()` so it self-heals). On a miss we fetch live and store.
 * Returns null only when the tenant isn't connected / the API call fails on a
 * cold cache (caller redirects to /connect).
 */
export async function getThreadCached(
  t: TenantScope,
  userId: string,
  id: string,
): Promise<GmailThread | null> {
  const hit = await getCachedThread(userId, id).catch(() => null);
  if (hit) {
    if (hit.stale) {
      after(async () => {
        const res = await getThread(t, id).catch(() => null);
        if (res?.success) await putCachedThread(userId, id, res.data);
      });
    }
    return hit.data;
  }
  const res = await getThread(t, id);
  if (!res.success) return null;
  await putCachedThread(userId, id, res.data).catch(() => {});
  return res.data;
}

/** Fetch a single message with its full MIME payload (for body extraction). */
export async function getMessage(t: TenantScope, id: string) {
  return t.run<GmailMessage>("gmail.api.messages.get", { id, format: "full" });
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

/** Add/remove labels across every message in a thread (used by snooze/wake). */
export async function modifyThread(
  t: TenantScope,
  id: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return t.run("gmail.api.threads.modify", { id, ...changes });
}

export async function modifyMessage(
  t: TenantScope,
  id: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return t.run("gmail.api.messages.modify", { id, ...changes });
}
