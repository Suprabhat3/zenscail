import { BrandLoader } from "@/components/app/BrandLoader";

export default function DashboardLoading() {
  return (
    <BrandLoader
      title="Writing your daily brief"
      messages={[
        "Reading your inbox and calendar…",
        "Noting what truly needs you today…",
        "Drafting a calm summary of your day…",
        "Almost ready — take a breath.",
      ]}
    />
  );
}
