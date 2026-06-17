import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ZenScail collects, uses, and protects your data — and why your email, calendar, and AI keys stay yours.",
  alternates: { canonical: "/privacy" },
};

const toc = [
  { id: "overview", title: "Overview" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use", title: "How we use it" },
  { id: "payments", title: "Payments & subscriptions" },
  { id: "ai-and-keys", title: "AI processing & your keys" },
  { id: "sharing", title: "How we share data" },
  { id: "retention", title: "Data retention" },
  { id: "security", title: "Security" },
  { id: "your-rights", title: "Your rights" },
  { id: "cookies", title: "Cookies & tracking" },
  { id: "children", title: "Children's privacy" },
  { id: "international", title: "International transfers" },
  { id: "changes", title: "Changes to this policy" },
];

export default function PrivacyPage() {
  return (
    <DocShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro="ZenScail reads some of the most personal data you own — your inbox and your calendar. This policy explains exactly what we touch, what we never touch, and the controls you keep."
      updated="June 17, 2026"
      toc={toc}
      contact={{
        heading: "Questions about your privacy?",
        body: "Our privacy team reads every message and replies within five business days. Data-access and deletion requests are handled here too.",
        email: "support@zenscail.com",
      }}
    >
      <section id="overview" className="doc-section">
        <h2>Overview</h2>
        <p>
          ZenScail (&ldquo;ZenScail,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) provides an
          AI assistant that summarises your email and calendar into a single daily
          brief, drafts replies in your voice, and helps you schedule your time. This
          policy describes how we handle personal information when you use our website
          and application (together, the &ldquo;Service&rdquo;).
        </p>
        <div className="doc-callout sage">
          <p>
            <strong>The short version:</strong> we process your email and calendar only to
            give you the features you asked for. We don&rsquo;t sell your data, we
            don&rsquo;t use it to train models, and when you bring your own AI key, your
            message content goes straight to your chosen provider — not into a ZenScail
            datastore.
          </p>
        </div>
      </section>

      <section id="information-we-collect" className="doc-section">
        <h2>Information we collect</h2>
        <h3>Account information</h3>
        <p>
          When you create an account we collect your name, email address, and either a
          hashed password or a Google account identifier (if you sign in with Google). We
          never store your password in plain text.
        </p>
        <h3>Connected mailbox & calendar data</h3>
        <p>
          When you connect Google with the permissions ZenScail requests, we access the
          email and calendar data needed to build your brief — message metadata
          (senders, subjects, timestamps, labels), message bodies for the items we
          summarise, and your calendar events and availability. We access this data on
          your behalf and only when you use a feature that needs it.
        </p>
        <h3>Billing &amp; subscription information</h3>
        <p>
          If you subscribe to ZenScail Cloud, our payment processor (Razorpay) collects and
          processes your payment details to set up the recurring charge. We do not receive
          or store your full card or bank details. We do keep limited subscription
          metadata — your plan, subscription status, renewal date, and a payment/subscription
          reference — so we can give you the right access and show your billing state.
        </p>
        <h3>Usage & device information</h3>
        <p>
          We collect basic technical data — IP address, browser type, pages viewed, and
          actions taken in the app — to keep the Service secure and working. This is the
          minimum needed to operate and protect the product.
        </p>
        <h3>What we deliberately do not collect</h3>
        <ul>
          <li>We don&rsquo;t scrape your entire mailbox into our own archive.</li>
          <li>We don&rsquo;t read attachments unless a feature you triggered requires it.</li>
          <li>We don&rsquo;t collect special-category data (health, beliefs, etc.) on purpose.</li>
        </ul>
      </section>

      <section id="how-we-use" className="doc-section">
        <h2>How we use your information</h2>
        <ul>
          <li><strong>To deliver the Service</strong> — generating briefs, summaries, draft replies, and scheduling suggestions.</li>
          <li><strong>To authenticate you</strong> and keep your account secure.</li>
          <li><strong>To send transactional email</strong> — verification codes, onboarding, and important account notices.</li>
          <li><strong>To improve reliability</strong> — diagnosing errors and preventing abuse using aggregated, non-content signals.</li>
          <li><strong>To comply with the law</strong> where we have a legal obligation.</li>
        </ul>
        <p>
          We rely on your <strong>consent</strong> (for connecting Google and sending
          marketing email), the <strong>performance of our contract</strong> with you
          (to run the features you signed up for), and our{" "}
          <strong>legitimate interests</strong> (security and reliability) as our legal
          bases for processing.
        </p>
      </section>

      <section id="payments" className="doc-section">
        <h2>Payments &amp; subscriptions</h2>
        <p>
          Paid subscriptions to ZenScail Cloud are handled by{" "}
          <strong>Razorpay</strong>, our third-party payment processor. When you subscribe,
          your card or bank information is collected and processed by Razorpay under its own
          privacy policy and security standards — <strong>ZenScail never sees or stores your
          full payment credentials.</strong>
        </p>
        <p>
          We receive back from Razorpay only what we need to manage your account: a
          subscription identifier, the plan, the status (active, cancelled, etc.), and the
          current period end. We use this solely to grant the correct access, show your
          billing state, and meet our financial and legal record-keeping obligations. For
          how subscriptions, cancellation, and refunds work, see our{" "}
          <a href="/terms">Terms of Service</a>.
        </p>
      </section>

      <section id="ai-and-keys" className="doc-section">
        <h2>AI processing &amp; your keys</h2>
        <p>
          ZenScail is built around <strong>bring-your-own-key</strong> (BYOK). When you
          add your own OpenAI, Anthropic, or other provider key, the content we send for
          summarisation and drafting goes directly to that provider under{" "}
          <em>your</em> account and <em>their</em> terms. We act as a conduit; we do not
          retain that content afterwards.
        </p>
        <ul>
          <li>Your API keys are encrypted at rest and are never exposed to other users or shown back to you in full.</li>
          <li>We do not use your email, calendar, or prompts to train any model — ours or anyone else&rsquo;s.</li>
          <li>If you use a ZenScail-hosted model option, the same no-training commitment applies, and content is processed only to return your result.</li>
        </ul>
        <div className="doc-callout">
          <p>
            Reputable AI providers offer zero-retention or no-training settings for API
            traffic. We encourage you to review your provider&rsquo;s data policy, since
            content you send through your own key is governed by your agreement with them.
          </p>
        </div>
      </section>

      <section id="sharing" className="doc-section">
        <h2>How we share data</h2>
        <p>We share personal information only in these limited cases:</p>
        <ul>
          <li><strong>Service providers (sub-processors)</strong> who run our infrastructure — hosting, our database, transactional email delivery, and the AI provider you choose. Each is bound by contract to protect your data.</li>
          <li><strong>Razorpay</strong>, our payment processor, to securely take payment and manage your ZenScail Cloud subscription.</li>
          <li><strong>Google</strong>, to read and act on your mailbox and calendar at your direction.</li>
          <li><strong>Legal & safety</strong> reasons, when required by law or to protect the rights and safety of users.</li>
          <li><strong>Business transfers</strong>, if ZenScail is involved in a merger or acquisition — you&rsquo;ll be notified before your data becomes subject to a different policy.</li>
        </ul>
        <p>
          <strong>We never sell your personal information</strong>, and we never share it
          with advertisers.
        </p>
      </section>

      <section id="retention" className="doc-section">
        <h2>Data retention</h2>
        <p>
          We keep account information for as long as your account is active. Generated
          briefs and summaries are kept only as long as useful to you and are deleted on
          a rolling basis. When you delete your account, we erase your personal data and
          revoke our access tokens within 30 days, except where we must retain limited
          records to meet a legal obligation.
        </p>
      </section>

      <section id="security" className="doc-section">
        <h2>Security</h2>
        <p>
          We protect your data with encryption in transit and at rest, scoped access
          tokens, least-privilege internal access, and continuous monitoring. For the
          full picture, see our{" "}
          <a href="/security">Security overview</a>. No system is perfectly secure, but
          we work hard to make ZenScail worthy of the access you grant it.
        </p>
      </section>

      <section id="your-rights" className="doc-section">
        <h2>Your rights &amp; choices</h2>
        <p>Depending on where you live, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Delete your data (&ldquo;right to be forgotten&rdquo;).</li>
          <li>Export your data in a portable format.</li>
          <li>Object to or restrict certain processing, and withdraw consent at any time.</li>
        </ul>
        <p>
          You can disconnect Google at any time from the app, or revoke ZenScail&rsquo;s
          access from your Google Account&rsquo;s security settings. To exercise any
          right — or to raise a privacy grievance under India&rsquo;s Digital Personal Data
          Protection Act — email <Mail address="support@zenscail.com" /> <br />and
          we&rsquo;ll respond within the time required by applicable law.
        </p>
      </section>

      <section id="cookies" className="doc-section">
        <h2>Cookies &amp; tracking</h2>
        <p>
          We use a small number of cookies that are essential for signing in and keeping
          your session secure, plus privacy-respecting analytics to understand how the
          Service is used. We don&rsquo;t use advertising or cross-site tracking cookies.
          For details, see our <a href="/cookies">Cookie Policy</a>.
        </p>
      </section>

      <section id="children" className="doc-section">
        <h2>Children&rsquo;s privacy</h2>
        <p>
          ZenScail is intended for users aged 18 and over and is not directed to children.
          We do not knowingly collect personal information from anyone under 18. If you
          believe a minor has provided us data, contact{" "}
          <Mail address="support@zenscail.com" /> <br /> and we will delete it.
        </p>
      </section>

      <section id="international" className="doc-section">
        <h2>International data transfers</h2>
        <p>
          ZenScail may process data in countries other than your own. Where we transfer
          personal data across borders, we rely on appropriate safeguards such as the
          European Commission&rsquo;s Standard Contractual Clauses to ensure your data
          stays protected.
        </p>
      </section>

      <section id="changes" className="doc-section">
        <h2>Changes to this policy</h2>
        <p>
          We&rsquo;ll update this page when our practices change and revise the
          &ldquo;last updated&rdquo; date above. For material changes, we&rsquo;ll notify
          you by email or in the app before they take effect.
        </p>
      </section>
    </DocShell>
  );
}
