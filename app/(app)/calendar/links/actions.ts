"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mintSlug } from "@/lib/booking";

function clampInt(raw: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function createBookingLink(formData: FormData): Promise<{ slug: string }> {
  const session = await requireSession();

  const title = String(formData.get("title") ?? "").trim() || "Meeting";
  const durationMins = clampInt(formData.get("durationMins"), 30, 5, 480);
  const windowDays = clampInt(formData.get("windowDays"), 14, 1, 60);
  const hoursStart = clampInt(formData.get("hoursStart"), 9, 0, 23);
  const hoursEnd = clampInt(formData.get("hoursEnd"), 17, hoursStart + 1, 24);
  const timezone =
    String(formData.get("timezone") ?? "").trim() || "UTC";

  const row = await prisma.bookingLink.create({
    data: {
      slug: mintSlug(),
      userId: session.user.id,
      title,
      durationMins,
      windowDays,
      hoursStart,
      hoursEnd,
      timezone,
    },
  });
  revalidatePath("/calendar/links");
  return { slug: row.slug };
}

export async function setBookingLinkActive(id: number, active: boolean) {
  const session = await requireSession();
  await prisma.bookingLink.updateMany({
    where: { id, userId: session.user.id },
    data: { active },
  });
  revalidatePath("/calendar/links");
}

export async function deleteBookingLink(id: number) {
  const session = await requireSession();
  await prisma.bookingLink.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/calendar/links");
}
