"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLOUD_PLAN } from "@/lib/plan";
import {
  startCloudSubscription,
  verifyCloudSubscription,
  switchToByok,
} from "@/app/onboarding/actions";

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme?: { color?: string };
  prefill?: { name?: string; email?: string };
  handler: (res: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function SubscribeStep({
  configured,
  reactivate = false,
  userName,
  userEmail,
}: {
  configured: boolean;
  /** User is already onboarded on Cloud but lapsed — they're pinned to this step
   *  by the gate, so "use my own key" must switch tiers rather than navigate. */
  reactivate?: boolean;
  userName?: string;
  userEmail?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const ready = await loadCheckoutScript();
      if (!ready || !window.Razorpay) {
        setError("Couldn't reach Razorpay. Check your connection and try again.");
        return;
      }

      const { subscriptionId, keyId } = await startCloudSubscription();

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "ZenScail Cloud",
        description: `Monthly subscription · ₹${CLOUD_PLAN.price}/mo`,
        theme: { color: "#E11D48" },
        prefill: { name: userName, email: userEmail },
        handler: async (res) => {
          const result = await verifyCloudSubscription({
            paymentId: res.razorpay_payment_id,
            subscriptionId: res.razorpay_subscription_id,
            signature: res.razorpay_signature,
          });
          if (result.ok) {
            // Don't navigate here — that would unmount the upgrade celebration
            // before it can play. The CloudCelebration listener (mounted in the
            // onboarding layout) detects the now-active subscription via the
            // server push (with a poll fallback), shows the confetti screen, and
            // routes into /dashboard on dismiss.
          } else {
            setError("We couldn't verify the payment. Contact support if charged.");
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <h1 className="font-serif text-3xl font-normal tracking-tight text-(--ink)">
        Activate ZenScail Cloud
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-(--ink-soft)">
        One subscription, every feature — no API keys to manage.
      </p>

      <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-(--line-soft) bg-(--paper) p-6 text-left shadow-(--shadow-card)">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-(--ink)">Monthly plan</span>
          <span className="rounded-full bg-(--accent) px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {CLOUD_PLAN.discountPct}% off
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-4xl text-(--ink)">₹{CLOUD_PLAN.price}</span>
          <span className="text-base text-(--muted) line-through">
            ₹{CLOUD_PLAN.listPrice}
          </span>
          <span className="text-sm text-(--muted)">/ month</span>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-(--ink-soft)">
          <li>· Daily brief, smart priorities, and chat</li>
          <li>· Top-tier models, fully managed</li>
          <li>· Cancel anytime</li>
        </ul>
      </div>

      {!configured && (
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4 text-left">
          <p className="text-sm font-medium text-[#7A5414]">
            Payments aren&apos;t live on this server yet.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            Razorpay isn&apos;t configured. You can use your own API key instead for now.
          </p>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-sm">
        {configured ? (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
          >
            {loading ? "Opening checkout…" : `Pay ₹${CLOUD_PLAN.price} & activate`}
          </button>
        ) : null}

        {reactivate ? (
          // Onboarded already — navigating to ?step=ai is overridden back to this
          // step, so switch the tier server-side to actually leave Cloud.
          <form action={switchToByok}>
            <button
              type="submit"
              className="mt-3 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-3 text-sm font-semibold text-(--ink) transition hover:border-(--ink)"
            >
              ← Use my own API key instead
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/onboarding?step=ai")}
            className="mt-3 w-full rounded-full border border-(--line) bg-(--paper) px-4 py-3 text-sm font-semibold text-(--ink) transition hover:border-(--ink)"
          >
            ← Use my own API key instead
          </button>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-(--accent-deep)">{error}</p>
        )}
      </div>

      <p className="mx-auto mt-5 max-w-sm text-xs text-(--muted)">
        Secured by Razorpay. We never see your card details.
      </p>
    </div>
  );
}
