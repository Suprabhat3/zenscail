import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { syncConnectedEmail } from "@/lib/identity";
import { razorpayConfigured } from "@/lib/razorpay";
import { isActiveStatus } from "@/lib/subscription";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ConnectStep } from "@/components/onboarding/ConnectStep";
import { AiChoiceStep } from "@/components/onboarding/AiChoiceStep";
import { SubscribeStep } from "@/components/onboarding/SubscribeStep";

export const dynamic = "force-dynamic";

const PLUGINS = [
  { id: "gmail", label: "Gmail", probe: "gmail.api.labels.list" },
  { id: "googlecalendar", label: "Google Calendar", probe: "googlecalendar.api.events.getMany" },
] as const;

type Step = "connect" | "ai" | "subscribe";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { step, error } = await searchParams;
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      onboardedAt: true,
      aiSettings: { select: { tier: true } },
      subscription: { select: { status: true } },
    },
  });

  // A Cloud user whose subscription lapsed is sent here to re-activate — they're
  // onboarded but currently locked out, so don't bounce them to /dashboard.
  const reactivate =
    Boolean(user?.onboardedAt) &&
    user?.aiSettings?.tier === "cloud" &&
    !isActiveStatus(user?.subscription?.status);

  // Already finished and has access — nothing to do here.
  if (user?.onboardedAt && !reactivate) redirect("/dashboard");

  // Probe Google connection status (only if Corsair is configured).
  const configured = Boolean(
    process.env.CORSAIR_DEV_KEY && process.env.CORSAIR_INSTANCE_ID,
  );

  let statuses: { id: string; label: string; connected: boolean }[] = PLUGINS.map(
    (p) => ({ id: p.id, label: p.label, connected: false }),
  );
  let connectedEmail: string | null = null;

  if (configured) {
    const tenantId = await ensureCorsairTenant(session.user.id);
    const t = corsairTenant(tenantId);
    statuses = await Promise.all(
      PLUGINS.map(async (p) => ({
        id: p.id,
        label: p.label,
        connected: (await t.run(p.probe)).success,
      })),
    );
    if (statuses.find((s) => s.id === "gmail")?.connected) {
      connectedEmail = await syncConnectedEmail(session.user.id, tenantId);
    }
  }

  const allConnected = statuses.every((s) => s.connected);
  const connectedOrSkippable = allConnected || !configured;

  // Resolve the step — connecting is mandatory before anything else. A
  // re-activating Cloud user goes straight to the subscribe step.
  let current: Step = "connect";
  if (reactivate) {
    current = "subscribe";
  } else if (connectedOrSkippable) {
    if (step === "subscribe") current = "subscribe";
    else if (step === "ai") current = "ai";
    else current = "connect";
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <OnboardingShell
      current={current}
      showSubscribe={current === "subscribe"}
      greeting={firstName ? `Welcome, ${firstName}` : "Welcome"}
    >
      {current === "connect" && (
        <ConnectStep
          statuses={statuses}
          allConnected={allConnected}
          configured={configured}
          connectedEmail={connectedEmail}
        />
      )}
      {current === "ai" && <AiChoiceStep keyError={error === "key"} />}
      {current === "subscribe" && (
        <SubscribeStep
          configured={razorpayConfigured()}
          reactivate={reactivate}
          userName={user?.name ?? undefined}
          userEmail={user?.email ?? undefined}
        />
      )}
    </OnboardingShell>
  );
}
