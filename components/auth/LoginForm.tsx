"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/mail";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
    setPending(false);
    if (result.error) {
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
    <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
      <h1 className="font-serif text-2xl text-neutral-50">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        {mode === "signin"
          ? "Sign in to your ZenScail workspace."
          : "A calmer inbox is a minute away."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
          />
        )}
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:opacity-50"
        >
          {pending ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {googleEnabled && (
        <button
          onClick={handleGoogle}
          className="mt-3 w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      )}

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 w-full text-center text-sm text-neutral-400 hover:text-neutral-200"
      >
        {mode === "signin"
          ? "No account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
