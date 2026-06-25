import { requireSession } from "@/lib/session";
import { CloudCelebration } from "@/components/realtime/CloudCelebration";

export const metadata = { title: "Welcome — ZenScail" };

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Must be signed in, but deliberately NOT inside the (app) group — this route
  // is what the (app) gate redirects un-onboarded users to, so it can't gate.
  await requireSession();
  return (
    <div className="min-h-screen bg-(--bg) text-(--ink)">
      {children}
      {/* Fires the upgrade celebration if an admin grants Cloud while the user
          is sitting on onboarding (the evaluator flow). */}
      <CloudCelebration />
    </div>
  );
}
