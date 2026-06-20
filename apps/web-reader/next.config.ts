import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@easybookshelf/ui',
    '@easybookshelf/api-client',
    '@easybookshelf/shared-types',
    'pdfjs-dist',
    'epubjs',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        pathname: '/b/**',
      },
    ],
  },
};

export default nextConfig;
