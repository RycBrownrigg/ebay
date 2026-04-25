import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@ebay/shared'],
  webpack: (cfg) => {
    cfg.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return cfg;
  },
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:3001/api/:path*',
            },
          ];
        },
      }
    : {}),
};

export default config;
