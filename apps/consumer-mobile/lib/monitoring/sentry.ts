/**
 * Sentry Configuration for Consumer Mobile App
 * =============================================
 *
 * Error tracking and performance monitoring with Sentry.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Get DSN from environment
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || '';

/**
 * Initialize Sentry for the consumer mobile app
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment based on Expo release channel
    environment: Constants.expoConfig?.extra?.environment || __DEV__ ? 'development' : 'production',

    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    // Enable debug in development
    debug: __DEV__,

    // Enable native crash reporting
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      return event;
    },

    // Errors to ignore
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      'User cancelled',
    ],

    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });

  console.log('[Sentry] Initialized for consumer app');
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; phone?: string }): void {
  Sentry.setUser({
    id: user.id,
    username: user.phone,
  });
}

/**
 * Clear user context on logout
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Wrap a component with Sentry error boundary
 */
export const withSentry = Sentry.wrap;

export { Sentry };
