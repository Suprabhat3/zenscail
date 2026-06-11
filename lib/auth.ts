import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { ensureCorsairTenant } from "@/lib/tenant";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  user: {
    additionalFields: {
      corsairTenantId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Best-effort: ensureCorsairTenant also runs lazily on first use,
          // so a failure here (e.g. Corsair not provisioned yet) is fine.
          try {
            await ensureCorsairTenant(user.id);
          } catch (err) {
            console.warn("Corsair tenant provisioning deferred:", err);
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
