import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";
import { AiSettingsForm } from "@/components/settings/AiSettingsForm";
import { saveAiSettings, testAiKey } from "./actions";
import type { AiProvider } from "@/lib/ai/models";

export const metadata = { title: "AI settings — ZenScail" };

const banners: Record<string, { text: string; tone: "ok" | "err" }> = {
  saved: { text: "Settings saved.", tone: "ok" },
  "test-ok": { text: "API key works.", tone: "ok" },
  "test-fail": { text: "API key test failed — check the key and model.", tone: "err" },
  "test-missing": { text: "Save a BYOK provider, model and key first.", tone: "err" },
  "error-key-required": { text: "An API key is required for BYOK.", tone: "err" },
};

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; test?: string; error?: string }>;
}) {
  const { saved, test, error } = await searchParams;
  const session = await requireSession();
  const settings = await prisma.userAiSettings.findUnique({
    where: { userId: session.user.id },
  });
  const cloudActive = await hasActiveSubscription(session.user.id);

  const bannerKey = saved ? "saved" : test ? `test-${test}` : error ? `error-${error}` : null;
  const banner = bannerKey ? banners[bannerKey] : null;

  const isByok = settings?.tier === "byok";

  return (
    <div className="space-y-5">
      <p className="text-sm text-(--ink-soft)">
        Choose the model that powers your daily brief, inbox priorities, and chat.
      </p>

      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "ok"
              ? "border-[#CBD8BC] bg-[#EFF4E8] text-[#44532F]"
              : "border-(--accent)/30 bg-(--accent-soft) text-(--accent-deep)"
          }`}
        >
          {banner.text}
        </div>
      )}

      <AiSettingsForm
        action={saveAiSettings}
        cloudActive={cloudActive}
        initial={{
          tier: isByok ? "byok" : "cloud",
          provider: (settings?.provider as AiProvider | null) ?? undefined,
          model: settings?.model ?? undefined,
          hasKey: Boolean(settings?.encryptedApiKey),
        }}
      />

      {isByok && settings?.encryptedApiKey && (
        <form action={testAiKey}>
          <button className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)">
            Test API key
          </button>
        </form>
      )}
    </div>
  );
}
