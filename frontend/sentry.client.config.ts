/**
 * Sentry Client Configuration
 * Monitors errors in the browser (client-side)
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://2cb74e348ef90f11a9da965f8f66acb0@o4510363675197440.ingest.us.sentry.io/4510363726577664',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',

  // Release tracking
  // release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Ignore common errors that aren't actionable
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],

  // Sample rate for error events (1.0 = 100% of errors)
  sampleRate: 1.0,
});
