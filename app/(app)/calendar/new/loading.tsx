import { BrandLoader } from "@/components/app/BrandLoader";

export default function NewEventLoading() {
  return (
    <BrandLoader
      title="Setting up a new event"
      messages={[
        "Opening a fresh event…",
        "Getting the details ready…",
        "Almost there.",
      ]}
    />
  );
}
