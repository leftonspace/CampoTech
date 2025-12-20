/**
 * Sentry Server Configuration
 * ===========================
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  // Capture 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable debug in development
  debug: process.env.NODE_ENV !== 'production',

  // Integrations
  integrations: [
    // Prisma instrumentation
    Sentry.prismaIntegration(),
  ],

  // Filter sensitive data before sending
  beforeSend(event: Sentry.ErrorEvent) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
      delete event.request.headers['x-forwarded-for'];
    }

    // Remove sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb: Sentry.Breadcrumb) => {
        if (breadcrumb.data) {
          const sensitiveFields = [
            'password',
            'token',
            'accessToken',
            'refreshToken',
            'secret',
            'apiKey',
            'cuit',
            'cbu',
            'dni',
          ];

          for (const field of sensitiveFields) {
            if (field in breadcrumb.data) {
              breadcrumb.data[field] = '[REDACTED]';
            }
          }
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Filter transactions before sending
  beforeSendTransaction(event) {
    // Don't trace health checks
    if (event.transaction?.includes('/health')) {
      return null;
    }

    // Don't trace metrics endpoint
    if (event.transaction?.includes('/api/metrics')) {
      return null;
    }

    // Don't trace static files
    if (event.transaction?.includes('/_next/')) {
      return null;
    }

    return event;
  },

  // Errors to ignore
  ignoreErrors: [
    // Expected auth errors
    'Invalid token',
    'Token expired',
    'Unauthorized',

    // Rate limiting (expected)
    'Rate limit exceeded',
    'Too many requests',

    // Network errors (transient)
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],
});
