import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="font-serif text-2xl">Settings</h1>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
