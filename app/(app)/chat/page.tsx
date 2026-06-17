import { redirect } from "next/navigation";

// Chat now lives in the slide-over assistant dock, available on every page
// via the header's "Assistant" button. Old links land on the dashboard.
export default function ChatPage() {
  redirect("/dashboard");
}
