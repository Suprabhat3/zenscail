import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only needs Node + the traced deps, not the full repo.
  output: "standalone",
  experimental: {
    serverActions: {
      // Compose sends carry attachment bytes (base64) as a Server Action arg.
      // Attachments are capped at 40KB (Corsair's /run body limit), so the
      // payload stays small — a modest bump over the 1MB default is plenty.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
