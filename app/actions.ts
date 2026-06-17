"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type WaitlistState = {
  status: "idle" | "success" | "already" | "error";
  title?: string;
  message?: string;
};

// Slightly stricter than the shared email regex: requires a 2+ char TLD.
const WaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/),
});

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const parsed = WaitlistSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  const { email } = parsed.data;

  try {
    const existing = await prisma.waitlist.findUnique({ where: { email } });
    if (existing) {
      return {
        status: "already",
        title: "You’re already with us!",
        message:
          "This email is already on our list — no need to sign up twice. Just sit tight, we’re busy building the best version of ZenScail for you.",
      };
    }
    await prisma.waitlist.create({ data: { email } });
  } catch (err) {
    console.error("waitlist signup failed:", err);
    return {
      status: "error",
      message: "Something went wrong on our end — please try again.",
    };
  }

  return {
    status: "success",
    title: "You’re on the list — see you at sunrise.",
    message:
      "Thank you for registering with us! We’ll notify you the moment we go live — great things are coming soon.",
  };
}
