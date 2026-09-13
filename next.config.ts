import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'resources.premierleague.com',
        pathname: '/premierleague/photos/players/**',
      },
      {
        protocol: 'https',
        hostname: 'fantasy.premierleague.com',
        pathname: '/dist/img/shirts/standard/**',
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
