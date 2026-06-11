import { Reveal } from "./Reveal";

export function Features() {
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">What it does</span>
          <h2 className="display">
            Less inbox.
            <br />
            More <em>actual work.</em>
          </h2>
        </Reveal>

        <div className="features-grid">
          {/* Email summarization */}
          <Reveal className="feature-card">
            <div className="fc-art vignette" aria-hidden="true">
              <svg viewBox="0 0 220 120">
                <rect x="24" y="22" width="80" height="5" rx="2.5" className="fill-soft" />
                <rect x="24" y="35" width="92" height="5" rx="2.5" className="fill-soft" />
                <rect x="24" y="48" width="70" height="5" rx="2.5" className="fill-soft" />
                <rect x="24" y="61" width="86" height="5" rx="2.5" className="fill-soft" />
                <rect x="24" y="74" width="60" height="5" rx="2.5" className="fill-soft" />
                <rect x="24" y="87" width="78" height="5" rx="2.5" className="fill-soft" />
                <path d="M 124 58 H 144 M 138 51 L 145 58 L 138 65" className="stroke-accent" />
                <circle cx="160" cy="40" r="3" className="fill-accent" />
                <rect x="170" y="37" width="30" height="5" rx="2.5" fill="var(--ink-soft)" />
                <circle cx="160" cy="59" r="3" className="fill-accent" />
                <rect x="170" y="56" width="24" height="5" rx="2.5" fill="var(--ink-soft)" />
                <circle cx="160" cy="78" r="3" className="fill-accent" />
                <rect x="170" y="75" width="27" height="5" rx="2.5" fill="var(--ink-soft)" />
              </svg>
            </div>
            <h3>Threads, condensed</h3>
            <p>
              A 40-message thread becomes three honest bullet points. Read what
              was decided, not who said &ldquo;sounds good.&rdquo;
            </p>
          </Reveal>

          {/* Smart reminders */}
          <Reveal delay={1} className="feature-card">
            <div className="fc-art vignette" aria-hidden="true">
              <svg viewBox="0 0 220 120">
                <circle cx="110" cy="60" r="34" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.35">
                  <animate attributeName="r" values="30;44" dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0" dur="2.6s" repeatCount="indefinite" />
                </circle>
                <circle cx="110" cy="60" r="34" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.35">
                  <animate attributeName="r" values="30;44" dur="2.6s" begin="1.3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0" dur="2.6s" begin="1.3s" repeatCount="indefinite" />
                </circle>
                <path d="M 110 38 C 99 38 93 46 93 56 V 70 L 87 78 H 133 L 127 70 V 56 C 127 46 121 38 110 38 Z" className="stroke" strokeWidth="2.2" fill="var(--paper)" />
                <path d="M 103 84 A 7 7 0 0 0 117 84" className="stroke" strokeWidth="2.2" />
                <circle cx="129" cy="40" r="6" className="fill-accent" />
              </svg>
            </div>
            <h3>Reminders that think</h3>
            <p>
              Not &ldquo;you have mail&rdquo; — but &ldquo;Priya needs an answer
              by Friday, and Friday is tomorrow.&rdquo; Nudges only when they
              matter.
            </p>
          </Reveal>

          {/* AI reply drafting */}
          <Reveal delay={2} className="feature-card">
            <div className="fc-art vignette" aria-hidden="true">
              <svg viewBox="0 0 220 120">
                <rect x="36" y="30" width="120" height="60" rx="12" fill="var(--paper)" stroke="var(--line)" strokeWidth="1.5" />
                <rect x="50" y="46" width="74" height="5" rx="2.5" className="fill-soft" />
                <rect x="50" y="59" width="90" height="5" rx="2.5" className="fill-soft" />
                <rect x="50" y="72" width="56" height="5" rx="2.5" className="fill-soft" />
                <path d="M 156 84 L 176 64 L 184 72 L 164 92 L 153 95 Z" className="fill-accent" />
                <path d="M 168 22 L 170.4 29.6 L 178 32 L 170.4 34.4 L 168 42 L 165.6 34.4 L 158 32 L 165.6 29.6 Z" fill="var(--gold)">
                  <animateTransform attributeName="transform" type="rotate" values="0 168 32; 18 168 32; 0 168 32" dur="3.4s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
            <h3>Replies in your voice</h3>
            <p>
              ZenScail learns how you write — warm, brief, no exclamation marks
              — and drafts replies you&rsquo;d actually send. You just tap.
            </p>
          </Reveal>

          {/* Unified inbox + calendar (wide) */}
          <Reveal className="feature-card feature-wide">
            <div className="fc-art vignette" aria-hidden="true">
              <svg viewBox="0 0 300 150">
                <rect x="34" y="38" width="104" height="74" rx="10" fill="var(--paper)" stroke="var(--line)" strokeWidth="1.5" />
                <path d="M 34 48 L 86 80 L 138 48" fill="none" stroke="var(--ink-soft)" strokeWidth="1.8" strokeLinejoin="round" />
                <rect x="162" y="38" width="104" height="74" rx="10" fill="var(--paper)" stroke="var(--line)" strokeWidth="1.5" />
                <path d="M 162 58 H 266" stroke="var(--line)" strokeWidth="1.5" />
                <rect x="172" y="68" width="22" height="12" rx="4" className="fill-soft" />
                <rect x="200" y="68" width="22" height="12" rx="4" fill="var(--accent-tint)" />
                <rect x="228" y="86" width="22" height="12" rx="4" className="fill-soft" />
                <path d="M 138 75 H 162" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" values="18;0" dur="1.4s" repeatCount="indefinite" />
                </path>
                <circle cx="150" cy="75" r="9" className="fill-accent" />
                <path d="M 146.5 75 L 149 77.5 L 153.5 72.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="fc-copy">
              <h3>One place, not five tabs</h3>
              <p>
                Inbox and calendar live side by side and talk to each other. An
                email about a meeting shows the meeting. A meeting with an
                agenda shows the thread. No more cross-referencing yourself.
              </p>
            </div>
          </Reveal>

          {/* Smart scheduling */}
          <Reveal delay={1} className="feature-card">
            <div className="fc-art vignette" aria-hidden="true">
              <svg viewBox="0 0 220 120">
                <rect x="40" y="24" width="140" height="76" rx="10" fill="var(--paper)" stroke="var(--line)" strokeWidth="1.5" />
                <path d="M 40 42 H 180 M 75 42 V 100 M 110 42 V 100 M 145 42 V 100" stroke="var(--line-soft)" strokeWidth="1.5" />
                <rect x="46" y="50" width="24" height="16" rx="4" className="fill-soft" />
                <rect x="81" y="68" width="24" height="22" rx="4" className="fill-soft" />
                <rect x="151" y="50" width="24" height="16" rx="4" className="fill-soft" />
                <rect x="116" y="56" width="24" height="30" rx="5" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="5 4">
                  <animate attributeName="stroke-dashoffset" values="0;18" dur="1.6s" repeatCount="indefinite" />
                </rect>
              </svg>
            </div>
            <h3>Scheduling, solved</h3>
            <p>
              &ldquo;Find 30 minutes with Priya and Sam this week.&rdquo;
              ZenScail checks everyone&rsquo;s calendars, proposes the slot,
              sends the invites.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
