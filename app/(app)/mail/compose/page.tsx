import Link from "next/link";
import { sendMessage } from "../actions";

export const metadata = { title: "Compose — ZenScail" };

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/mail" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to inbox
      </Link>
      <h1 className="mt-3 font-serif text-2xl font-normal tracking-tight text-(--ink)">New message</h1>

      <form action={sendMessage} className="mt-6 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) p-5 shadow-(--shadow-card)">
        <div className="space-y-3">
          <input
            type="text"
            name="to"
            required
            placeholder="To"
            className="w-full rounded-full border border-(--line) bg-(--bg) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          />
          <input
            type="text"
            name="subject"
            placeholder="Subject"
            className="w-full rounded-full border border-(--line) bg-(--bg) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          />
          <textarea
            name="body"
            rows={12}
            required
            placeholder="Write your message…"
            className="w-full rounded-xl border border-(--line) bg-(--bg) px-4 py-3 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
            Send
          </button>
          <Link href="/mail" className="text-sm text-(--muted) transition hover:text-(--ink)">
            Discard
          </Link>
        </div>
      </form>
    </div>
  );
}
