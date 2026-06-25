import { BrandLoader } from "@/components/app/BrandLoader";

export default function BookingLinksLoading() {
  return (
    <BrandLoader
      title="Opening your booking links"
      messages={[
        "Gathering your links…",
        "Checking what's live…",
        "Almost ready.",
      ]}
    />
  );
}
