import { requireSession } from "@/lib/session";
import { getAppIdentityForUser } from "@/lib/identity";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const metadata = { title: "Profile — ZenScail" };

export default async function ProfilePage() {
  const session = await requireSession();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  return (
    <ProfileForm
      name={session.user.name}
      email={session.user.email}
      connectedMailbox={identity.connectedEmail}
      createdAt={session.user.createdAt?.toISOString?.() ?? String(session.user.createdAt ?? "")}
    />
  );
}
