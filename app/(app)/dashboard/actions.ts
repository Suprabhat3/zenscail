"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { checkUserAiLimit } from "@/lib/rate-limit";
import {
  generateDailyBrief,
  setBriefItemState,
} from "@/lib/ai/brief";

const SetBriefItemStateSchema = z.object({
  key: z.string().min(1),
  state: z
    .object({ status: z.enum(["done", "snoozed"]), until: z.string().optional() })
    .nullable(),
});

/**
 * Generate (or regenerate) today's brief for the signed-in user. Used as a
 * fallback when the 9am cron hasn't run yet (e.g. user signed up today, or
 * local dev) and by the dashboard's refresh button.
 */
export async function generateBriefAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  // Per-user AI guard: brief generation is an expensive multi-step LLM call.
  if (!checkUserAiLimit(session.user.id).ok) {
    return { ok: false, error: "Too many requests — please wait a few seconds and try again." };
  }
  try {
    await generateDailyBrief(session.user.id);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate your brief.";
    return { ok: false, error: message };
  }
}

/**
 * Mark a brief action item done, snooze it until a time, or clear its state
 * (pass null). `key` is the item's stable key from `itemKey()`.
 */
export async function setBriefItemStateAction(
  key: string,
  state: { status: "done" | "snoozed"; until?: string } | null,
): Promise<{ ok: boolean }> {
  const parsed = SetBriefItemStateSchema.safeParse({ key, state });
  if (!parsed.success) return { ok: false };
  const session = await requireSession();
  await setBriefItemState(session.user.id, parsed.data.key, parsed.data.state);
  revalidatePath("/dashboard");
  return { ok: true };
}
