import Link from "next/link";
import { sendMessage } from "../actions";

export const metadata = { title: "Compose — ZenScail" };

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/mail" className="text-sm text-neutral-400 hover:text-neutral-200">
        ← Back to inbox
      </Link>
      <h1 className="mt-3 font-serif text-2xl">New message</h1>

      <form action={sendMessage} className="mt-6 space-y-3">
        <input
          type="text"
          name="to"
          required
          placeholder="To"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <textarea
          name="body"
          rows={12}
          required
          placeholder="Write your message…"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white">
          Send
        </button>
      </form>
    </div>
  );
}
