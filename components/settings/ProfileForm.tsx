"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-400 focus:outline-none disabled:opacity-60";

type Notice = { tone: "ok" | "err"; text: string } | null;

export function ProfileForm({
  name: initialName,
  email,
  createdAt,
}: {
  name: string;
  email: string;
  createdAt?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [savingPw, setSavingPw] = useState(false);

  const joined = createdAt ? new Date(createdAt) : null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameNotice(null);
    setSavingName(true);
    const result = await authClient.updateUser({ name: name.trim() });
    setSavingName(false);
    if (result.error) {
      setNameNotice({ tone: "err", text: result.error.message ?? "Could not update name" });
      return;
    }
    setNameNotice({ tone: "ok", text: "Name updated." });
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwNotice(null);
    setSavingPw(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSavingPw(false);
    if (result.error) {
      setPwNotice({ tone: "err", text: result.error.message ?? "Could not change password" });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPwNotice({ tone: "ok", text: "Password changed. Other sessions were signed out." });
  }

  function NoticeBox({ notice }: { notice: Notice }) {
    if (!notice) return null;
    return (
      <p
        className={`rounded-lg border px-3 py-2 text-sm ${
          notice.tone === "ok"
            ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
            : "border-red-900/60 bg-red-950/40 text-red-300"
        }`}
      >
        {notice.text}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-medium text-neutral-200">Account</h2>
        <form onSubmit={saveName} className="mt-4 space-y-4">
          <label className="block text-sm text-neutral-300">
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-neutral-300">
            Email
            <input type="email" value={email} disabled className={inputClass} />
            <span className="mt-1 block text-xs text-neutral-500">
              Your email is your sign-in identity and can&apos;t be changed here.
            </span>
          </label>
          <NoticeBox notice={nameNotice} />
          <button
            disabled={savingName || name.trim() === initialName.trim() || !name.trim()}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:opacity-50"
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
        {joined && !Number.isNaN(joined.getTime()) && (
          <p className="mt-4 text-xs text-neutral-500">
            Member since {joined.toLocaleDateString([], { month: "long", year: "numeric" })}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-medium text-neutral-200">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <label className="block text-sm text-neutral-300">
            Current password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-neutral-300">
            New password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <NoticeBox notice={pwNotice} />
          <button
            disabled={savingPw || !currentPassword || newPassword.length < 8}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {savingPw ? "Changing…" : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
}
