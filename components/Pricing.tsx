import { Reveal } from "./Reveal";

const Check = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 15 15" aria-hidden="true">
    <path
      d="M 2 8 L 6 12 L 13 3"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2 className="display">
            Free <em>by nature.</em> <br />
            Paid <em>for Convenience</em>
          </h2>
          <p className="lede">
            ZenScail is built around a simple idea: the app is free. Bring your
            own AI keys and pay nothing — or let us handle the AI and pay one
            calm price.
          </p>
        </Reveal>

        <div className="pricing-grid">
          <Reveal className="price-card">
            <span className="pc-tag">Bring your own keys</span>
            <h3>ZenScail Free</h3>
            <p className="pc-sub">
              Plug in your own API keys. The whole app, no meter running.
            </p>
            <div className="price-figure">
              <span className="pf-amount">$0</span>
              <span className="pf-per">forever — you only pay your AI provider</span>
            </div>
            <ul className="price-list">
              <li>
                <Check color="var(--sage)" />
                <span>Every feature — daily brief, summaries, drafts, scheduling</span>
              </li>
              <li>
                <Check color="var(--sage)" />
                <span>Your keys, your models, your data — calls go straight to your provider</span>
              </li>
              <li>
                <Check color="var(--sage)" />
                <span>Unlimited accounts and calendars</span>
              </li>
            </ul>
            <div className="byok-chips">
              <span className="byok-chip">OpenAI</span>
              <span className="byok-chip">Anthropic</span>
              <span className="byok-chip">Gemini</span>
              <span className="byok-chip">Mistral</span>
              <span className="byok-chip">Ollama (local)</span>
            </div>
            <a className="btn btn-ghost" href="#join" style={{ marginTop: 28 }}>
              Join the waitlist
            </a>
          </Reveal>

          <Reveal delay={1} className="price-card featured">
            <h3>ZenScail Cloud</h3>
            <p className="pc-sub">
              No keys, no setup. Our models, tuned for email — it just works.
            </p>
            <div className="price-figure">
              <span className="pf-amount">$12</span>
              <span className="pf-per">per month, when we launch</span>
            </div>
            <ul className="price-list">
              <li>
                <Check color="var(--gold)" />
                <span>Everything in Free, zero configuration</span>
              </li>
              <li>
                <Check color="var(--gold)" />
                <span>AI usage included — no token math, no surprise bills</span>
              </li>
              <li>
                <Check color="var(--gold)" />
                <span>Priority support and early features</span>
              </li>
            </ul>
            <a className="btn btn-accent" href="#join">
              Join the waitlist
            </a>
          </Reveal>
        </div>
        <Reveal className="privacy-callout">
          <span className="pc-lock" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="4" y="9.5" width="14" height="9" rx="2.5" stroke="#fff" strokeWidth="1.8" />
              <path d="M 7 9.5 V 7 a 4 4 0 0 1 8 0 v 2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="11" cy="14" r="1.6" fill="#fff" />
            </svg>
          </span>
          <div>
            <h3>Your API keys never touch our servers</h3>
            <p>
              Bring your own keys with total peace of mind. Your key is{" "}
              <strong>encrypted and stored only on your device</strong> — we
              never save it in our database, and it never passes through our
              servers. And because it&rsquo;s encrypted on your device, no
              other website, extension, or attacker can read or use it. Your
              keys stay yours, full stop.
            </p>
          </div>
        </Reveal>
        <p className="pricing-note">
          Either way, your email never trains anyone&rsquo;s models.
          That&rsquo;s a promise, not a setting.
        </p>
      </div>
    </section>
  );
}
