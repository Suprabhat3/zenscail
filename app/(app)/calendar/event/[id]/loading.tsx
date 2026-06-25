import { BrandLoader } from "@/components/app/BrandLoader";

export default function EventLoading() {
  return (
    <BrandLoader
      title="Opening your event"
      messages={[
        "Fetching the details…",
        "Gathering guests and responses…",
        "Almost ready.",
      ]}
    />
  );
}
