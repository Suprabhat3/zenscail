import { MailPoller } from "@/components/mail/MailPoller";

// Wraps every /mail route. Mounts the client poller that keeps the inbox cache
// fresh (every 60s, only while the tab is visible) — our reliable alternative
// to the best-effort Corsair webhook.
export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MailPoller />
    </>
  );
}
