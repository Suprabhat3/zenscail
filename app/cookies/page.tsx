import type { Metadata } from "next";
import { DocShell, Mail } from "@/components/legal/DocShell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "The cookies ZenScail uses, why we use them, and how to control them. No advertising or cross-site tracking.",
  alternates: { canonical: "/cookies" },
};

const toc = [
  { id: "what", title: "What cookies are" },
  { id: "how-we-use", title: "How we use them" },
  { id: "types", title: "Types we set" },
  { id: "third-party", title: "Third-party cookies" },
  { id: "managing", title: "Managing cookies" },
  { id: "changes", title: "Changes" },
];

export default function CookiesPage() {
  return (
    <DocShell
      eyebrow="Legal"
      title="Cookie Policy"
      intro="We keep cookies to a minimum — just enough to sign you in, keep you secure, and understand what’s working. No advertising, no cross-site tracking."
      updated="June 13, 2026"
      toc={toc}
      contact={{
        heading: "Questions about cookies?",
        body: "Our privacy team can explain anything on this page or help you exercise your choices.",
        email: "support@zenscail.com",
      }}
    >
      <section id="what" className="doc-section">
        <h2>What cookies are</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website.
          They let a site remember your actions and preferences over time. We also use
          similar technologies such as local storage; we refer to all of them as
          &ldquo;cookies&rdquo; here.
        </p>
      </section>

      <section id="how-we-use" className="doc-section">
        <h2>How we use them</h2>
        <p>
          We use cookies to keep you signed in, protect your session against fraud, and
          measure aggregate usage so we can improve the Service. We don&rsquo;t use them
          to build advertising profiles or track you across other websites.
        </p>
      </section>

      <section id="types" className="doc-section">
        <h2>Types we set</h2>
        <ul>
          <li><strong>Strictly necessary</strong> — authentication and session security. The Service can&rsquo;t function without these, so they can&rsquo;t be switched off.</li>
          <li><strong>Preferences</strong> — remembering choices like your display settings so the app feels consistent.</li>
          <li><strong>Analytics</strong> — privacy-respecting, aggregated measurement of how features are used. These help us decide what to improve.</li>
        </ul>
      </section>

      <section id="third-party" className="doc-section">
        <h2>Third-party cookies</h2>
        <p>
          Signing in with Google may involve cookies set by Google as part of the OAuth
          flow, governed by Google&rsquo;s own policies. We don&rsquo;t embed advertising
          networks or social-media tracking pixels.
        </p>
      </section>

      <section id="managing" className="doc-section">
        <h2>Managing cookies</h2>
        <p>
          You can control or delete cookies through your browser settings, and set most
          browsers to block them. Note that blocking strictly necessary cookies will
          prevent you from signing in and using ZenScail. Disabling analytics cookies has
          no effect on functionality.
        </p>
      </section>

      <section id="changes" className="doc-section">
        <h2>Changes</h2>
        <p>
          We&rsquo;ll update this policy if our use of cookies changes and revise the date
          above. Questions can go to <Mail address="support@zenscail.com" />.
        </p>
      </section>
    </DocShell>
  );
}
