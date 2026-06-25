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
  { id: "refunds", title: "Cancellation & refunds" },
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
      updated="June 17, 2026"
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
          <li>You must be at least 18 years old, and able to form a binding contract, to use ZenScail.</li>
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
        <p>ZenScail is offered on two plans:</p>
        <ul>
          <li>
            <strong>ZenScail Free (bring your own key)</strong> — ₹0. You get every
            feature and connect your own AI provider key. You pay nothing to us; any model
            usage is billed to you directly by your AI provider.
          </li>
          <li>
            <strong>ZenScail Cloud</strong> — a paid subscription where we provide the AI
            models, so there are no keys to manage and AI usage is included.
          </li>
        </ul>

        <h3>Cloud price &amp; billing cycle</h3>
        <ul>
          <li>
            ZenScail Cloud costs <strong>₹749 per month</strong> during our launch period
            — a 25% discount off the ₹999 list price. The price shown at checkout is the
            price that applies, and is <strong>inclusive of applicable taxes (including
            GST)</strong> unless stated otherwise.
          </li>
          <li>
            The launch discount is promotional and may end at any time. If it does, your
            renewal price will change to the then-current price, but only after we give you
            advance notice (see below).
          </li>
          <li>
            The subscription is <strong>monthly and renews automatically</strong>. By
            subscribing, you authorise us and our payment processor to charge your selected
            payment method for each billing cycle, in advance, until you cancel.
          </li>
        </ul>

        <h3>Payments</h3>
        <p>
          Payments for ZenScail Cloud are processed securely by{" "}
          <strong>Razorpay</strong>, our third-party payment processor, who sets up the
          recurring mandate (auto-pay) for your subscription. We do <strong>not</strong>{" "}
          receive or store your full card or bank details — those are handled by Razorpay
          under its own terms and security standards. Your use of Razorpay is subject to
          Razorpay&rsquo;s terms and privacy policy.
        </p>

        <h3>Failed or declined payments</h3>
        <p>
          If a renewal payment fails or your mandate is revoked, we may retry the charge
          and, if it still cannot be collected, suspend or downgrade your Cloud access
          until payment succeeds. You can keep using ZenScail Free with your own AI key at
          any time.
        </p>

        <h3>Price changes</h3>
        <p>
          We&rsquo;ll give you reasonable advance notice (by email or in the app) before
          any change to your recurring price takes effect. If you don&rsquo;t agree to a
          new price, you can cancel before it applies; continuing your subscription after
          the change means you accept the new price.
        </p>

        <div className="doc-callout sage">
          <p>
            <strong>On the Free plan, AI costs are not ours to bill.</strong> Because the
            AI runs on your own key, model usage is billed to you by your AI provider
            directly. ZenScail charges you only for the Cloud subscription, if you choose
            it.
          </p>
        </div>
      </section>

      <section id="refunds" className="doc-section">
        <h2>Cancellation &amp; refunds</h2>
        <h3>Cancelling</h3>
        <p>
          You can cancel ZenScail Cloud at any time from{" "}
          <strong>Settings → Billing</strong>. When you cancel:
        </p>
        <ul>
          <li>Your subscription stops renewing — you won&rsquo;t be charged again.</li>
          <li>
            You <strong>keep Cloud access until the end of the period you&rsquo;ve already
            paid for</strong>. After that date, your account moves to ZenScail Free, where
            you can continue using ZenScail with your own AI key.
          </li>
          <li>
            Your renewal date and remaining days are always shown on the Billing page.
          </li>
        </ul>

        <h3>Refunds</h3>
        <p>
          Subscription fees are <strong>non-refundable</strong>, except where a refund is
          required by applicable law. In particular:
        </p>
        <ul>
          <li>
            We don&rsquo;t provide prorated or partial refunds for the unused part of a
            billing period when you cancel mid-cycle — instead, you keep access until the
            period ends.
          </li>
          <li>
            We don&rsquo;t refund a renewal simply because you forgot to cancel before it
            charged, though you&rsquo;re welcome to cancel to prevent the next renewal.
          </li>
        </ul>
        <p>
          If you believe you were charged in error or have a billing concern, contact us at{" "}
          <Mail address="support@zenscail.com" />{" "}and we&rsquo;ll look into it promptly and in good faith.
     
        </p>
      </section>

      <section id="third-party" className="doc-section">
        <h2>Third-party services</h2>
        <p>
          The Service integrates with third parties such as Google and your chosen AI
          provider. To connect to those services and let our AI assistant act on your
          behalf, ZenScail relies on <strong>Corsair</strong> (corsair.dev), an
          integration and agentic-tooling platform that manages the authorised connection
          to your accounts and executes the email and calendar operations you request.
          Your use of Corsair, Google, and any AI provider is subject to their respective
          terms and policies. We aren&rsquo;t responsible for third-party services, and
          their availability is outside our control.
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
          revised terms.
        </p>
        <p>
          These terms are governed by the laws of <strong>India</strong>, without regard to
          conflict-of-law rules, and the courts of India will have jurisdiction over any
          dispute arising from them or from your use of the Service.
        </p>
        <p>
          For any questions, complaints, or grievances about the Service — including issues
          covered by India&rsquo;s Information Technology Act and the Digital Personal Data
          Protection Act — you can reach us at <Mail address="support@zenscail.com" />. We
          aim to acknowledge grievances within a reasonable time and resolve them as
          required by applicable law.
        </p>
      </section>
    </DocShell>
  );
}
