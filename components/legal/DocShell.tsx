import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DocToc, type TocItem } from "@/components/legal/DocToc";

/**
 * Side gutters for the doc pages. The base `.doc-layout` rule uses a `padding`
 * shorthand that zeroes the horizontal padding `.wrap` would otherwise give, so
 * on mobile the content hit the screen edge. We set it explicitly here:
 * 20px on phones, growing to 32px on desktop (matching `.wrap`).
 */
const DOC_GUTTER = {
  paddingLeft: "clamp(20px, 5vw, 32px)",
  paddingRight: "clamp(20px, 5vw, 32px)",
} as const;

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 6 9 6.5L21 6" />
    </svg>
  );
}

/** Small inline mailto link styled to match the doc theme. */
export function Mail({ address }: { address: string }) {
  return (
    <a className="doc-mail" href={`mailto:${address}`}>
      <MailIcon />
      {address}
    </a>
  );
}

/**
 * Shared chrome for every legal / company page: the site nav, an editorial
 * hero, a sticky scroll-spy table of contents, the page body, a closing
 * "get in touch" card, and the footer. Pages supply the TOC + the closing
 * contact details; the body sections are passed as children.
 */
export function DocShell({
  eyebrow,
  title,
  intro,
  updated,
  toc,
  contact,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  updated?: string;
  toc: TocItem[];
  contact: { heading: string; body: string; email: string };
  children: ReactNode;
}) {
  return (
    <>
      <Nav />
      <header className="doc-hero">
        <div className="wrap" style={DOC_GUTTER}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display">{title}</h1>
          <p className="lede">{intro}</p>
          {updated && (
            <span className="doc-updated">
              <ClockIcon />
              Last updated {updated}
            </span>
          )}
        </div>
      </header>

      <main className="wrap doc-layout" style={DOC_GUTTER}>
        <DocToc items={toc} />
        <div className="doc-content">
          {children}

          <section className="doc-contact">
            <div>
              <h3>{contact.heading}</h3>
              <p>{contact.body}</p>
            </div>
            <a className="doc-contact-mail" href={`mailto:${contact.email}`}>
              <MailIcon />
              {contact.email}
            </a>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
