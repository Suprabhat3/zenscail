"use client";

import { grantCloudAccess, revokeCloudAccess, setUserTier } from "@/app/andminn/actions";
import { SubmitButton } from "@/components/app/SubmitButton";

export function AdminUserActions({
  userId,
  tier,
  cloudActive,
}: {
  userId: string;
  tier: "cloud" | "byok";
  cloudActive: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {!cloudActive && (
        <form action={grantCloudAccess}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton className="rounded-full bg-(--ink) px-3 py-1.5 text-xs font-semibold text-(--bg) transition hover:bg-(--accent)">
            Grant Cloud
          </SubmitButton>
        </form>
      )}

      {cloudActive && tier === "byok" && (
        <form action={setUserTier}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="tier" value="cloud" />
          <SubmitButton className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)">
            Use Cloud tier
          </SubmitButton>
        </form>
      )}

      {cloudActive && tier === "cloud" && (
        <form action={setUserTier}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="tier" value="byok" />
          <SubmitButton className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)">
            Prefer BYOK tier
          </SubmitButton>
        </form>
      )}

      {cloudActive && (
        <form action={revokeCloudAccess}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton className="rounded-full border border-(--accent)/30 px-3 py-1.5 text-xs font-medium text-(--accent-deep) transition hover:border-(--accent)">
            Revoke Cloud
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
