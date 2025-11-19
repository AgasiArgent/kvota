import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: 'kvota',
  project: 'javascript-nextjs',
};

// Export config wrapped with Sentry
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
