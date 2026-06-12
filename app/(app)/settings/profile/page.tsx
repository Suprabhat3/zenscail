import { requireSession } from "@/lib/session";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const metadata = { title: "Profile — ZenScail" };

export default async function ProfilePage() {
  const session = await requireSession();
  return (
    <ProfileForm
      name={session.user.name}
      email={session.user.email}
      createdAt={session.user.createdAt?.toISOString?.() ?? String(session.user.createdAt ?? "")}
    />
  );
}
