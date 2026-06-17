"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mintSlug } from "@/lib/booking";
import { clampedInt, parseFormData } from "@/lib/validation";

const CreateBookingLinkSchema = z
  .object({
    title: z
      .string()
      .optional()
      .transform((s) => s?.trim() || "Meeting"),
    durationMins: clampedInt(30, 5, 480),
    windowDays: clampedInt(14, 1, 60),
    hoursStart: clampedInt(9, 0, 23),
    hoursEnd: clampedInt(17, 0, 24),
    timezone: z
      .string()
      .optional()
      .transform((s) => s?.trim() || "UTC"),
  })
  // End hour must sit at least one hour past the start.
  .transform((v) => ({ ...v, hoursEnd: Math.max(v.hoursStart + 1, v.hoursEnd) }));

const BookingLinkIdSchema = z.coerce.number().int().positive();

export async function createBookingLink(formData: FormData): Promise<{ slug: string }> {
  const session = await requireSession();

  const { title, durationMins, windowDays, hoursStart, hoursEnd, timezone } =
    parseFormData(formData, CreateBookingLinkSchema);

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
  const linkId = BookingLinkIdSchema.parse(id);
  const isActive = z.boolean().parse(active);
  const session = await requireSession();
  await prisma.bookingLink.updateMany({
    where: { id: linkId, userId: session.user.id },
    data: { active: isActive },
  });
  revalidatePath("/calendar/links");
}

export async function deleteBookingLink(id: number) {
  const linkId = BookingLinkIdSchema.parse(id);
  const session = await requireSession();
  await prisma.bookingLink.deleteMany({ where: { id: linkId, userId: session.user.id } });
  revalidatePath("/calendar/links");
}
