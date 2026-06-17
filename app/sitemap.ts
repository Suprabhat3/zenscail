import type { MetadataRoute } from "next";

const SITE_URL = "https://zenscail.com";

/**
 * Sitemap for the public, indexable surface only — the marketing landing page
 * and the legal/info pages. The authenticated app (mail/calendar/dashboard/etc.)
 * is intentionally excluded (and disallowed in robots.ts) since it sits behind
 * auth and offers nothing to rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/founder`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/security`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return pages.map((entry) => ({ ...entry, lastModified }));
}
