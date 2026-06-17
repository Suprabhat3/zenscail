import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach the right team at ZenScail — support, privacy, security, press, and careers. Every address routes to a human.",
  alternates: { canonical: "/contact" },
};

const toc = [
  { id: "directory", title: "Who to email" },
  { id: "response", title: "Response times" },
  { id: "social", title: "Find us online" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const channels = [
  {
    title: "General",
    desc: "Questions about ZenScail, partnerships, press, or anything that doesn't fit a box.",
    email: "team@zenscail.com",
    icon: "M3 8l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  },
  {
    title: "Support",
    desc: "Trouble with your account or a connection, plus privacy, security, and data requests.",
    email: "support@zenscail.com",
    icon: "M18.36 6.64A9 9 0 1 1 5.64 6.64M12 2v8",
  },
];

export default function ContactPage() {
  return (
    <DocShell
      eyebrow="Get in touch"
      title="Talk to a human"
      intro="Every address below routes to a real person on the right team. Pick the one that fits and we’ll get back to you."
      toc={toc}
      contact={{
        heading: "Not sure who to ask?",
        body: "When in doubt, start here — we’ll route your message to the right team for you.",
        email: "team@zenscail.com",
      }}
    >
      <section id="directory" className="doc-section">
        <h2>Who to email</h2>
        <div className="contact-grid">
          {channels.map((c) => (
            <div className="contact-card" key={c.email}>
              <div className="cc-icon">
                <Icon d={c.icon} />
              </div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <Mail address={c.email} />
            </div>
          ))}
        </div>
      </section>

      <section id="response" className="doc-section">
        <h2>Response times</h2>
        <ul>
          <li><strong>Support:</strong> within 1&ndash;2 business days.</li>
          <li><strong>Privacy &amp; data requests:</strong> within the time required by applicable law, and never more than 30 days.</li>
          <li><strong>Security reports:</strong> acknowledged promptly, usually within one business day.</li>
        </ul>
      </section>

      <section id="social" className="doc-section">
        <h2>Find us online</h2>
        <p>
          Prefer something more public? We&rsquo;re on{" "}
          <a href="https://x.com/suprabhat_3" target="_blank" rel="noopener noreferrer">X</a>{" "}
          and{" "}
          <a href="https://www.linkedin.com/in/suprabhatt" target="_blank" rel="noopener noreferrer">LinkedIn</a>.
          For anything sensitive, please use email so we can verify and protect your data.
        </p>
      </section>
    </DocShell>
  );
}
