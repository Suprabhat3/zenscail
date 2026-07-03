import { CalendarPoller } from "@/components/calendar/CalendarPoller";

// Wraps every /calendar route. Mounts the client poller that keeps the
// calendar cache fresh (every 60s, only while the tab is visible) — the
// calendar counterpart to MailPoller.
export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CalendarPoller />
    </>
  );
}
