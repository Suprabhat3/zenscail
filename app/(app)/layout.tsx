import { requireSession } from "@/lib/session";
import { getChatModelOptions } from "@/lib/ai/registry";
import { AppNav } from "@/components/app/AppNav";
import { UserMenu } from "@/components/app/UserMenu";
import { KeyboardShortcuts } from "@/components/shortcuts/KeyboardShortcuts";
import { LiveUpdates } from "@/components/realtime/LiveUpdates";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatDock } from "@/components/chat/ChatDock";
import { ChatLauncher } from "@/components/chat/ChatLauncher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const chatOptions = await getChatModelOptions(session.user.id);

  return (
    <ChatProvider>
      <div className="flex min-h-screen flex-col bg-(--bg) text-(--ink)">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-(--line-soft) bg-(--bg)/85 px-6 py-3 backdrop-blur">
          <AppNav />
          <div className="flex items-center gap-3">
            <ChatLauncher />
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <KeyboardShortcuts />
        <LiveUpdates />
        <ChatDock
          tier={chatOptions.tier}
          provider={chatOptions.provider}
          defaultModel={chatOptions.defaultModel}
          models={chatOptions.models}
        />
      </div>
    </ChatProvider>
  );
}
