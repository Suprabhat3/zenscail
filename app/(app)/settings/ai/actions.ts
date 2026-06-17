"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { modelInstance } from "@/lib/ai/registry";
import { type AiProvider } from "@/lib/ai/models";
import { providerModelSchema } from "@/lib/validation";

export async function saveAiSettings(formData: FormData) {
  const session = await requireSession();
  const tier = String(formData.get("tier") ?? "cloud") === "byok" ? "byok" : "cloud";

  if (tier === "cloud") {
    // Only commit the Cloud tier for users who actually have an active
    // subscription — otherwise a BYOK user who merely *selects* Cloud to look
    // around would flip to a tier they haven't paid for and get locked out of
    // the app (every page bounces a lapsed-Cloud user to the subscribe step).
    // The tier flips to "cloud" after payment is verified; until then, send
    // them to billing to subscribe and leave their working BYOK setup intact.
    if (!(await hasActiveSubscription(session.user.id))) {
      redirect("/settings/billing");
    }
    await prisma.userAiSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, tier },
      update: { tier },
    });
    revalidatePath("/settings/ai");
    redirect("/settings/ai?saved=1");
  }

  const { provider, model } = providerModelSchema.parse({
    provider: formData.get("provider"),
    model: formData.get("model"),
  });
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  const existing = await prisma.userAiSettings.findUnique({
    where: { userId: session.user.id },
  });
  // Empty key field keeps the stored key (so users can change model without re-pasting).
  const encryptedApiKey = apiKey
    ? encryptSecret(apiKey)
    : existing?.encryptedApiKey ?? null;
  if (!encryptedApiKey) redirect("/settings/ai?error=key-required");

  await prisma.userAiSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, tier, provider, model, encryptedApiKey },
    update: { tier, provider, model, encryptedApiKey },
  });
  revalidatePath("/settings/ai");
  redirect("/settings/ai?saved=1");
}

/** Cheap 1-token call to confirm the stored BYOK key works. */
export async function testAiKey() {
  const session = await requireSession();
  const settings = await prisma.userAiSettings.findUnique({
    where: { userId: session.user.id },
  });
  if (!settings?.provider || !settings.model || !settings.encryptedApiKey) {
    redirect("/settings/ai?test=missing");
  }
  try {
    await generateText({
      model: modelInstance(
        settings.provider as AiProvider,
        settings.model,
        decryptSecret(settings.encryptedApiKey),
      ),
      prompt: "ping",
      maxOutputTokens: 1,
    });
  } catch {
    redirect("/settings/ai?test=fail");
  }
  redirect("/settings/ai?test=ok");
}
