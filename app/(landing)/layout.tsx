import { AskAiWidget } from "@/components/AskAiWidget";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AskAiWidget />
    </>
  );
}
