import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How ZenScail protects your email, calendar, and AI keys — encryption, least-privilege access, and responsible disclosure.",
  alternates: { canonical: "/security" },
};

const toc = [
  { id: "approach", title: "Our approach" },
  { id: "encryption", title: "Encryption" },
  { id: "access", title: "Access & permissions" },
  { id: "keys", title: "Protecting your AI keys" },
  { id: "payments", title: "Payment security" },
  { id: "infrastructure", title: "Infrastructure" },
  { id: "data-minimization", title: "Data minimisation" },
  { id: "authentication", title: "Authentication" },
  { id: "monitoring", title: "Monitoring & response" },
  { id: "disclosure", title: "Responsible disclosure" },
];

export default function SecurityPage() {
  return (
    <DocShell
      eyebrow="Trust"
      title="Security at ZenScail"
      intro="You’re handing us the keys to your inbox and calendar. We treat that access as a responsibility, not a convenience. Here’s how we keep it safe."
      updated="June 17, 2026"
      toc={toc}
      contact={{
        heading: "Found a vulnerability?",
        body: "We welcome responsible disclosure and respond quickly. Please report any security issue directly to our team.",
        email: "support@zenscail.com",
      }}
    >
      <section id="approach" className="doc-section">
        <h2>Our approach</h2>
        <p>
          Security at ZenScail starts from a single principle:{" "}
          <strong>access the least amount of your data needed, for the shortest time
          needed, and protect it at every step.</strong> Because we connect to email and
          calendar — some of the most sensitive data you own — we design conservatively
          and default to privacy.
        </p>
      </section>

      <section id="encryption" className="doc-section">
        <h2>Encryption</h2>
        <ul>
          <li><strong>In transit:</strong> all traffic between you, ZenScail, Google, and AI providers is encrypted with TLS 1.2+.</li>
          <li><strong>At rest:</strong> our database and backups are encrypted using industry-standard AES-256.</li>
          <li><strong>Secrets:</strong> access tokens and your AI keys are encrypted with dedicated keys, separate from ordinary application data.</li>
        </ul>
      </section>

      <section id="access" className="doc-section">
        <h2>Access &amp; permissions</h2>
        <p>
          When you connect Google, ZenScail requests only the scopes required for the
          features you use. We access your mailbox and calendar on demand to fulfil a
          request — we don&rsquo;t bulk-download your data into a private archive. You can
          revoke our access at any time from your Google Account or from within the app.
        </p>
        <div className="doc-callout sage">
          <p>
            Internally, access to production systems follows least-privilege rules. Only
            the minimum number of people can reach production, access is logged, and we
            never browse user content except when you ask us to investigate an issue.
          </p>
        </div>
      </section>

      <section id="keys" className="doc-section">
        <h2>Protecting your AI keys</h2>
        <p>
          ZenScail is built around bring-your-own-key. Your provider keys are encrypted at
          rest, decrypted only in memory at the moment of a request, and never written to
          logs or shown back to you in full. We don&rsquo;t use your content or prompts to
          train any model. See our <a href="/privacy">Privacy Policy</a> for the full data
          commitments.
        </p>
      </section>

      <section id="payments" className="doc-section">
        <h2>Payment security</h2>
        <p>
          Payments for ZenScail Cloud are handled entirely by{" "}
          <strong>Razorpay</strong>, a PCI-DSS-compliant payment processor. Card and bank
          details are entered directly with Razorpay and never pass through or rest on
          ZenScail&rsquo;s servers — <strong>we never see or store your full payment
          credentials.</strong> We retain only a subscription reference and status so we can
          manage your access. See our <a href="/terms">Terms</a> for how billing,
          cancellation, and refunds work.
        </p>
      </section>

      <section id="infrastructure" className="doc-section">
        <h2>Infrastructure</h2>
        <p>
          ZenScail runs on reputable cloud providers with strong physical and network
          security. We isolate environments, keep dependencies patched, and apply secure
          defaults across our stack. Backups are encrypted and access-controlled, and we
          regularly review our configuration for drift.
        </p>
      </section>

      <section id="data-minimization" className="doc-section">
        <h2>Data minimisation</h2>
        <ul>
          <li>We store the minimum needed to deliver your brief and remember your preferences.</li>
          <li>Generated summaries are pruned on a rolling basis rather than kept forever.</li>
          <li>When you delete your account, we erase your data and revoke tokens within 30 days.</li>
        </ul>
      </section>

      <section id="authentication" className="doc-section">
        <h2>Authentication</h2>
        <p>
          Passwords are hashed with a modern, salted algorithm — never stored in plain
          text. Email sign-ups are verified with a one-time code before the account
          becomes active, and Google sign-in uses OAuth so we never see your Google
          password. We continuously work to add stronger options over time.
        </p>
      </section>

      <section id="monitoring" className="doc-section">
        <h2>Monitoring &amp; incident response</h2>
        <p>
          We monitor for anomalous activity, rate-limit sensitive endpoints, and maintain
          an incident-response process. If a breach ever affects your personal data,
          we&rsquo;ll notify affected users and the relevant authorities as required by
          law, and explain what happened and what we&rsquo;re doing about it.
        </p>
      </section>

      <section id="disclosure" className="doc-section">
        <h2>Responsible disclosure</h2>
        <p>
          We&rsquo;re grateful to the security community. If you discover a vulnerability,
          please report it privately to <Mail address="support@zenscail.com" /> with
          enough detail to reproduce it. Please don&rsquo;t access other users&rsquo; data,
          degrade the Service, or disclose the issue publicly until we&rsquo;ve had a
          reasonable chance to fix it. We&rsquo;ll acknowledge your report promptly and
          keep you updated.
        </p>
      </section>
    </DocShell>
  );
}
