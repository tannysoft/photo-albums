import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project has its own lockfile; pin tracing root to silence the
  // multi-lockfile workspace-root inference warning.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["sharp", "archiver", "firebase-admin"],
  images: {
    remotePatterns: [
      // Allow R2 public/custom domains if NEXT_PUBLIC_R2_PUBLIC_BASE_URL is used.
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;
