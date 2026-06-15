import "server-only";

import type { TenantScope } from "@corsair-dev/app";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getModelForUser } from "./registry";
import { getMessage, extractBodies, header } from "@/lib/gmail";

/** Structured one-glance summary shown in the inbox hover card. */
export type EmailSummaryData = {
  tldr: string;
  bullets: string[];
  action: string | null;
};

const SummarySchema = z.object({
  tldr: z.string().max(220),
  bullets: z.array(z.string().max(160)).max(4),
  action: z.string().max(160).nullable(),
});

const SYSTEM = `You summarize a single email so a busy professional can grasp it at a glance, WITHOUT opening it.

Return:
- "tldr": one tight sentence (max ~25 words) capturing what this email is about and why it matters.
- "bullets": 0–4 short key points (each a fragment, no trailing punctuation) — facts, asks, dates, numbers. Omit fluff, greetings, signatures, legal boilerplate, and unsubscribe noise. Use [] when the tldr already says everything.
- "action": the ONE concrete thing the recipient needs to do (e.g. "Reply with availability for Thursday", "Pay invoice by Jun 20", "Review the attached doc"). Use null if no action is needed (newsletters, FYIs, receipts, notifications).

Be specific to the actual content. Never invent facts the email doesn't contain. Be concise.`;

/** Strip HTML to rough plain text when an email has no text/plain part. */
function htmlToText(html: string): string {
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

function rowToData(row: { tldr: string; bullets: unknown; action: string | null }): EmailSummaryData {
  return {
    tldr: row.tldr,
    bullets: Array.isArray(row.bullets) ? (row.bullets as unknown[]).map(String) : [],
    action: row.action,
  };
}

/**
 * Generate a summary for one message with the user's CHIEF model, persist it,
 * and return it. Best-effort: returns null on a missing model, an unfetchable
 * message, or any failure. Uses upsert so two concurrent hovers can't duplicate.
 */
async function generateAndStore(
  userId: string,
  t: TenantScope,
  messageId: string,
): Promise<EmailSummaryData | null> {
  const res = await getMessage(t, messageId);
  if (!res.success) return null;
  const m = res.data;

  const subject = header(m.payload, "Subject") || "(no subject)";
  const from = header(m.payload, "From") || "(unknown sender)";
  const bodies = extractBodies(m.payload);
  const raw = bodies.text || (bodies.html ? htmlToText(bodies.html) : "") || m.snippet || "";
  const body = raw.replace(/\s+\n/g, "\n").slice(0, 6000);

  let model;
  try {
    ({ model } = await getModelForUser(userId));
  } catch {
    return null;
  }

  const { object } = await generateObject({
    model,
    schema: SummarySchema,
    system: SYSTEM,
    prompt: `From: ${from}\nSubject: ${subject}\n\n${body}`,
  });

  const data: EmailSummaryData = {
    tldr: object.tldr,
    bullets: object.bullets,
    action: object.action,
  };

  await prisma.emailSummary.upsert({
    where: { userId_gmailMessageId: { userId, gmailMessageId: messageId } },
    create: { userId, gmailMessageId: messageId, ...data },
    update: data,
  });

  return data;
}

/**
 * Get the stored summary for a message, generating + caching it on first call.
 * The hover UI's entry point — guarantees a summary is generated at most once
 * per email. Best-effort: returns null on any failure.
 */
export async function getEmailSummaryFor(
  userId: string,
  t: TenantScope,
  messageId: string,
): Promise<EmailSummaryData | null> {
  if (!messageId) return null;
  try {
    const existing = await prisma.emailSummary.findUnique({
      where: { userId_gmailMessageId: { userId, gmailMessageId: messageId } },
    });
    if (existing) return rowToData(existing);
    return await generateAndStore(userId, t, messageId);
  } catch {
    return null;
  }
}

/**
 * Pre-generate summaries for a batch of freshly-arrived messages (called from
 * the inbound webhook so they're ready before the user hovers). Skips messages
 * already summarized; best-effort and bounded so it never overruns.
 */
export async function summarizeMessages(
  userId: string,
  t: TenantScope,
  messages: { id?: string }[],
  opts: { limit?: number } = {},
): Promise<number> {
  const limit = opts.limit ?? 10;
  const ids = messages.map((m) => m.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return 0;

  const existing = await prisma.emailSummary.findMany({
    where: { userId, gmailMessageId: { in: ids } },
    select: { gmailMessageId: true },
  });
  const seen = new Set(existing.map((e) => e.gmailMessageId));
  const todo = ids.filter((id) => !seen.has(id)).slice(0, limit);
  if (todo.length === 0) return 0;

  const results = await Promise.allSettled(
    todo.map((id) => generateAndStore(userId, t, id)),
  );
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}
