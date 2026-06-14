import { requireSession } from "@/lib/session";
import { UndoWindowSetting } from "@/components/settings/UndoWindowSetting";

export const metadata = { title: "Mail settings — ZenScail" };

export default async function MailSettingsPage() {
  await requireSession();
  return <UndoWindowSetting />;
}
