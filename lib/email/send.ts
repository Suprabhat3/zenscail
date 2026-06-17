import "server-only";

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import {
  verificationEmail,
  onboardingEmail,
  cloudReceiptEmail,
  activatedEmail,
} from "./render";

/**
 * Lazy Resend client (like lib/corsair.ts) so builds/CI without a key don't
 * crash at import time. When RESEND_API_KEY is unset we log the email to the
 * console instead of sending — keeps the dev signup flow working without a key.
 */
let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

const FROM = process.env.EMAIL_FROM ?? "ZenScail <onboarding@resend.dev>";

async function deliver(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.info(
      `[email:dev] RESEND_API_KEY unset — not sending "${args.subject}" to ${args.to}.\n` +
        `${args.text}`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  if (error) {
    // Surface but don't crash the auth flow — verification can be retried.
    console.error("[email] Resend send failed:", error);
    throw new Error(`Email delivery failed: ${error.message ?? "unknown"}`);
  }
}

export async function sendVerificationEmail(opts: {
  to: string;
  code: string;
  name?: string;
}): Promise<void> {
  const { subject, html, text } = verificationEmail({
    code: opts.code,
    name: opts.name,
  });
  await deliver({ to: opts.to, subject, html, text });
}

export async function sendOnboardingEmail(opts: {
  to: string;
  name?: string;
}): Promise<void> {
  const { subject, html, text } = onboardingEmail({ name: opts.name });
  await deliver({ to: opts.to, subject, html, text });
}

export async function sendCloudReceiptEmail(opts: {
  to: string;
  name?: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  renewsOn?: Date | null;
}): Promise<void> {
  const { subject, html, text } = cloudReceiptEmail(opts);
  await deliver({ to: opts.to, subject, html, text });
}

export async function sendActivatedEmail(opts: {
  to: string;
  name?: string;
}): Promise<void> {
  const { subject, html, text } = activatedEmail({ name: opts.name });
  await deliver({ to: opts.to, subject, html, text });
}

/**
 * Send the "last email you'll read manually" finale exactly once per user.
 * Guarded by `User.activatedAt` (set before sending) so repeat dashboard loads
 * never duplicate it. Best-effort: a mail failure never breaks the page.
 * Call from the dashboard on first load, after onboarding is complete.
 */
export async function sendActivatedOnce(user: {
  id: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { activatedAt: true, onboardedAt: true },
    });
    // Only the genuine finale: never before onboarding is actually finished
    // (finishByok / verifyCloudSubscription set `onboardedAt`). Without this,
    // landing on the dashboard mid-onboarding fires it alongside the welcome
    // email. And never twice.
    if (!row?.onboardedAt || row.activatedAt) return;
    await prisma.user.update({
      where: { id: user.id },
      data: { activatedAt: new Date() },
    });
    await sendActivatedEmail({ to: user.email, name: user.name ?? undefined });
  } catch (err) {
    console.warn("Activated email skipped:", err);
  }
}
