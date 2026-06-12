"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "mt-1.5 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

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
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <h1 className="font-serif text-3xl font-normal text-(--ink)">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-(--ink-soft)">
        {mode === "signin"
          ? "Sign in to your ZenScail workspace."
          : "A calmer inbox is a minute away. Free to start."}
      </p>

      {googleEnabled && (
        <>
          <button
            onClick={handleGoogle}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-(--line) bg-(--paper) px-3 py-2.5 text-sm font-medium text-(--ink) transition hover:border-(--ink) hover:bg-(--bg-deep)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs text-(--muted)">
            <span className="h-px flex-1 bg-(--line-soft)" />
            or with email
            <span className="h-px flex-1 bg-(--line-soft)" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className={`space-y-4 ${googleEnabled ? "" : "mt-6"}`}>
        {mode === "signup" && (
          <label className="block text-sm font-medium text-(--ink)">
            Name
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="Digital labour"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="block text-sm font-medium text-(--ink)">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="labour@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-(--ink)">
          Password
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-3.5 flex items-center text-(--muted) transition hover:text-(--ink)"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </label>

        {error && (
          <p className="rounded-xl border border-(--accent)/30 bg-(--accent-soft) px-4 py-2.5 text-sm text-(--accent-deep)">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-(--accent) px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep) disabled:opacity-50"
        >
          {pending
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-(--ink-soft)">
        {mode === "signin" ? "No account yet? " : "Already have an account? "}
        <button
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="font-semibold text-(--accent) transition hover:text-(--accent-deep)"
        >
          {mode === "signin" ? "Sign up free" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
