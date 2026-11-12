import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/uploads/:folder/:file", destination: "/api/files/:folder/:file" },
      ],
    };
  },
  serverExternalPackages: ["pg-boss", "pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
