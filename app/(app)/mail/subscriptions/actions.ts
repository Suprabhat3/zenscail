"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { performUnsubscribe } from "@/lib/unsubscribe";

const UnsubscribeSchema = z.object({
  senders: z
    .array(
      z.object({
        addr: z.string().trim().toLowerCase().min(3).max(320),
        name: z.string().max(200).optional(),
        messageId: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

export type SenderUnsubscribeResult = {
  addr: string;
  ok: boolean;
  method?: "one-click" | "mailto" | "link";
  /** Set for method "link": the user finishes in the browser. */
  link?: string;
  error?: string;
};

/**
 * Unsubscribe from one or many newsletter senders. Each sender is resolved
 * from its latest message's List-Unsubscribe header and executed independently
 * (one bad sender never blocks the rest). Every success — including the "link"
 * fallback, which the user finishes manually — is recorded so the sender moves
 * to the "unsubscribed" list and never re-surfaces as active.
 */
export async function unsubscribeSendersAction(input: {
  senders: { addr: string; name?: string; messageId: string }[];
}): Promise<{ results: SenderUnsubscribeResult[] }> {
  const { senders } = UnsubscribeSchema.parse(input);
  const session = await requireSession();
  const userId = session.user.id;
  const t = corsairTenant(await ensureCorsairTenant(userId));

  const results = await Promise.all(
    senders.map(async (s): Promise<SenderUnsubscribeResult> => {
      try {
        const res = await performUnsubscribe(t, s.messageId);
        if (!res.ok) return { addr: s.addr, ok: false, error: res.error };
        await prisma.unsubscribedSender
          .upsert({
            where: { userId_senderAddr: { userId, senderAddr: s.addr } },
            create: {
              userId,
              senderAddr: s.addr,
              senderName: s.name ?? null,
              method: res.method,
              link: res.link ?? null,
            },
            update: { method: res.method, link: res.link ?? null },
          })
          .catch(() => {});
        return { addr: s.addr, ok: true, method: res.method, link: res.link };
      } catch {
        return { addr: s.addr, ok: false, error: "Something went wrong." };
      }
    }),
  );

  revalidatePath("/mail/subscriptions");
  return { results };
}
