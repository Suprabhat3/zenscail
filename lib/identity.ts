import "server-only";

import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { getConnectedAddress } from "@/lib/gmail";

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
