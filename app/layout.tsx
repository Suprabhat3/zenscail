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
  keywords: [
    "email assistant",
    "AI email",
    "calendar assistant",
    "daily brief",
    "inbox zero",
    "AI scheduling",
    "email summarization",
    "productivity",
  ],
  authors: [{ name: "Suprabhat", url: "https://new.suprabhat.site" }],
  creator: "Suprabhat",
  alternates: { canonical: "/" },
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
  },
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
