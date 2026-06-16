"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { modelInstance } from "@/lib/ai/registry";
import { isValidModel, type AiProvider } from "@/lib/ai/models";

const PROVIDER_IDS = ["openai", "anthropic", "google", "groq"] as const;

function parseProvider(value: string): AiProvider {
  if (!(PROVIDER_IDS as readonly string[]).includes(value)) {
    throw new Error(`Unknown provider: ${value}`);
  }
  return value as AiProvider;
}

export async function saveAiSettings(formData: FormData) {
  const session = await requireSession();
  const tier = String(formData.get("tier") ?? "cloud") === "byok" ? "byok" : "cloud";

  if (tier === "cloud") {
    await prisma.userAiSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, tier },
      update: { tier },
    });
    revalidatePath("/settings/ai");
    redirect("/settings/ai?saved=1");
  }

  const provider = parseProvider(String(formData.get("provider") ?? ""));
  const model = String(formData.get("model") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!isValidModel(provider, model)) throw new Error(`Unknown model for ${provider}: ${model}`);

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
