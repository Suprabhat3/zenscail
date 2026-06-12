"use client";

import { useState } from "react";
import { PROVIDERS, MODELS, type AiProvider } from "@/lib/ai/models";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none";

export function AiSettingsForm({
  action,
  initial,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: { tier: "cloud" | "byok"; provider?: AiProvider; model?: string; hasKey: boolean };
}) {
  const [tier, setTier] = useState<"cloud" | "byok">(initial.tier);
  const [provider, setProvider] = useState<AiProvider>(initial.provider ?? "openai");

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-neutral-300">Tier</legend>
        <label className="flex items-start gap-2 text-sm text-neutral-300">
          <input
            type="radio"
            name="tier"
            value="cloud"
            checked={tier === "cloud"}
            onChange={() => setTier("cloud")}
            className="mt-1"
          />
          <span>
            Cloud (default) —{" "}
            <span className="text-neutral-500">we provide the model, no setup needed</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-neutral-300">
          <input
            type="radio"
            name="tier"
            value="byok"
            checked={tier === "byok"}
            onChange={() => setTier("byok")}
            className="mt-1"
          />
          <span>
            Bring your own key (free) —{" "}
            <span className="text-neutral-500">use your own provider API key</span>
          </span>
        </label>
      </fieldset>

      {tier === "byok" && (
        <>
          <label className="block text-sm text-neutral-300">
            Provider
            <select
              name="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as AiProvider)}
              className={inputClass}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-neutral-300">
            Model
            <select
              name="model"
              defaultValue={initial.provider === provider ? initial.model : undefined}
              className={inputClass}
            >
              {MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-neutral-300">
            API key
            <input
              type="password"
              name="apiKey"
              autoComplete="off"
              placeholder={initial.hasKey ? "•••••••• (saved — leave blank to keep)" : "sk-…"}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Encrypted at rest. Never sent back to the browser.
            </span>
          </label>
        </>
      )}

      <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white">
        Save settings
      </button>
    </form>
  );
}
