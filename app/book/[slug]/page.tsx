import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBookingLink, computeOpenSlots } from "@/lib/booking";
import { SlotPicker } from "@/components/booking/SlotPicker";

export const metadata = { title: "Book a time — ZenScail" };
export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await getBookingLink(slug);
  if (!link) notFound();

  // Owner's display name for a personal touch (best-effort).
  const owner = await prisma.user
    .findUnique({ where: { id: link.userId }, select: { name: true } })
    .catch(() => null);

  const days = await computeOpenSlots(link, new Date()).catch(() => []);

  return (
    <div className="min-h-screen bg-(--bg) text-(--ink)">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="flex items-center gap-2 font-serif text-lg text-(--ink)">
          <svg width="24" height="24" viewBox="0 0 30 30" aria-hidden="true">
            <path d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="23.5" cy="7.5" r="3.4" fill="var(--accent)" />
          </svg>
          ZenScail
        </div>

        <h1 className="mt-8 font-serif text-3xl tracking-tight text-(--ink)">{link.title}</h1>
        <p className="mt-1 text-sm text-(--muted)">
          {owner?.name ? `Book ${link.durationMins} minutes with ${owner.name}.` : `Book ${link.durationMins} minutes.`}{" "}
          Times shown in {link.timezone}.
        </p>

        <div className="mt-6">
          <SlotPicker
            slug={link.slug}
            title={link.title}
            durationMins={link.durationMins}
            timezone={link.timezone}
            days={days}
          />
        </div>

        <p className="mt-6 text-center text-xs text-(--muted)">
          Powered by ZenScail
        </p>
      </div>
    </div>
  );
}
