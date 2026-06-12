"use client";

import { useState } from "react";
import { PROVIDERS, MODELS, type AiProvider } from "@/lib/ai/models";

const inputClass =
  "mt-1 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";

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
    <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-(--muted)">AI model</h2>
      <form action={action} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-(--ink)">Tier</legend>
          {[
            { value: "cloud", label: "Cloud (default)", sub: "We provide the model — no setup needed." },
            { value: "byok", label: "Bring your own key", sub: "Use your own provider API key. Free to use." },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                tier === opt.value
                  ? "border-(--accent)/50 bg-(--accent-soft)"
                  : "border-(--line-soft) bg-(--bg) hover:border-(--line)"
              }`}
            >
              <input
                type="radio"
                name="tier"
                value={opt.value}
                checked={tier === opt.value}
                onChange={() => setTier(opt.value as "cloud" | "byok")}
                className="mt-0.5 accent-(--accent)"
              />
              <span>
                <span className={`text-sm font-semibold ${tier === opt.value ? "text-(--accent-deep)" : "text-(--ink)"}`}>
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-(--muted)">{opt.sub}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {tier === "byok" && (
          <>
            <label className="block text-sm font-medium text-(--ink)">
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

            <label className="block text-sm font-medium text-(--ink)">
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

            <label className="block text-sm font-medium text-(--ink)">
              API key
              <input
                type="password"
                name="apiKey"
                autoComplete="off"
                placeholder={initial.hasKey ? "•••••••• (saved — leave blank to keep)" : "sk-…"}
                className={inputClass}
              />
              <span className="mt-1.5 block text-xs text-(--muted)">
                Encrypted at rest. Never sent back to the browser.
              </span>
            </label>
          </>
        )}

        <button className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
          Save settings
        </button>
      </form>
    </div>
  );
}
