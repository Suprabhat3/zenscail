import { requireSession } from "@/lib/session";
import { UndoWindowSetting } from "@/components/settings/UndoWindowSetting";
import { SmartComposeSetting } from "@/components/settings/SmartComposeSetting";

export const metadata = { title: "Mail settings — ZenScail" };

export default async function MailSettingsPage() {
  await requireSession();
  return (
    <div className="space-y-5">
      <UndoWindowSetting />
      <SmartComposeSetting />
    </div>
  );
}
