import { requireSession } from "@/lib/session";

export const metadata = { title: "Welcome — ZenScail" };

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Must be signed in, but deliberately NOT inside the (app) group — this route
  // is what the (app) gate redirects un-onboarded users to, so it can't gate.
  // The Cloud upgrade celebration is mounted by the page on the AI/subscribe
  // step only (never the connect step), so it can't fire before the mailbox and
  // calendar are connected.
  await requireSession();
  return <div className="min-h-screen bg-(--bg) text-(--ink)">{children}</div>;
}
