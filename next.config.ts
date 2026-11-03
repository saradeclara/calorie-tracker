import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shown in Settings so you can tell which deploy your phone is running.
  env: {
    NEXT_PUBLIC_BUILD: `${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  },
  cacheComponents: true,
  experimental: {
    // Only bundle the icons actually used.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera is needed for barcode scanning, on this origin only.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
