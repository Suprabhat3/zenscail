// Curated model lists per provider, shared by the settings UI and registry.
// Cheap model (last entry's `cheap` flag) is used by the priority classifier.

export type AiProvider = "openai" | "anthropic" | "google" | "groq";

export type ProviderInfo = {
  id: AiProvider;
  label: string;
  /** Where the user creates/copies an API key for this provider. */
  keyUrl: string;
  /** Typical key prefix, shown as the input placeholder so users know it's right. */
  keyHint: string;
  /** One-line description for the provider directory. */
  blurb: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    blurb: "GPT-5 family. Great all-round quality.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-…",
    blurb: "Claude models. Strong writing and reasoning.",
  },
  {
    id: "google",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza…",
    blurb: "Gemini models. Fast and generous free tier.",
  },
  {
    id: "groq",
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_…",
    blurb: "Open models at very high speed.",
  },
];

export const PROVIDER_BY_ID: Record<AiProvider, ProviderInfo> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<AiProvider, ProviderInfo>;

export const MODELS: Record<AiProvider, { id: string; label: string; cheap?: boolean }[]> = {
  openai: [
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.2", label: "GPT-5.2" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", cheap: true },
    { id: "gpt-5-nano", label: "GPT-5 nano", cheap: true }
  ],
  anthropic: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", cheap: true },
  ],
  google: [
    { id: "gemini-3-pro", label: "Gemini 3 Pro" },
    { id: "gemini-3-flash", label: "Gemini 3 Flash", cheap: true },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", cheap: true },
  ],
  // Curated for reliable tool calling. GPT-OSS and the groq/compound agentic
  // systems were dropped — they handle custom tool definitions poorly. Kimi K2
  // is purpose-built for agentic tool use; the rest support parallel tool calls.
  groq: [
    { id: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
    { id: "qwen/qwen3-32b", label: "Qwen 3 32B" },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", cheap: true },
  ],
};

/** Cloud (default) tier — uses our own OPENAI_API_KEY. */
export const CLOUD_MODEL = "gpt-5.4";
export const CLOUD_CHEAP_MODEL = "gpt-5-nano";

/**
 * Smart-compose ghost text — a fast non-reasoning model so completions don't
 * burn the whole output budget on hidden reasoning (common with nano tiers).
 */
export const COMPOSE_MODEL = "gpt-5.4-mini";

/**
 * Speech-to-text model for the mic / voice-command feature. Always runs on our
 * OPENAI_API_KEY (transcription is OpenAI-specific, independent of the user's
 * chosen chat provider).
 */
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe-2025-12-15";

export function isValidModel(provider: AiProvider, model: string): boolean {
  return MODELS[provider]?.some((m) => m.id === model) ?? false;
}

export function cheapModelFor(provider: AiProvider): string {
  const list = MODELS[provider] ?? [];
  return (list.find((m) => m.cheap) ?? list[list.length - 1])?.id ?? CLOUD_CHEAP_MODEL;
}
