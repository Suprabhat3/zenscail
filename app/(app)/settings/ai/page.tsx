import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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

  const bannerKey = saved ? "saved" : test ? `test-${test}` : error ? `error-${error}` : null;
  const banner = bannerKey ? banners[bannerKey] : null;

  return (
    <div>
      <p className="text-sm text-neutral-400">
        Choose the model that powers chat and email priority filtering.
      </p>

      {banner && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "ok"
              ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
              : "border-red-900/60 bg-red-950/40 text-red-300"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="mt-6 p-5">
        <AiSettingsForm
          action={saveAiSettings}
          initial={{
            tier: settings?.tier === "byok" ? "byok" : "cloud",
            provider: (settings?.provider as AiProvider | null) ?? undefined,
            model: settings?.model ?? undefined,
            hasKey: Boolean(settings?.encryptedApiKey),
          }}
        />
      </div>

      {settings?.tier === "byok" && settings.encryptedApiKey && (
        <form action={testAiKey} className="mt-4">
          <button className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
            Test API key
          </button>
        </form>
      )}
    </div>
  );
}
