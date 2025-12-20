/**
 * Sentry Client Configuration
 * ===========================
 *
 * This file configures the initialization of Sentry on the client (browser).
 * The config you add here will be used whenever a page is visited.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  // Capture 10% of transactions in production, 100% in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  // Capture 10% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable debug in development
  debug: process.env.NODE_ENV !== 'production',

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content and block all media
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      // Trace navigation and page loads
      enableInp: true,
    }),
  ],

  // Filter out sensitive data
  beforeSend(event: Sentry.ErrorEvent) {
    // Remove sensitive URL parameters
    if (event.request?.url) {
      const url = new URL(event.request.url);
      url.searchParams.delete('token');
      url.searchParams.delete('code');
      url.searchParams.delete('password');
      event.request.url = url.toString();
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    return event;
  },

  // Errors to ignore (expected behavior, not bugs)
  ignoreErrors: [
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'ChunkLoadError',

    // User-caused errors
    'AbortError',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',

    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,

    // Expected auth errors
    'Invalid token',
    'Token expired',
    'Session expired',
  ],

  // URLs to ignore
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,

    // Third party scripts
    /graph\.facebook\.com/i,
    /connect\.facebook\.net/i,
    /hotjar\.com/i,
    /analytics\.google\.com/i,
  ],
});
