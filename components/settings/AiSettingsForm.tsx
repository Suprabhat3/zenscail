"use client";

import { useState } from "react";
import { PROVIDERS, MODELS, PROVIDER_BY_ID, type AiProvider } from "@/lib/ai/models";

const inputClass =
  "mt-1 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
    <path
      d="M5 3H3.5A1.5 1.5 0 0 0 2 4.5v6A1.5 1.5 0 0 0 3.5 12h6A1.5 1.5 0 0 0 11 10.5V9M8 2h4v4M11.5 2.5 6 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function AiSettingsForm({
  action,
  initial,
  cloudActive = false,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: { tier: "cloud" | "byok"; provider?: AiProvider; model?: string; hasKey: boolean };
  /** User has a live Cloud subscription — warn before they switch to BYOK. */
  cloudActive?: boolean;
}) {
  const [tier, setTier] = useState<"cloud" | "byok">(initial.tier);
  const [provider, setProvider] = useState<AiProvider>(initial.provider ?? "openai");
  const [warnByok, setWarnByok] = useState(false);
  const selected = PROVIDER_BY_ID[provider];

  // If the user has active Cloud, switching to BYOK is redundant — confirm first.
  function chooseTier(value: "cloud" | "byok") {
    if (value === "byok" && cloudActive && tier !== "byok") {
      setWarnByok(true);
      return;
    }
    setTier(value);
  }

  return (
    <div className="space-y-5">
      {warnByok && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
            <h3 className="font-serif text-xl text-(--ink)">You already have Cloud</h3>
            <p className="mt-2 text-sm leading-relaxed text-(--ink-soft)">
              Your ZenScail Cloud subscription is active, so you don&rsquo;t need your own
              API key — everything already works. You can still add one if you prefer,
              but you&rsquo;ll keep being billed for Cloud. You can switch back anytime
              from{" "}
              <a href="/settings/billing" className="font-medium text-(--ink) underline">
                Billing
              </a>
              .
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWarnByok(false)}
                className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
              >
                Keep Cloud
              </button>
              <button
                type="button"
                onClick={() => {
                  setTier("byok");
                  setWarnByok(false);
                }}
                className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
              >
                Use my own key anyway
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">AI model</h2>
        <form action={action} className="mt-5 space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-(--ink)">How ZenScail runs AI</legend>
            {[
              {
                value: "cloud",
                label: "ZenScail Cloud",
                sub: "We run the models for you — no key needed. Requires a subscription.",
              },
              {
                value: "byok",
                label: "Bring your own key",
                sub: "Use your own provider key. Free — you pay your provider directly.",
              },
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
                  onChange={() => chooseTier(opt.value as "cloud" | "byok")}
                  className="mt-0.5 accent-(--accent)"
                />
                <span>
                  <span
                    className={`text-sm font-semibold ${
                      tier === opt.value ? "text-(--accent-deep)" : "text-(--ink)"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-(--muted)">{opt.sub}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {tier === "byok" && (
            <>
              {/* Provider pills */}
              <div>
                <span className="text-sm font-medium text-(--ink)">Provider</span>
                <input type="hidden" name="provider" value={provider} />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        provider === p.id
                          ? "border-(--accent)/60 bg-(--accent-soft) text-(--accent-deep)"
                          : "border-(--line-soft) bg-(--bg) text-(--ink-soft) hover:border-(--line)"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Get-a-key helper for the selected provider */}
              <a
                href={selected.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-3 text-sm transition hover:border-(--accent)/50 hover:bg-(--accent-soft)"
              >
                <span className="text-(--ink-soft)">
                  Don&rsquo;t have a key? Get one from{" "}
                  <span className="font-semibold text-(--ink)">{selected.label}</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-(--accent-deep)">
                  Open <ExternalIcon />
                </span>
              </a>

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
                  placeholder={
                    initial.hasKey ? "•••••••• (saved — leave blank to keep)" : selected.keyHint
                  }
                  className={inputClass}
                />
                <span className="mt-1.5 block text-xs text-(--muted)">
                  Encrypted with AES-256 before it&rsquo;s stored. Never logged or sent back
                  to the browser.
                </span>
              </label>
            </>
          )}

          <button className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
            Save settings
          </button>
        </form>
      </div>

      {/* Provider directory — grab a key from any provider */}
      {tier === "byok" && (
        <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">
            Where to get an API key
          </h2>
          <ul className="mt-4 space-y-2.5">
            {PROVIDERS.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--ink)">{p.label}</p>
                  <p className="truncate text-xs text-(--muted)">{p.blurb}</p>
                </div>
                <a
                  href={p.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-xs font-semibold text-(--ink) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
                >
                  Get key <ExternalIcon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
