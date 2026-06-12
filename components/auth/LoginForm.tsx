"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 transition focus:border-amber-400/70 focus:outline-none focus:ring-1 focus:ring-amber-400/40";

export function LoginForm({
  googleEnabled,
  initialMode = "signin",
}: {
  googleEnabled: boolean;
  initialMode?: "signin" | "signup";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/mail";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result =
      mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    router.push(next);
  }

  async function handleGoogle() {
    setError(null);
    await authClient.signIn.social({ provider: "google", callbackURL: next });
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl text-neutral-50">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        {mode === "signin"
          ? "Sign in to your ZenScail workspace."
          : "A calmer inbox is a minute away. Free to start."}
      </p>

      {googleEnabled && (
        <>
          <button
            onClick={handleGoogle}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs text-neutral-600">
            <span className="h-px flex-1 bg-neutral-800" />
            or with email
            <span className="h-px flex-1 bg-neutral-800" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className={`space-y-4 ${googleEnabled ? "" : "mt-6"}`}>
        {mode === "signup" && (
          <label className="block text-sm font-medium text-neutral-300">
            Name
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="block text-sm font-medium text-neutral-300">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-300">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-amber-400 px-3 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300 disabled:opacity-50"
        >
          {pending
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-400">
        {mode === "signin" ? "No account yet? " : "Already have an account? "}
        <button
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="font-medium text-amber-400 hover:text-amber-300"
        >
          {mode === "signin" ? "Sign up free" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
