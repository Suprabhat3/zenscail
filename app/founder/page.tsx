import type { Metadata } from "next";
import { DocShell } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Founder",
  description:
    "Meet Suprabhat — the web & AI engineer behind ZenScail, building software that gives people back the first hour of their day.",
  alternates: { canonical: "/founder" },
};

const toc = [
  { id: "intro", title: "Meet the founder" },
  { id: "story", title: "Why ZenScail" },
  { id: "craft", title: "What he builds" },
  { id: "connect", title: "Connect" },
];

const stackGroups = [
  {
    label: "Frontend",
    icon: "M4 5h16v14H4zM4 9h16",
    items: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript",
      "TailwindCSS",
      "Shadcn UI",
      "Framer Motion",
      "HTML5",
      "CSS3",
    ],
  },
  {
    label: "Backend & data",
    icon: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7",
    items: [
      "Node.js",
      "Express.js",
      "PostgreSQL",
      "Prisma",
      "MongoDB",
      "Supabase",
      "Firebase",
      "Neon",
    ],
  },
  {
    label: "AI & automation",
    icon: "M12 3v3M12 18v3M5 12H2M22 12h-3M7 7l-2-2M19 19l-2-2M7 17l-2 2M19 5l-2 2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    items: [
      "OpenAI",
      "Gemini AI",
      "Anthropic",
      "Vercel AI SDK",
      "Multi-agent systems",
      "RAG",
      "PDF parsing",
    ],
  },
  {
    label: "Auth, tooling & languages",
    icon: "M15 7a4 4 0 1 0-3.9 5H13l2 2 2-2 2 2 2-2-2-2a4 4 0 0 0-4-3z",
    items: [
      "Better Auth",
      "JWT",
      "Zod",
      "Python",
      "Playwright",
      "Vite",
      "Git",
      "Bootstrap",
    ],
  },
  {
    label: "DevOps & infrastructure",
    icon: "M12 16V8m0 0-3 3m3-3 3 3M6 18a4 4 0 0 1-1-7.9A5 5 0 0 1 15 7a4 4 0 0 1 3 7",
    wide: true,
    items: [
      "Vercel",
      "AWS",
      "GCP",
      "Azure",
      "Cloudflare",
      "Docker",
      "GitHub Actions",
      "Nginx",
      "Netlify",
      "Railway",
      "Render",
      "Sentry",
    ],
  },
];

function GroupIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const socials = [
  { label: "Portfolio", href: "https://new.suprabhat.site" },
  { label: "X / Twitter", href: "https://x.com/Suprabhat_3" },
  { label: "LinkedIn", href: "https://linkedin.com/in/suprabhatt" },
  { label: "GitHub", href: "https://github.com/suprabhat3" },
  { label: "YouTube", href: "https://youtube.com/@suprabhat_yt" },
];

export default function FounderPage() {
  return (
    <DocShell
      eyebrow="Company"
      title={<>Built by <em>one</em> obsessive engineer.</>}
      intro="ZenScail is the work of Suprabhat — a web and AI engineer who got tired of losing his mornings to an overflowing inbox, and decided to build the calm he wanted."
      toc={toc}
      contact={{
        heading: "Want to talk to the founder?",
        body: "Suprabhat reads every message that comes through. Reach the team and it lands with him.",
        email: "team@zenscail.com",
      }}
    >
      <section id="intro" className="doc-section">
        <h2>Meet the founder</h2>
        <p>
          <strong>Suprabhat </strong> is a Web App Developer &amp; AI Engineer who builds
          modern web applications and AI-powered tools that solve real problems. His own
          words sum up the approach: <em>&ldquo;Building Web &amp; GenAI software that
          (usually) work.&rdquo;</em>
        </p>
        <p>
          Outside of shipping product, he explores emerging technology, contributes to
          open source, and shares what he learns through writing and video. ZenScail is
          where those threads come together — a polished web app powered end-to-end by
          generative AI.
        </p>
      </section>

      <section id="story" className="doc-section">
        <h2>Why ZenScail</h2>
        <p>
          The first hour of every day kept disappearing into triage — a hundred unread
          emails and a fractured calendar, before any real work began. Rather than accept
          that as normal, Suprabhat built an assistant that reads the inbox and calendar
          overnight and hands you one calm brief in the morning.
        </p>
        <div className="doc-callout sage">
          <p>
            <strong>The guiding belief:</strong> software should give you time back, not
            ask for more of it. ZenScail runs on your own AI keys and never sells or trains
            on your data — the incentives stay pointed at you.
          </p>
        </div>
      </section>

      <section id="craft" className="doc-section">
        <h2>What he builds with</h2>
        <p>
          A pragmatic, full-stack toolkit — from pixel-level frontend craft to AI
          orchestration on the backend. ZenScail itself runs on this exact stack:
        </p>
        <div className="stack-grid">
          {stackGroups.map((group) => (
            <div
              className={`stack-group${"wide" in group && group.wide ? " wide" : ""}`}
              key={group.label}
            >
              <div className="stack-group-head">
                <span className="sg-icon">
                  <GroupIcon d={group.icon} />
                </span>
                <h3>{group.label}</h3>
              </div>
              <div className="byok-chips">
                {group.items.map((tech) => (
                  <span className="byok-chip" key={tech}>
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>


      <section id="connect" className="doc-section">
        <h2>Connect</h2>
        <p>
          Suprabhat is open to thoughtful conversations, collaborations, and feedback on
          ZenScail. You&rsquo;ll find him here:
        </p>
        <div className="role-list">
          {socials.map((s) => (
            <a
              key={s.href}
              className="role-card"
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <h3>{s.label}</h3>
                <p className="role-meta">{s.href.replace(/^https?:\/\//, "")}</p>
              </div>
              <span className="btn btn-ghost btn-sm">Visit →</span>
            </a>
          ))}
        </div>
      </section>
    </DocShell>
  );
}
