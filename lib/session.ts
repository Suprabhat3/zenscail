import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For pages/actions inside the (app) group — redirects to /login if signed out. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
