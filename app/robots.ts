import type { MetadataRoute } from "next";

const SITE_URL = "https://zenscail.com";

/**
 * Tells crawlers to index the public marketing/legal pages but stay out of the
 * authenticated app, API routes, and per-user public booking links (which carry
 * no ranking value and shouldn't surface in search).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/mail",
        "/calendar",
        "/chat",
        "/settings",
        "/onboarding",
        "/connect",
        "/login",
        "/book/",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
