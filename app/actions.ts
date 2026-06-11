"use server";

import { prisma } from "@/lib/prisma";

export type WaitlistState = {
  status: "idle" | "success" | "already" | "error";
  title?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

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
