import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://lifeos-ai-production-ceea.up.railway.app/:path*',
      },
    ];
  },
};

export default nextConfig;
