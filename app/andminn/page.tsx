import { isAdminGrantSubscriptionId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isActiveStatus } from "@/lib/subscription";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function AdminPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      connectedEmail: true,
      onboardedAt: true,
      createdAt: true,
      aiSettings: {
        select: {
          tier: true,
          provider: true,
          model: true,
          encryptedApiKey: true,
        },
      },
      subscription: {
        select: {
          status: true,
          currentEnd: true,
          razorpaySubscriptionId: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  const rows = users.map((user) => {
    const tier: "cloud" | "byok" = user.aiSettings?.tier === "byok" ? "byok" : "cloud";
    const hasByokKey = tier === "byok" && Boolean(user.aiSettings?.encryptedApiKey);
    const cloudActive = isActiveStatus(user.subscription?.status);
    const adminGrant = isAdminGrantSubscriptionId(user.subscription?.razorpaySubscriptionId);
    const canUseApp = hasByokKey || cloudActive;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      connectedEmail: user.connectedEmail,
      onboardedAt: user.onboardedAt,
      createdAt: user.createdAt,
      tier,
      hasByokKey,
      provider: user.aiSettings?.provider,
      model: user.aiSettings?.model,
      cloudActive,
      adminGrant,
      subscriptionStatus: user.subscription?.status ?? null,
      currentEnd: user.subscription?.currentEnd ?? null,
      cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd ?? false,
      canUseApp,
    };
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--ink-soft)">
        View every account, see how they run AI (Cloud vs bring-your-own-key), and grant
        Cloud access without Razorpay checkout.
      </p>

      <div className="overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-(--line-soft) bg-(--bg-deep)/60 text-xs uppercase tracking-wider text-(--muted)">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">AI tier</th>
                <th className="px-4 py-3 font-semibold">Cloud sub</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-(--line-soft) last:border-b-0 align-top"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-(--ink)">{user.name || "—"}</p>
                    <p className="mt-0.5 text-(--ink-soft)">{user.email}</p>
                    {user.connectedEmail && user.connectedEmail !== user.email && (
                      <p className="mt-1 text-xs text-(--muted)">
                        Mailbox: {user.connectedEmail}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-(--muted)">
                      Joined {formatDate(user.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <TierBadge tier={user.tier} />
                    {user.tier === "byok" && (
                      <div className="mt-2 space-y-0.5 text-xs text-(--ink-soft)">
                        <p>
                          Key:{" "}
                          <span className={user.hasByokKey ? "text-[#44532F]" : "text-(--accent-deep)"}>
                            {user.hasByokKey ? "stored" : "missing"}
                          </span>
                        </p>
                        {user.provider && user.model && (
                          <p>
                            {user.provider} · {user.model}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {user.subscriptionStatus ? (
                      <div className="space-y-1">
                        <CloudBadge
                          active={user.cloudActive}
                          adminGrant={user.adminGrant}
                          cancelling={user.cancelAtPeriodEnd}
                        />
                        <p className="text-xs text-(--muted) capitalize">
                          {user.subscriptionStatus}
                        </p>
                        {user.currentEnd && (
                          <p className="text-xs text-(--muted)">
                            {user.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                            {formatDate(user.currentEnd)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-(--muted)">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {user.canUseApp ? (
                      <span className="inline-flex rounded-full bg-[#EFF4E8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#44532F]">
                        Working
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-(--accent-soft) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-(--accent-deep)">
                        Blocked
                      </span>
                    )}
                    {!user.onboardedAt && (
                      <p className="mt-1 text-xs text-(--muted)">Not onboarded</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <AdminUserActions
                      userId={user.id}
                      tier={user.tier}
                      cloudActive={user.cloudActive}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-(--muted)">
        {rows.length} user{rows.length === 1 ? "" : "s"} · Cloud grants last one year and
        skip Razorpay.
      </p>
    </div>
  );
}

function TierBadge({ tier }: { tier: "cloud" | "byok" }) {
  if (tier === "byok") {
    return (
      <span className="inline-flex rounded-full bg-(--bg-deep) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-(--muted)">
        BYOK
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#EFF4E8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#44532F]">
      Cloud
    </span>
  );
}

function CloudBadge({
  active,
  adminGrant,
  cancelling,
}: {
  active: boolean;
  adminGrant: boolean;
  cancelling: boolean;
}) {
  if (active && cancelling) {
    return (
      <span className="inline-flex rounded-full bg-[#FBF3E3] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#7A5414]">
        Cancelling
      </span>
    );
  }
  if (active && adminGrant) {
    return (
      <span className="inline-flex rounded-full bg-[#E8F0FA] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#2E4A6E]">
        Admin grant
      </span>
    );
  }
  if (active) {
    return (
      <span className="inline-flex rounded-full bg-[#EFF4E8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#44532F]">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-(--bg-deep) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-(--muted)">
      Inactive
    </span>
  );
}
