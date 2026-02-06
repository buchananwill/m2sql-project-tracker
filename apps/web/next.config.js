import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Transpile workspace packages
  transpilePackages: ['@m2sql/parser', '@m2sql/model', '@m2sql/supabase', '@m2sql/renderer'],

  // Set workspace root for proper file tracing
  // Note: standalone mode removed due to Windows symlink issues with pnpm
  outputFileTracingRoot: path.join(process.cwd(), '../../'),

  // Optimize Mantine imports
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
};

export default nextConfig;
