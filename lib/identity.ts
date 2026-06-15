import "server-only";

import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { getConnectedAddress } from "@/lib/gmail";
import { requireSession } from "@/lib/session";

/**
 * Resolve and persist the real Gmail address connected via Corsair. The app
 * login (`user.email`) and the connected mailbox can differ — this records the
 * mailbox the user is actually reading so the UI can present it as the primary
 * identity. Best-effort: never throws, returns the latest known value.
 */
export async function syncConnectedEmail(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  try {
    const connected = await getConnectedAddress(corsairTenant(tenantId));
    if (!connected) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { connectedEmail: true },
    });
    if (user?.connectedEmail !== connected) {
      await prisma.user.update({
        where: { id: userId },
        data: { connectedEmail: connected },
      });
    }
    return connected;
  } catch (err) {
    console.warn("syncConnectedEmail failed:", err);
    return null;
  }
}

export type AppIdentity = {
  /** Primary identity shown in the UI — the connected mailbox when known. */
  primaryEmail: string;
  /** The app-login email (Better Auth account). */
  loginEmail: string;
  displayName: string;
  image?: string | null;
  /** True when the connected mailbox differs from the login email. */
  mismatch: boolean;
  connectedEmail: string | null;
};

/** Build the display identity from a session user + stored connectedEmail. */
export function resolveIdentity(user: {
  name: string;
  email: string;
  image?: string | null;
  connectedEmail?: string | null;
}): AppIdentity {
  const connected = user.connectedEmail ?? null;
  const mismatch = Boolean(
    connected && connected.toLowerCase() !== user.email.toLowerCase(),
  );
  return {
    primaryEmail: connected ?? user.email,
    loginEmail: user.email,
    displayName: user.name,
    image: user.image,
    mismatch,
    connectedEmail: connected,
  };
}

/** Load connectedEmail from the DB and build the display identity for a user. */
export async function getAppIdentityForUser(
  userId: string,
  user: { name: string; email: string; image?: string | null },
): Promise<AppIdentity> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { connectedEmail: true },
  });
  return resolveIdentity({ ...user, connectedEmail: dbUser?.connectedEmail });
}

/** Signed-in session plus the resolved mailbox identity. */
export async function requireAppIdentity() {
  const session = await requireSession();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  return { session, identity };
}

/** Email addresses that count as the user's own for inbox logic. */
export function myAddressSet(identity: AppIdentity): Set<string> {
  return new Set(
    [identity.loginEmail, identity.connectedEmail]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase()),
  );
}

/** Whether a raw From/Reply-To header value is one of the user's addresses. */
export function isFromMe(fromHeader: string, identity: AppIdentity): boolean {
  const lower = fromHeader.toLowerCase();
  return [...myAddressSet(identity)].some((addr) => lower.includes(addr));
}

/** System-prompt line for AI features — mailbox first, login email when it differs. */
export function mailboxContextLine(identity: AppIdentity): string {
  if (identity.mismatch) {
    return `The user's connected Gmail mailbox is ${identity.primaryEmail}; their ZenScail login email is ${identity.loginEmail}; their name is ${identity.displayName}.`;
  }
  return `The user's email address is ${identity.primaryEmail}; their name is ${identity.displayName}.`;
}
