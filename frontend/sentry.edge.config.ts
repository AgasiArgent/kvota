/**
 * Sentry Edge Configuration
 * Monitors errors in Edge Runtime (middleware, edge functions)
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://2cb74e348ef90f11a9da965f8f66acb0@o4510363675197440.ingest.us.sentry.io/4510363726577664',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',

  // Sample rate for error events
  sampleRate: 1.0,
});
