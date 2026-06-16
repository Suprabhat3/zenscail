import { BrandLoader } from "@/components/app/BrandLoader";

export default function CalendarLoading() {
  return (
    <BrandLoader
      title="Laying out your week"
      messages={[
        "Gathering your events…",
        "Lining up what's ahead…",
        "Finding the open spaces in your day…",
        "Almost ready.",
      ]}
    />
  );
}
