"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser, myAddressSet } from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getThread, header } from "@/lib/gmail";
import { setFollowUp, dismissFollowUp } from "@/lib/followUp";

/**
 * Arm a "remind me if no reply" follow-up on a thread. Captures the latest
 * message id + subject + the other party so the reminder can later tell whether
 * a reply landed and display useful context without re-fetching.
 */
export async function createFollowUp(threadId: string, days: number, note?: string) {
  if (!threadId) throw new Error("threadId required");
  if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid reminder window");

  const session = await requireSession();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const res = await getThread(t, threadId);
  if (!res.success) redirect("/connect");
  const messages = res.data.messages ?? [];
  if (messages.length === 0) throw new Error("Thread is empty");

  const last = messages[messages.length - 1];
  const subject = header(messages[0].payload, "Subject") || "(no subject)";
  // The party we're waiting on: the most recent sender that isn't us. Falls
  // back to the latest sender. Stored for display only.
  const mine = myAddressSet(identity);
  let contact = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const from = header(messages[i].payload, "From");
    const lower = from.toLowerCase();
    if (![...mine].some((addr) => lower.includes(addr))) {
      contact = from;
      break;
    }
  }
  if (!contact) contact = header(last.payload, "From");

  const remindAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await setFollowUp(userId, {
    threadId,
    lastKnownMessageId: last.id ?? "",
    subject,
    contact,
    remindAt,
    note: note?.trim() || null,
  });

  revalidatePath("/mail");
  revalidatePath(`/mail/thread/${threadId}`);
}

/** Dismiss a follow-up the user has handled. */
export async function clearFollowUp(threadId: string) {
  if (!threadId) throw new Error("threadId required");
  const session = await requireSession();
  await dismissFollowUp(session.user.id, threadId);
  revalidatePath("/mail");
  revalidatePath(`/mail/thread/${threadId}`);
}
