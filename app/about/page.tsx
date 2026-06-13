import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why ZenScail exists: a calmer relationship with your inbox and calendar, built for people who'd rather be working.",
  alternates: { canonical: "/about" },
};

const toc = [
  { id: "story", title: "Our story" },
  { id: "mission", title: "Mission" },
  { id: "principles", title: "Principles" },
  { id: "team", title: "The team" },
];

export default function AboutPage() {
  return (
    <DocShell
      eyebrow="Company"
      title={<>The calm before <em>9&nbsp;AM</em>.</>}
      intro="ZenScail began with a simple frustration: the first hour of every day was spent triaging email instead of doing the work that actually mattered. We thought a calmer morning was possible."
      toc={toc}
      contact={{
        heading: "Say hello",
        body: "Press, partnerships, or just a friendly note — we read everything that lands in our inbox.",
        email: "team@zenscail.com",
      }}
    >
      <section id="story" className="doc-section">
        <h2>Our story</h2>
        <p>
          We kept watching capable people start their day underwater — a hundred unread
          emails, a calendar fractured into fifteen-minute shards, and no clear sense of
          what actually needed them. The tools meant to help had become another thing to
          manage.
        </p>
        <p>
          So we built ZenScail: an assistant that reads your inbox and calendar overnight
          and hands you one calm brief in the morning. What matters, what can wait, and
          what&rsquo;s already handled. Then it gets out of your way so you can do the
          work you&rsquo;re here to do.
        </p>
      </section>

      <section id="mission" className="doc-section">
        <h2>Our mission</h2>
        <p>
          To give people back the first hour of their day. We measure success not by time
          spent in our app, but by time you <em>don&rsquo;t</em> have to spend in your
          inbox.
        </p>
        <div className="doc-callout sage">
          <p>
            <strong>A calmer inbox is a minute away.</strong> ZenScail is free to start,
            runs on your own AI keys, and never sells your data. The incentives stay
            aligned with you.
          </p>
        </div>
      </section>

      <section id="principles" className="doc-section">
        <h2>What we believe</h2>
        <ul>
          <li><strong>Your data is yours.</strong> We don&rsquo;t sell it, and we don&rsquo;t train models on it. Bring your own key and the content goes straight to your provider.</li>
          <li><strong>Less, but better.</strong> The goal is a quieter day, not more notifications. Every feature has to earn its place.</li>
          <li><strong>Trust is the product.</strong> The moment ZenScail feels untrustworthy with your inbox, it&rsquo;s worthless. Security and privacy come first.</li>
          <li><strong>Humans stay in control.</strong> The AI drafts and suggests; you decide and send.</li>
        </ul>
      </section>

      <section id="team" className="doc-section">
        <h2>The team</h2>
        <p>
          ZenScail is built by a small, independent team that cares deeply about craft —
          from the words in your brief to the way a card animates. We&rsquo;re always
          happy to hear from people who share that obsession — <a href="/founder">meet
          the founder</a> or reach out any time at <Mail address="team@zenscail.com" />.
        </p>
      </section>
    </DocShell>
  );
}
