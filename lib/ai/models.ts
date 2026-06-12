// Curated model lists per provider, shared by the settings UI and registry.
// Cheap model (last entry's `cheap` flag) is used by the priority classifier.

export type AiProvider = "openai" | "anthropic" | "google";

export const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
];

export const MODELS: Record<AiProvider, { id: string; label: string; cheap?: boolean }[]> = {
  openai: [
    { id: "gpt-5.2", label: "GPT-5.2" },
    { id: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
    { id: "gpt-5-mini", label: "GPT-5 mini", cheap: true },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini", cheap: true },
  ],
  anthropic: [
    { id: "claude-fable-5", label: "Claude Fable 5" },
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
};

/** Cloud (default) tier — uses our own OPENAI_API_KEY. */
export const CLOUD_MODEL = "gpt-5.2";
export const CLOUD_CHEAP_MODEL = "gpt-5-mini";

export function isValidModel(provider: AiProvider, model: string): boolean {
  return MODELS[provider]?.some((m) => m.id === model) ?? false;
}

export function cheapModelFor(provider: AiProvider): string {
  const list = MODELS[provider] ?? [];
  return (list.find((m) => m.cheap) ?? list[list.length - 1])?.id ?? CLOUD_CHEAP_MODEL;
}
