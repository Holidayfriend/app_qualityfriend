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
  outputFileTracingIncludes: {
    "/api/recruiting/applications/[id]/ai-score": [
      "./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
