import { BrandLoader } from "@/components/app/BrandLoader";

export default function ChatLoading() {
  return (
    <BrandLoader
      title="Waking up your assistant"
      messages={[
        "Loading your recent conversations…",
        "Getting your context ready…",
        "Ready in a moment.",
      ]}
    />
  );
}
