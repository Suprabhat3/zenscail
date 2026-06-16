import { BrandLoader } from "@/components/app/BrandLoader";

export default function AppLoading() {
  return (
    <BrandLoader
      fullScreen
      title="Setting up your calm space"
      messages={[
        "Tidying your desk before you arrive…",
        "Bringing your mail and calendar together…",
        "A quiet moment — we're almost there.",
        "Good things load gently.",
      ]}
    />
  );
}
