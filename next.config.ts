import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg-boss"],
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
