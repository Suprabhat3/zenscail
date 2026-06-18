import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isActiveStatus } from "@/lib/subscription";
import { getChatModelOptions } from "@/lib/ai/registry";
import { getAppIdentityForUser } from "@/lib/identity";
import { AppNav } from "@/components/app/AppNav";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { UserMenu } from "@/components/app/UserMenu";
import { PlanBadge } from "@/components/app/PlanBadge";
import { KeyboardShortcuts } from "@/components/shortcuts/KeyboardShortcuts";
import { LiveUpdates } from "@/components/realtime/LiveUpdates";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatDock } from "@/components/chat/ChatDock";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { CommandProvider } from "@/components/command/CommandProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { QuickAddBar } from "@/components/command/QuickAddBar";
import { ToastProvider } from "@/components/ui/Toast";
import { SnoozeHotkeyBridge } from "@/components/mail/SnoozeHotkeyBridge";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // First-run gate. Access is granted on capability, not on a stale flag: a user
  // may use the app only once they have a *working* AI path — a stored BYOK key
  // or an active Cloud subscription. Connecting a mailbox alone is not enough
  // (that's only the first onboarding step), so a user who cancels checkout and
  // adds no key is routed back to finish setup instead of slipping through.
  const gateUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      connectedEmail: true,
      aiSettings: { select: { tier: true, encryptedApiKey: true } },
      subscription: { select: { status: true } },
    },
  });

  // Step 1 — a mailbox must be connected before anything else.
  if (!gateUser?.connectedEmail) redirect("/onboarding");

  const tier = gateUser.aiSettings?.tier;
  const hasByokKey = tier === "byok" && Boolean(gateUser.aiSettings?.encryptedApiKey);
  const hasActiveCloud = isActiveStatus(gateUser.subscription?.status);

  // No working AI path yet — send them to the right step to fix it. Users
  // leaning Cloud (chose Cloud, or have a pending/lapsed subscription) go to
  // checkout; everyone else picks an AI option.
  if (!hasByokKey && !hasActiveCloud) {
    const leansCloud = tier === "cloud" || Boolean(gateUser.subscription);
    redirect(leansCloud ? "/onboarding?step=subscribe" : "/onboarding?step=ai");
  }

  const chatOptions = await getChatModelOptions(session.user.id);

  const identity = await getAppIdentityForUser(session.user.id, session.user);

  // Always-visible plan indicator. Cloud only when the subscription is active;
  // otherwise the user is running on their own key.
  const plan: "cloud" | "byok" = hasActiveCloud ? "cloud" : "byok";

  return (
    <ChatProvider>
      <CommandProvider>
      <ToastProvider>
      <div className="flex min-h-screen flex-col bg-(--bg) text-(--ink)">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-(--line-soft) bg-(--bg)/85 px-4 py-3 backdrop-blur sm:px-6">
          <AppNav />
          <QuickAddBar />
          <div className="flex items-center gap-2 sm:gap-3">
            <PlanBadge plan={plan} />
            <ChatLauncher />
            <UserMenu
              name={identity.displayName}
              email={identity.primaryEmail}
              loginEmail={identity.mismatch ? identity.loginEmail : undefined}
              image={identity.image}
            />
          </div>
        </header>
        {identity.mismatch && (
          <div className="border-b border-(--gold)/30 bg-[#FBF3E3] px-4 py-2 text-center text-xs text-[#7A5414] sm:px-6">
            Managing the{" "}
            <span className="font-semibold">{identity.connectedEmail}</span>{" "}
            mailbox — signed in as {identity.loginEmail}.{" "}
            <Link href="/connect" className="font-semibold underline hover:text-[#5C3F0F]">
              Switch account
            </Link>
          </div>
        )}
        <main className="zs-app-main flex-1">{children}</main>
        <MobileTabBar />
        <KeyboardShortcuts />
        <SnoozeHotkeyBridge />
        <CommandPalette />
        <LiveUpdates />
        <ChatDock
          tier={chatOptions.tier}
          provider={chatOptions.provider}
          defaultModel={chatOptions.defaultModel}
          models={chatOptions.models}
        />
      </div>
      </ToastProvider>
      </CommandProvider>
    </ChatProvider>
  );
}
