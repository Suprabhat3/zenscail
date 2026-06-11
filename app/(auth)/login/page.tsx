import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — ZenScail" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/mail");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <LoginForm googleEnabled={googleEnabled} />
    </main>
  );
}
