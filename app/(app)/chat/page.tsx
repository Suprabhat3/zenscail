import { requireSession } from "@/lib/session";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const metadata = { title: "Chat — ZenScail" };

export default async function ChatPage() {
  await requireSession();
  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col px-6">
      <ChatPanel />
    </div>
  );
}
