"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROVIDERS, MODELS, PROVIDER_BY_ID, type AiProvider } from "@/lib/ai/models";
import { CLOUD_PLAN } from "@/lib/plan";
import { finishByok } from "@/app/onboarding/actions";

const inputClass =
  "mt-1 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";

export function AiChoiceStep({ keyError }: { keyError?: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<"cloud" | "byok" | null>(null);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div>
      <h1 className="text-center font-serif text-3xl font-normal tracking-tight text-(--ink)">
        How should ZenScail think?
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-(--ink-soft)">
        Pick the AI that powers your brief, priorities, and chat. You&apos;ll need one
        of these to use ZenScail.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* Cloud */}
        <button
          type="button"
          onClick={() => setChoice("cloud")}
          className={`rounded-2xl border p-5 text-left transition ${
            choice === "cloud"
              ? "border-(--accent)/60 bg-(--accent-soft) shadow-(--shadow-card)"
              : "border-(--line-soft) bg-(--paper) hover:border-(--line)"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-(--ink)">ZenScail Cloud</span>
            <span className="rounded-full bg-(--accent) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {CLOUD_PLAN.discountPct}% off
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-(--ink)">
              ₹{CLOUD_PLAN.price}
            </span>
            <span className="text-sm text-(--muted) line-through">
              ₹{CLOUD_PLAN.listPrice}
            </span>
            <span className="text-xs text-(--muted)">/ month</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-(--ink-soft)">
            We run the best models for you — no API key, no setup. Just sign in and go.
          </p>
        </button>

        {/* BYOK */}
        <button
          type="button"
          onClick={() => setChoice("byok")}
          className={`rounded-2xl border p-5 text-left transition ${
            choice === "byok"
              ? "border-(--accent)/60 bg-(--accent-soft) shadow-(--shadow-card)"
              : "border-(--line-soft) bg-(--paper) hover:border-(--line)"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-(--ink)">Bring your own key</span>
            <span className="rounded-full bg-(--bg-deep) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-(--muted)">
              Free
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-(--ink)">₹0</span>
            <span className="text-xs text-(--muted)">/ month</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-(--ink-soft)">
            Use your own OpenAI, Anthropic, Google, or Groq key. You pay your provider
            directly.
          </p>
        </button>
      </div>

      {/* Cloud → go to subscribe */}
      {choice === "cloud" && (
        <button
          type="button"
          onClick={() => router.push("/onboarding?step=subscribe")}
          className="mt-6 w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
        >
          Continue to payment →
        </button>
      )}

      {/* BYOK → inline key entry */}
      {choice === "byok" && (
        <form
          action={finishByok}
          onSubmit={() => setSubmitting(true)}
          className="mt-6 space-y-4 rounded-2xl border border-(--line-soft) bg-(--paper) p-5 shadow-(--shadow-card)"
        >
          {keyError && (
            <p className="rounded-xl border border-(--accent)/30 bg-(--accent-soft) px-4 py-2.5 text-sm text-(--accent-deep)">
              That didn&apos;t work — please paste a valid API key.
            </p>
          )}
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

          <a
            href={PROVIDER_BY_ID[provider].keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-2.5 text-sm transition hover:border-(--accent)/50 hover:bg-(--accent-soft)"
          >
            <span className="text-(--ink-soft)">
              Need a key? Get one from{" "}
              <span className="font-semibold text-(--ink)">
                {PROVIDER_BY_ID[provider].label}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-(--accent-deep)">Open ↗</span>
          </a>

          <label className="block text-sm font-medium text-(--ink)">
            Model
            <select name="model" className={inputClass}>
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
              placeholder={PROVIDER_BY_ID[provider].keyHint}
              required
              className={inputClass}
            />
            <span className="mt-1.5 block text-xs text-(--muted)">
              Encrypted with AES-256 before it&rsquo;s stored. Never sent back to the
              browser. Editable later in Settings → AI.
            </span>
          </label>

          <button
            disabled={submitting}
            className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Finish setup →"}
          </button>
        </form>
      )}
    </div>
  );
}
