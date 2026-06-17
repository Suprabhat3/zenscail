import { requireSession } from "@/lib/session";

export const metadata = { title: "Welcome — ZenScail" };

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Must be signed in, but deliberately NOT inside the (app) group — this route
  // is what the (app) gate redirects un-onboarded users to, so it can't gate.
  await requireSession();
  return <div className="min-h-screen bg-(--bg) text-(--ink)">{children}</div>;
}
