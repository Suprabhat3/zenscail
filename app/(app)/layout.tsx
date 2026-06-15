import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getChatModelOptions } from "@/lib/ai/registry";
import { getAppIdentityForUser } from "@/lib/identity";
import { AppNav } from "@/components/app/AppNav";
import { UserMenu } from "@/components/app/UserMenu";
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
  const chatOptions = await getChatModelOptions(session.user.id);

  const identity = await getAppIdentityForUser(session.user.id, session.user);

  return (
    <ChatProvider>
      <CommandProvider>
      <ToastProvider>
      <div className="flex min-h-screen flex-col bg-(--bg) text-(--ink)">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-(--line-soft) bg-(--bg)/85 px-6 py-3 backdrop-blur">
          <AppNav />
          <QuickAddBar />
          <div className="flex items-center gap-3">
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
          <div className="border-b border-(--gold)/30 bg-[#FBF3E3] px-6 py-2 text-center text-xs text-[#7A5414]">
            Managing the{" "}
            <span className="font-semibold">{identity.connectedEmail}</span>{" "}
            mailbox — signed in as {identity.loginEmail}.{" "}
            <Link href="/connect" className="font-semibold underline hover:text-[#5C3F0F]">
              Switch account
            </Link>
          </div>
        )}
        <main className="flex-1">{children}</main>
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
