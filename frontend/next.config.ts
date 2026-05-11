import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://cortexa-api-868473990276.asia-south1.run.app/:path*',
      },
    ];
  },
};

export default nextConfig;
