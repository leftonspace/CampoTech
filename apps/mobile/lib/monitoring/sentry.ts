/**
 * Sentry Configuration for Mobile App
 * ====================================
 *
 * Error tracking and performance monitoring with Sentry.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Get DSN from environment
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || '';

/**
 * Initialize Sentry for the mobile app
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

      // Remove sensitive breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'phone'];
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

    // Errors to ignore
    ignoreErrors: [
      // Network errors (transient)
      'Network request failed',
      'Failed to fetch',
      'NetworkError',

      // User cancelled actions
      'AbortError',
      'User cancelled',

      // Expected auth errors
      'Invalid token',
      'Token expired',
    ],

    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });

  console.log('[Sentry] Initialized for mobile app');
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  phone?: string;
  organizationId?: string;
  role?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    username: user.phone,
    // Don't include phone directly - use username instead
  });

  if (user.organizationId) {
    Sentry.setTag('organization_id', user.organizationId);
  }

  if (user.role) {
    Sentry.setTag('user_role', user.role);
  }
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
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
  });
}

/**
 * Wrap a component with Sentry error boundary
 */
export const withSentry = Sentry.wrap;

/**
 * Export Sentry for advanced usage
 */
export { Sentry };
