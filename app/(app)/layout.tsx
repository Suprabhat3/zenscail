import { requireSession } from "@/lib/session";
import { AppNav } from "@/components/app/AppNav";
import { UserMenu } from "@/components/app/UserMenu";
import { KeyboardShortcuts } from "@/components/shortcuts/KeyboardShortcuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col bg-(--bg) text-(--ink)">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-(--line-soft) bg-(--bg)/85 px-6 py-3 backdrop-blur">
        <AppNav />
        <UserMenu
          name={session.user.name}
          email={session.user.email}
          image={session.user.image}
        />
      </header>
      <main className="flex-1">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
