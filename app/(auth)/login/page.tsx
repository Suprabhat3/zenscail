import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandingPanel } from "@/components/auth/BrandingPanel";

export const metadata = { title: "Sign in — ZenScail" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  const session = await getSession();
  if (session) redirect(next && next.startsWith("/") ? next : "/dashboard");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen bg-(--bg) text-(--ink)">
      <BrandingPanel />

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 font-serif text-xl text-(--ink) lg:hidden"
        >
          <Image src="/logo.png" alt="ZenScail" width={29} height={26} />
          ZenScail
        </Link>
        <LoginForm
          googleEnabled={googleEnabled}
          initialMode={mode === "signup" ? "signup" : "signin"}
        />
        <Link href="/" className="mt-8 text-sm text-(--muted) transition hover:text-(--ink)">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
