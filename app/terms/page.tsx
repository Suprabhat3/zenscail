import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and ZenScail — your account, acceptable use, AI keys, billing, and the legal fine print.",
  alternates: { canonical: "/terms" },
};

const toc = [
  { id: "acceptance", title: "Acceptance" },
  { id: "eligibility", title: "Eligibility & accounts" },
  { id: "the-service", title: "The Service" },
  { id: "your-content", title: "Your content & data" },
  { id: "ai-keys", title: "AI providers & keys" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "billing", title: "Plans & billing" },
  { id: "third-party", title: "Third-party services" },
  { id: "ip", title: "Intellectual property" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of liability" },
  { id: "termination", title: "Termination" },
  { id: "changes", title: "Changes & governing law" },
];

export default function TermsPage() {
  return (
    <DocShell
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms are the agreement between you and ZenScail. They’re written to be readable — please take a minute, because using the Service means you accept them."
      updated="June 13, 2026"
      toc={toc}
      contact={{
        heading: "Need clarification?",
        body: "Our legal team is happy to walk through anything in these terms, including data-processing agreements for teams.",
        email: "support@zenscail.com",
      }}
    >
      <section id="acceptance" className="doc-section">
        <h2>Acceptance of these terms</h2>
        <p>
          By creating an account or using ZenScail (the &ldquo;Service&rdquo;), you agree
          to these Terms of Service and to our{" "}
          <a href="/privacy">Privacy Policy</a>. If you&rsquo;re using ZenScail on behalf
          of an organisation, you confirm you have authority to bind that organisation to
          these terms. If you don&rsquo;t agree, please don&rsquo;t use the Service.
        </p>
      </section>

      <section id="eligibility" className="doc-section">
        <h2>Eligibility &amp; your account</h2>
        <ul>
          <li>You must be at least 16 years old to use ZenScail.</li>
          <li>You&rsquo;re responsible for the activity under your account and for keeping your credentials secure.</li>
          <li>You agree to provide accurate information and to verify your email address when asked.</li>
          <li>Notify us promptly at <Mail address="support@zenscail.com" /> if you suspect unauthorised access.</li>
        </ul>
      </section>

      <section id="the-service" className="doc-section">
        <h2>The Service</h2>
        <p>
          ZenScail connects to your email and calendar to produce summaries, daily
          briefs, suggested replies, and scheduling assistance. The Service relies on
          automated and AI-generated output, which can be incomplete or wrong. You are
          responsible for reviewing anything before you send, schedule, or act on it.
        </p>
        <div className="doc-callout gold">
          <p>
            <strong>Always review AI output.</strong> Draft replies and scheduling
            suggestions are starting points, not final decisions. ZenScail is not liable
            for messages you send or meetings you book based on AI suggestions.
          </p>
        </div>
      </section>

      <section id="your-content" className="doc-section">
        <h2>Your content &amp; data</h2>
        <p>
          Your email, calendar, drafts, and other data remain <strong>yours</strong>. You
          grant ZenScail a limited licence to access, process, and display that content
          solely to operate the features you use. We claim no ownership over your content
          and will never sell it. How we handle it is described in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section id="ai-keys" className="doc-section">
        <h2>AI providers &amp; your keys</h2>
        <p>
          ZenScail supports bring-your-own-key for AI providers. When you connect a key:
        </p>
        <ul>
          <li>You&rsquo;re responsible for your usage and any costs charged by that provider.</li>
          <li>Your use of the provider is governed by that provider&rsquo;s own terms.</li>
          <li>You confirm you&rsquo;re authorised to use the key you supply.</li>
        </ul>
        <p>
          We keep your keys encrypted and use them only to fulfil your requests, but we
          aren&rsquo;t responsible for outages, pricing, or output quality of third-party
          AI providers.
        </p>
      </section>

      <section id="acceptable-use" className="doc-section">
        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for unlawful, harmful, or abusive purposes, including sending spam.</li>
          <li>Attempt to access accounts, data, or systems that aren&rsquo;t yours.</li>
          <li>Reverse-engineer, scrape, or overload the Service, or circumvent rate limits and security controls.</li>
          <li>Use the Service to build a competing product, or resell it without our written permission.</li>
          <li>Upload malware or interfere with the integrity or performance of the Service.</li>
        </ul>
        <p>We may suspend or terminate accounts that violate this section.</p>
      </section>

      <section id="billing" className="doc-section">
        <h2>Plans &amp; billing</h2>
        <p>
          ZenScail offers a free plan and may offer paid plans. Paid subscriptions renew
          automatically until cancelled, and fees are billed in advance and are
          non-refundable except where required by law. We&rsquo;ll give notice before any
          price change takes effect. Because the AI runs on your own keys, model usage
          costs are billed to you by your AI provider directly, not by us.
        </p>
      </section>

      <section id="third-party" className="doc-section">
        <h2>Third-party services</h2>
        <p>
          The Service integrates with third parties such as Google and your chosen AI
          provider. Your use of those services is subject to their terms and policies. We
          aren&rsquo;t responsible for third-party services, and their availability is
          outside our control.
        </p>
      </section>

      <section id="ip" className="doc-section">
        <h2>Intellectual property</h2>
        <p>
          The ZenScail name, logo, software, and design are owned by us and protected by
          intellectual-property laws. These terms don&rsquo;t grant you any right to use
          our branding without permission. All rights not expressly granted are reserved.
        </p>
      </section>

      <section id="disclaimers" className="doc-section">
        <h2>Disclaimers</h2>
        <p>
          The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;</strong> without warranties of any kind, whether express or
          implied, including merchantability, fitness for a particular purpose, and
          non-infringement. We don&rsquo;t warrant that the Service will be
          uninterrupted, error-free, or that AI output will be accurate.
        </p>
      </section>

      <section id="liability" className="doc-section">
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, ZenScail and its team will not be
          liable for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of data, profits, or goodwill. Our total liability for any
          claim relating to the Service will not exceed the greater of the amount you paid
          us in the 12 months before the claim, or USD&nbsp;50.
        </p>
      </section>

      <section id="termination" className="doc-section">
        <h2>Termination</h2>
        <p>
          You can stop using ZenScail and delete your account at any time. We may suspend
          or terminate your access if you violate these terms or if required for security
          or legal reasons. On termination, the licences you granted end, and we&rsquo;ll
          handle your data as described in our <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section id="changes" className="doc-section">
        <h2>Changes &amp; governing law</h2>
        <p>
          We may update these terms from time to time. For material changes we&rsquo;ll
          provide notice, and continued use after changes take effect means you accept the
          revised terms. These terms are governed by the laws applicable at ZenScail&rsquo;s
          principal place of business, without regard to conflict-of-law rules. Questions?
          Reach our legal team at <Mail address="support@zenscail.com" />.
        </p>
      </section>
    </DocShell>
  );
}
