import "server-only";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";

/** Hard-coded admin access — no role field on User. */
export const ADMIN_EMAIL = "sdk26150@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/** For admin pages/actions — 404 for everyone else (route stays hidden). */
export async function requireAdmin() {
  const session = await getSession();
  if (!session || !isAdminEmail(session.user.email)) notFound();
  return session;
}

/** Admin-granted Cloud subscriptions use this Razorpay id prefix. */
export function adminGrantSubscriptionId(userId: string): string {
  return `admin_grant_${userId}`;
}

export function isAdminGrantSubscriptionId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("admin_grant_"));
}
