"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { generateDailyBrief } from "@/lib/ai/brief";

/**
 * Generate (or regenerate) today's brief for the signed-in user. Used as a
 * fallback when the 9am cron hasn't run yet (e.g. user signed up today, or
 * local dev) and by the dashboard's refresh button.
 */
export async function generateBriefAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  try {
    await generateDailyBrief(session.user.id);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate your brief.";
    return { ok: false, error: message };
  }
}
