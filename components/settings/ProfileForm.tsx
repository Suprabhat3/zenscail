"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "mt-1 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft) disabled:opacity-60";

type Notice = { tone: "ok" | "err"; text: string } | null;

export function ProfileForm({
  name: initialName,
  email,
  connectedMailbox,
  createdAt,
}: {
  name: string;
  email: string;
  connectedMailbox?: string | null;
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
        className={`rounded-xl border px-4 py-2.5 text-sm ${
          notice.tone === "ok"
            ? "border-[#CBD8BC] bg-[#EFF4E8] text-[#44532F]"
            : "border-(--accent)/30 bg-(--accent-soft) text-(--accent-deep)"
        }`}
      >
        {notice.text}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Account section */}
      <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">Account</h2>
        <form onSubmit={saveName} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-(--ink)">
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-(--ink)">
            Email
            <input type="email" value={email} disabled className={inputClass} />
            <span className="mt-1.5 block text-xs text-(--muted)">
              Your sign-in email for ZenScail. Manage your Gmail connection under Connected accounts.
            </span>
          </label>
          {connectedMailbox && (
            <label className="block text-sm font-medium text-(--ink)">
              Connected mailbox
              <input type="email" value={connectedMailbox} disabled className={inputClass} />
              <span className="mt-1.5 block text-xs text-(--muted)">
                Mail and calendar actions use this Gmail account.
              </span>
            </label>
          )}
          <NoticeBox notice={nameNotice} />
          <button
            disabled={savingName || name.trim() === initialName.trim() || !name.trim()}
            className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-40"
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
        {joined && !Number.isNaN(joined.getTime()) && (
          <p className="mt-5 border-t border-(--line-soft) pt-4 text-xs text-(--muted)">
            Member since {joined.toLocaleDateString([], { month: "long", year: "numeric" })}
          </p>
        )}
      </section>

      {/* Password section */}
      <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">Change password</h2>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-(--ink)">
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
          <label className="block text-sm font-medium text-(--ink)">
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
            className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) disabled:opacity-40"
          >
            {savingPw ? "Changing…" : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
}
