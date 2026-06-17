import Link from "next/link";

/**
 * Small always-visible plan indicator in the app header, linking to Billing.
 * `cloud` = active Cloud subscription; `byok` = running on the user's own key.
 */
export function PlanBadge({ plan }: { plan: "cloud" | "byok" }) {
  if (plan === "cloud") {
    return (
      <Link
        href="/settings/billing"
        title="ZenScail Cloud — manage billing"
        className="hidden items-center gap-1.5 rounded-full border border-(--accent)/30 bg-(--accent-soft) px-3 py-1 text-xs font-semibold text-(--accent-deep) transition hover:border-(--accent)/60 sm:inline-flex"
      >
        <span aria-hidden="true">✦</span>
        Cloud
      </Link>
    );
  }
  return (
    <Link
      href="/settings/billing"
      title="Using your own API key — manage billing"
      className="hidden items-center gap-1.5 rounded-full border border-(--line) px-3 py-1 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) sm:inline-flex"
    >
      Your key
    </Link>
  );
}
