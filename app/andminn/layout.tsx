import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-(--bg) text-(--ink)">
      <header className="sticky top-0 z-40 border-b border-(--line-soft) bg-(--bg)/85 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-(--muted)">
              Internal
            </p>
            <h1 className="font-serif text-xl text-(--ink)">User management</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-(--line) px-4 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
          >
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
