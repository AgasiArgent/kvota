/**
 * Sentry Server Configuration
 * Monitors errors during server-side rendering (SSR)
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://5adbfed9bc4e004e0091970bd8ea1fca@o4510363675197440.ingest.us.sentry.io/4510363703115776',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',

  // Sample rate for error events (1.0 = 100% of errors)
  sampleRate: 1.0,
});
