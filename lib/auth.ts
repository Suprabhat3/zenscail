import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { ensureCorsairTenant } from "@/lib/tenant";
import { sendVerificationEmail, sendOnboardingEmail } from "@/lib/email/send";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

/**
 * Send the onboarding email exactly once per user. Guarded by `welcomedAt`
 * so re-verifications / repeat logins never duplicate it.
 */
async function sendWelcomeOnce(user: { id: string; email: string; name?: string | null }) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { welcomedAt: true },
    });
    if (row?.welcomedAt) return;
    await prisma.user.update({
      where: { id: user.id },
      data: { welcomedAt: new Date() },
    });
    await sendOnboardingEmail({ to: user.email, name: user.name ?? undefined });
  } catch (err) {
    console.warn("Onboarding email skipped:", err);
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Block sign-in until the email is verified (via the 6-digit OTP below).
    requireEmailVerification: true,
  },
  emailVerification: {
    // After OTP verification, log the user straight into the app.
    autoSignInAfterVerification: true,
    // Password users land here once they enter the correct code.
    afterEmailVerification: async (user) => {
      await sendWelcomeOnce(user);
    },
  },
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
      connectedEmail: { type: "string", required: false, input: false },
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
          // Google sign-ups arrive already-verified (Google vouches for the
          // email) — there's no OTP step, so "account created" IS first login.
          // Password sign-ups are unverified here; they get the welcome from
          // afterEmailVerification instead.
          if (user.emailVerified) {
            await sendWelcomeOnce(user);
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60, // 5 minutes
      // Route Better Auth's email verification through the OTP code instead of
      // a magic link, and fire the code automatically on password sign-up.
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "email-verification") return;
        const user = await prisma.user.findUnique({
          where: { email },
          select: { name: true },
        });
        await sendVerificationEmail({ to: email, code: otp, name: user?.name ?? undefined });
      },
    }),
    nextCookies(),
  ],
});
