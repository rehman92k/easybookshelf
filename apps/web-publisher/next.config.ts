import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@easybookshelf/ui', '@easybookshelf/api-client', '@easybookshelf/shared-types'],
};

export default nextConfig;
