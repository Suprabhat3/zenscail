import { BrandLoader } from "@/components/app/BrandLoader";

export default function MailLoading() {
  return (
    <BrandLoader
      title="Opening your inbox"
      messages={[
        "Gathering your conversations…",
        "Reading what landed since you left…",
        "Sorting signal from the noise…",
        "Surfacing what needs you first…",
      ]}
    />
  );
}
