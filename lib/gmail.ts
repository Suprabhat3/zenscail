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

/** Row shape of Corsair's gmail message cache (gmail.db.messages.search). */
export type CachedMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
  internalDate?: string | number | null;
  labelIds?: string[];
  createdAt?: string;
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

export async function searchCachedMessages(
  t: TenantScope,
  opts: { query?: string; limit?: number; offset?: number } = {},
): Promise<CachedMessage[]> {
  const { query, limit = 50, offset = 0 } = opts;
  const run = (data?: Record<string, unknown>) =>
    t.run<CachedMessage[] | { results?: CachedMessage[] }>(
      "gmail.db.messages.search",
      { ...(data ? { data } : {}), limit, offset },
    );

  let rows: CachedMessage[] = [];
  if (query) {
    // No OR operator in the filter language — run per-field and merge.
    const [bySubject, byFrom, byBody] = await Promise.all([
      run({ subject: { contains: query } }),
      run({ from: { contains: query } }),
      run({ body: { contains: query } }),
    ]);
    const seen = new Set<string>();
    for (const result of [bySubject, byFrom, byBody]) {
      if (!result.success) continue;
      for (const row of normalizeRows(result.data)) {
        if (row.id && !seen.has(row.id)) {
          seen.add(row.id);
          rows.push(row);
        }
      }
    }
  } else {
    const result = await run();
    if (result.success) rows = normalizeRows(result.data);
  }

  return rows.sort(
    (a, b) => toMillis(b.internalDate ?? b.createdAt) - toMillis(a.internalDate ?? a.createdAt),
  );
}

function normalizeRows(
  data: CachedMessage[] | { results?: CachedMessage[] } | unknown,
): CachedMessage[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { results?: CachedMessage[] }).results)) {
    return (data as { results: CachedMessage[] }).results;
  }
  return [];
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

export async function modifyMessage(
  t: TenantScope,
  id: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  return t.run("gmail.api.messages.modify", { id, ...changes });
}
