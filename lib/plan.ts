// Display pricing for the ZenScail Cloud plan. Plain constants (no server-only)
// so both client UI and server code can import them. The actual amount charged
// is governed by the Razorpay Plan (RAZORPAY_PLAN_ID); keep these in sync with it.
export const CLOUD_PLAN = {
  currency: "INR",
  /** List price before the launch discount, in major units. */
  listPrice: 999,
  /** What the customer actually pays per month, in major units (25% off). */
  price: 749,
  discountPct: 25,
  interval: "month" as const,
} as const;
