import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BookingLinkForm } from "@/components/calendar/BookingLinkForm";
import { BookingLinkList } from "@/components/calendar/BookingLinkList";

export const metadata = { title: "Booking links — ZenScail" };

export default async function BookingLinksPage() {
  const session = await requireSession();
  const links = await prisma.bookingLink.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      durationMins: true,
      windowDays: true,
      hoursStart: true,
      hoursEnd: true,
      timezone: true,
      active: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/calendar" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to calendar
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-normal tracking-tight text-(--ink)">
        Booking links
      </h1>
      <p className="mt-0.5 text-sm text-(--muted)">
        Share your availability. People pick a free slot and it&rsquo;s added to your calendar with
        them as a guest.
      </p>

      <div className="mt-6">
        <BookingLinkForm />
      </div>

      <h2 className="mt-8 mb-3 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
        Your links
      </h2>
      <BookingLinkList links={links} />
    </div>
  );
}
