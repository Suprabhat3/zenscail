import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/mail" className="font-serif text-lg text-neutral-50">
            ZenScail
          </Link>
          <Link href="/mail" className="text-neutral-400 hover:text-neutral-100">
            Mail
          </Link>
          <Link href="/calendar" className="text-neutral-400 hover:text-neutral-100">
            Calendar
          </Link>
          <Link href="/chat" className="text-neutral-400 hover:text-neutral-100">
            Chat
          </Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/settings/ai" className="text-neutral-400 hover:text-neutral-100">
            Settings
          </Link>
          <span className="text-neutral-500">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
