import { requireSession } from "@/lib/session";
import { getBillingState } from "@/lib/subscription";
import { razorpayConfigured } from "@/lib/razorpay";
import { CLOUD_PLAN } from "@/lib/plan";
import { CloudSubscribeButton } from "@/components/billing/CloudSubscribeButton";
import { cancelCloudSubscription, switchToCloudTier, refreshSubscription } from "./actions";

export const metadata = { title: "Billing — ZenScail" };
export const dynamic = "force-dynamic";

const banners: Record<string, { text: string; tone: "ok" | "err" }> = {
  "done-cancelled": {
    text: "Your subscription will stop renewing. You keep Cloud until the date below.",
    tone: "ok",
  },
  "done-switched-cloud": { text: "Switched back to ZenScail Cloud.", tone: "ok" },
  "done-refreshed": { text: "Subscription status refreshed.", tone: "ok" },
  "error-cancel-failed": { text: "Couldn't cancel — please try again.", tone: "err" },
  "error-nothing-to-cancel": { text: "No active subscription to cancel.", tone: "err" },
  "error-no-active-sub": { text: "You need an active subscription to use Cloud.", tone: "err" },
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { done, error } = await searchParams;
  const session = await requireSession();
  const state = await getBillingState(session.user.id);
  const configured = razorpayConfigured();

  const bannerKey = done ? `done-${done}` : error ? `error-${error}` : null;
  const banner = bannerKey ? banners[bannerKey] : null;

  const cloudActive = state.isActive;
  const renewLabel = state.currentEnd ? formatDate(state.currentEnd) : null;
  const daysLeft = state.daysRemaining;

  return (
    <div className="space-y-5">
      <p className="text-sm text-(--ink-soft)">
        Manage your ZenScail Cloud subscription, see your renewal date, or cancel anytime.
      </p>

      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "ok"
              ? "border-[#CBD8BC] bg-[#EFF4E8] text-[#44532F]"
              : "border-(--accent)/30 bg-(--accent-soft) text-(--accent-deep)"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* ── Plan status card ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">
              Current plan
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-serif text-2xl text-(--ink)">
                {cloudActive ? "ZenScail Cloud" : "Bring your own key"}
              </span>
              <StatusBadge cloudActive={cloudActive} cancelling={state.cancelAtPeriodEnd} />
            </div>
            <p className="mt-1 text-sm text-(--ink-soft)">
              {cloudActive
                ? `₹${CLOUD_PLAN.price} / month`
                : "Free — you pay your AI provider directly."}
            </p>
          </div>
          {cloudActive && (
            <div className="shrink-0 text-right">
              <p className="text-xs uppercase tracking-wide text-(--muted)">
                {state.cancelAtPeriodEnd ? "Access ends" : "Renews"}
              </p>
              <p className="text-sm font-semibold text-(--ink)">{renewLabel}</p>
              {daysLeft !== null && (
                <p className="text-xs text-(--muted)">
                  {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                </p>
              )}
            </div>
          )}
        </div>

        {/* Currently on BYOK but Cloud subscription is still live */}
        {cloudActive && state.tier === "byok" && (
          <div className="mt-5 rounded-xl border border-(--gold)/40 bg-[#FBF3E3] px-4 py-3">
            <p className="text-sm font-medium text-[#7A5414]">
              You&rsquo;re using your own API key while your Cloud subscription is active.
            </p>
            <p className="mt-1 text-xs text-[#8A6320]">
              You don&rsquo;t need your own key — switch back to Cloud anytime at no extra
              cost, or cancel Cloud below if you&rsquo;d rather keep using your key.
            </p>
            <form action={switchToCloudTier} className="mt-3">
              <button className="rounded-full bg-(--ink) px-5 py-2 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
                Switch back to Cloud
              </button>
            </form>
          </div>
        )}

        {/* Cancellation scheduled */}
        {cloudActive && state.cancelAtPeriodEnd && (
          <p className="mt-5 rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-3 text-sm text-(--ink-soft)">
            Your subscription won&rsquo;t renew. You&rsquo;ll keep Cloud until{" "}
            <span className="font-semibold text-(--ink)">{renewLabel}</span>, then
            you&rsquo;ll need to resubscribe or add your own API key.
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-(--line-soft) pt-5">
          {cloudActive && !state.cancelAtPeriodEnd && (
            <form action={cancelCloudSubscription}>
              <button className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--accent) hover:text-(--accent-deep)">
                Cancel subscription
              </button>
            </form>
          )}

          {!cloudActive &&
            (configured ? (
              <CloudSubscribeButton
                label={`Upgrade to Cloud — ₹${CLOUD_PLAN.price}/mo`}
                userName={session.user.name ?? undefined}
                userEmail={session.user.email ?? undefined}
              />
            ) : (
              <p className="text-sm text-(--muted)">
                Cloud payments aren&rsquo;t available on this server yet.
              </p>
            ))}

          <form action={refreshSubscription}>
            <button className="rounded-full border border-(--line-soft) px-4 py-2.5 text-xs font-medium text-(--muted) transition hover:border-(--ink) hover:text-(--ink)">
              Refresh status
            </button>
          </form>
        </div>
      </section>

      {/* ── What Cloud gives you ─────────────────────────────────── */}
      {!cloudActive && (
        <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">
            ZenScail Cloud
          </h2>
          <p className="mt-2 text-sm text-(--ink-soft)">
            No API keys, no setup — we run top-tier models tuned for email. Daily brief,
            smart priorities, drafts, and chat, all included.
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-(--ink)">₹{CLOUD_PLAN.price}</span>
            <span className="text-sm text-(--muted) line-through">₹{CLOUD_PLAN.listPrice}</span>
            <span className="text-xs text-(--muted)">/ month · {CLOUD_PLAN.discountPct}% off in beta</span>
          </div>
        </section>
      )}

      <p className="text-xs text-(--muted)">
        Payments are processed securely by Razorpay. Prefer to use your own provider key?
        Set it up under{" "}
        <a href="/settings/ai" className="font-medium text-(--ink) underline">
          AI models
        </a>
        .
      </p>
    </div>
  );
}

function StatusBadge({
  cloudActive,
  cancelling,
}: {
  cloudActive: boolean;
  cancelling: boolean;
}) {
  if (cloudActive && cancelling) {
    return (
      <span className="rounded-full bg-[#FBF3E3] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#7A5414]">
        Cancelling
      </span>
    );
  }
  if (cloudActive) {
    return (
      <span className="rounded-full bg-[#EFF4E8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#44532F]">
        Active
      </span>
    );
  }
  return (
    <span className="rounded-full bg-(--bg-deep) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-(--muted)">
      Free
    </span>
  );
}
