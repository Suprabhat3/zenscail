import { BrandLoader } from "@/components/app/BrandLoader";

export default function SettingsLoading() {
  return (
    <BrandLoader
      title="Loading your settings"
      messages={[
        "Fetching your preferences…",
        "Just a moment.",
      ]}
    />
  );
}
