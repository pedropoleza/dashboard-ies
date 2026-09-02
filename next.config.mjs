import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        // Allow embedding inside GoHighLevel (and white-label) via Custom Menu Link iframe.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https:;" },
        ],
      },
    ];
  },
};

export default nextConfig;
