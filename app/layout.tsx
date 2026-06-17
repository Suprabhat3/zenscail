import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

const SITE_URL = "https://zenscail.com";
const TITLE = "ZenScail — Your day, already sorted.";
const DESCRIPTION =
  "ZenScail reads your inbox and calendar so you don't have to. Every morning, one calm brief: what matters, what can wait, and what's already handled for you. Free forever with your own API keys.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · ZenScail",
  },
  description: DESCRIPTION,
  applicationName: "ZenScail",
  category: "productivity",
  keywords: [
    "AI email",
    "AI email assistant",
    "AI email management",
    "email management app",
    "manage email and calendar",
    "AI inbox management",
    "AI calendar assistant",
    "AI scheduling assistant",
    "email and calendar app",
    "Gmail AI assistant",
    "Google Calendar AI",
    "daily email brief",
    "AI email summarization",
    "AI reply drafting",
    "inbox zero",
    "smart inbox",
    "email triage",
    "AI productivity app",
  ],
  authors: [{ name: "Suprabhat", url: "https://new.suprabhat.site" }],
  creator: "Suprabhat",
  publisher: "ZenScail",
  alternates: { canonical: "/" },
  verification: {
    // Set GOOGLE_SITE_VERIFICATION in the environment to emit the
    // <meta name="google-site-verification"> tag for Search Console.
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ZenScail",
    title: TITLE,
    description:
      "Inbox (3,481). Anxiety (immeasurable). ZenScail reads it all, drafts replies in your voice, guards your deep-work time, and hands you one calm morning brief. You bring the API key; we bring the peace.",
    locale: "en_US",
    images: [
      {
        url: "/og.webp",
        width: 1200,
        height: 630,
        alt: "ZenScail — your inbox and calendar, finally at peace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Therapy is expensive. Inbox zero is free (BYO API key). ZenScail turns a hundred unread emails into one calm morning brief — and replies in your voice while you touch grass.",
    images: ["/og.webp"],
    creator: "@suprabhat_3",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "ZenScail",
    statusBarStyle: "default",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

/**
 * Structured data (schema.org) so Google can render rich results and understand
 * what ZenScail is. Three linked nodes: the software app, the publishing org,
 * and the website itself (which exposes a sitewide search action).
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "ZenScail",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Email & Calendar Assistant",
      operatingSystem: "Web",
      url: SITE_URL,
      description: DESCRIPTION,
      featureList: [
        "AI priority inbox",
        "Daily AI brief of email and calendar",
        "AI reply drafting in your voice",
        "Natural-language email and calendar agent",
        "Smart inbox bundles",
        "Snooze, send later and undo send",
        "AI scheduling and booking links",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free forever with your own API key.",
      },
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "ZenScail",
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: ["https://twitter.com/suprabhat_3"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "ZenScail",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
};

export const viewport: Viewport = {
  // Fill the screen edge-to-edge on notched phones; our safe-area padding
  // (see globals.css) keeps content clear of the notch and home indicator.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF5EC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      {/* Browser extensions (e.g. ColorZilla) inject attributes like
          `cz-shortcut-listen` onto <body> before React hydrates, which trips a
          dev-only hydration mismatch warning. suppressHydrationWarning silences
          that one element without affecting real mismatches inside the app. */}
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          // Static, app-authored object — safe to inline as JSON-LD.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
