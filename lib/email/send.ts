import "server-only";

import { Resend } from "resend";
import { verificationEmail, onboardingEmail } from "./render";

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
