/**
 * Sentry Edge Configuration
 * =========================
 *
 * This file configures the initialization of Sentry for edge functions.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable debug in development
  debug: process.env.NODE_ENV !== 'production',

  // Filter sensitive data
  beforeSend(event: Sentry.ErrorEvent) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
