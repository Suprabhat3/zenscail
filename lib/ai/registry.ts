import "server-only";

import { createOpenAI, openai } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import {
  CLOUD_MODEL,
  CLOUD_CHEAP_MODEL,
  cheapModelFor,
  type AiProvider,
} from "./models";

export function modelInstance(
  provider: AiProvider,
  model: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
}

type ResolvedModel = {
  model: LanguageModel;
  /** Cheapest model of the same provider/key — for the priority classifier. */
  cheapModel: LanguageModel;
  tier: "cloud" | "byok";
};

/**
 * Resolve the chat model for a user: BYOK settings if configured, otherwise
 * the cloud tier on our OPENAI_API_KEY.
 */
export async function getModelForUser(userId: string): Promise<ResolvedModel> {
  const settings = await prisma.userAiSettings.findUnique({ where: { userId } });

  if (
    settings?.tier === "byok" &&
    settings.provider &&
    settings.model &&
    settings.encryptedApiKey
  ) {
    const provider = settings.provider as AiProvider;
    const apiKey = decryptSecret(settings.encryptedApiKey);
    return {
      model: modelInstance(provider, settings.model, apiKey),
      cheapModel: modelInstance(provider, cheapModelFor(provider), apiKey),
      tier: "byok",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "No AI model available: set up a BYOK key in /settings/ai or configure OPENAI_API_KEY",
    );
  }
  return {
    model: openai(CLOUD_MODEL),
    cheapModel: openai(CLOUD_CHEAP_MODEL),
    tier: "cloud",
  };
}
