import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only needs Node + the traced deps, not the full repo.
  output: "standalone",
  experimental: {
    serverActions: {
      // Compose sends carry attachment bytes (base64) as a Server Action arg.
      // The default 1MB cap would reject them; allow up to the 20MB total
      // attachment limit plus base64 (~33%) inflation and body overhead.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
