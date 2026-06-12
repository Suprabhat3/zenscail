import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — ZenScail" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  const session = await getSession();
  if (session) redirect(next && next.startsWith("/") ? next : "/mail");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen bg-neutral-950 text-neutral-100">
      {/* Branding panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-neutral-800 bg-neutral-900 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl text-neutral-50">
          <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="23.5" cy="7.5" r="3.4" fill="#f59e0b" />
          </svg>
          ZenScail
        </Link>
        <div>
          <h2 className="max-w-md font-serif text-4xl leading-tight text-neutral-50">
            Your day, already <em className="text-amber-400">sorted.</em>
          </h2>
          <p className="mt-4 max-w-md text-neutral-400">
            One calm place for your inbox and calendar. AI triage, instant
            scheduling, and an assistant that actually does the work.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-neutral-300">
            {[
              "Read, reply and triage Gmail without the noise",
              "See your week and send invites in two clicks",
              "Ask the assistant — “book us 30 minutes next Thursday”",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-600">
          © {new Date().getFullYear()} ZenScail
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full border border-neutral-800"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full border border-neutral-800"
        />
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 font-serif text-xl text-neutral-50 lg:hidden"
        >
          <svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="23.5" cy="7.5" r="3.4" fill="#f59e0b" />
          </svg>
          ZenScail
        </Link>
        <LoginForm
          googleEnabled={googleEnabled}
          initialMode={mode === "signup" ? "signup" : "signin"}
        />
        <Link href="/" className="mt-8 text-sm text-neutral-500 hover:text-neutral-300">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
