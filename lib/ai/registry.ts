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
  MODELS,
  cheapModelFor,
  isValidModel,
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
 *
 * `overrideModel` (the chat UI's per-conversation model picker) is honored
 * only within the user's own tier: a BYOK user can pick any model of THEIR
 * provider (their key, their bill); a cloud user can pick any of our curated
 * OpenAI models. Invalid overrides are ignored, never an error.
 */
export async function getModelForUser(
  userId: string,
  overrideModel?: string,
): Promise<ResolvedModel> {
  const settings = await prisma.userAiSettings.findUnique({ where: { userId } });

  if (
    settings?.tier === "byok" &&
    settings.provider &&
    settings.model &&
    settings.encryptedApiKey
  ) {
    const provider = settings.provider as AiProvider;
    const apiKey = decryptSecret(settings.encryptedApiKey);
    const modelId =
      overrideModel && isValidModel(provider, overrideModel)
        ? overrideModel
        : settings.model;
    return {
      model: modelInstance(provider, modelId, apiKey),
      cheapModel: modelInstance(provider, cheapModelFor(provider), apiKey),
      tier: "byok",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "No AI model available: set up a BYOK key in /settings/ai or configure OPENAI_API_KEY",
    );
  }
  const cloudModel =
    overrideModel && isValidModel("openai", overrideModel) ? overrideModel : CLOUD_MODEL;
  return {
    model: openai(cloudModel),
    cheapModel: openai(CLOUD_CHEAP_MODEL),
    tier: "cloud",
  };
}

export type ChatModelOptions = {
  tier: "cloud" | "byok";
  provider: AiProvider;
  defaultModel: string;
  models: { id: string; label: string }[];
};

/** Model list for the chat UI's picker, scoped to the user's tier. */
export async function getChatModelOptions(userId: string): Promise<ChatModelOptions> {
  const settings = await prisma.userAiSettings.findUnique({ where: { userId } });

  if (
    settings?.tier === "byok" &&
    settings.provider &&
    settings.model &&
    settings.encryptedApiKey
  ) {
    const provider = settings.provider as AiProvider;
    return {
      tier: "byok",
      provider,
      defaultModel: settings.model,
      models: MODELS[provider].map(({ id, label }) => ({ id, label })),
    };
  }

  return {
    tier: "cloud",
    provider: "openai",
    defaultModel: CLOUD_MODEL,
    models: MODELS.openai.map(({ id, label }) => ({ id, label })),
  };
}
