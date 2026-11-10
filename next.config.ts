import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Banking screens are per-user and fully dynamic, so we use the classic
  // dynamic rendering model instead of Cache Components.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
