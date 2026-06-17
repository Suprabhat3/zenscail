import type { MetadataRoute } from "next";

/**
 * PWA manifest. Lets ZenScail be installed to the home screen and run
 * standalone (no browser chrome) — the app launches into the dashboard.
 * Icons/theme are pulled from the existing assets in /public.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZenScail — your day, already sorted",
    short_name: "ZenScail",
    description:
      "ZenScail reads your inbox and calendar so you don't have to — one calm daily brief, AI summaries, drafts in your voice, and protected focus time.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF5EC",
    theme_color: "#FAF5EC",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
