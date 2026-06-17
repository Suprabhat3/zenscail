"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLOUD_PLAN } from "@/lib/plan";
import {
  startCloudSubscription,
  verifyCloudSubscription,
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

/**
 * Opens Razorpay Checkout for a Cloud subscription and grants access on success.
 * Reuses the same server actions as onboarding, so the verify path (signature +
 * Razorpay-confirmed status) is identical. Used on the Billing page to upgrade
 * from BYOK or reactivate after a lapse.
 */
export function CloudSubscribeButton({
  label,
  userName,
  userEmail,
  variant = "primary",
}: {
  label: string;
  userName?: string;
  userEmail?: string;
  variant?: "primary" | "ghost";
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
            router.refresh();
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

  const base =
    "rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-(--ink) text-(--bg) hover:bg-(--accent)"
      : "border border-(--line) text-(--ink) hover:border-(--ink)";

  return (
    <div>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className={`${base} ${styles}`}
      >
        {loading ? "Opening checkout…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-(--accent-deep)">{error}</p>}
    </div>
  );
}
