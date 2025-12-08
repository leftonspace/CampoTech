/**
 * Sentry Configuration
 * ====================
 *
 * Error tracking and performance monitoring with Sentry
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  debug: boolean;
}

const DEFAULT_CONFIG: SentryConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || `campotech@${process.env.npm_package_version}`,
  sampleRate: 1.0,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV !== 'production',
};

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function initSentry(config?: Partial<SentryConfig>): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.dsn) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: finalConfig.dsn,
    environment: finalConfig.environment,
    release: finalConfig.release,
    sampleRate: finalConfig.sampleRate,
    tracesSampleRate: finalConfig.tracesSampleRate,
    profilesSampleRate: finalConfig.profilesSampleRate,
    debug: finalConfig.debug,

    integrations: [
      // Enable HTTP instrumentation
      new Sentry.Integrations.Http({ tracing: true }),

      // Enable Express instrumentation
      new Sentry.Integrations.Express(),

      // Enable Prisma instrumentation
      new Sentry.Integrations.Prisma(),

      // Enable profiling
      new ProfilingIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            delete breadcrumb.data.password;
            delete breadcrumb.data.token;
            delete breadcrumb.data.accessToken;
            delete breadcrumb.data.refreshToken;
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Filter transactions
    beforeSendTransaction(event) {
      // Don't trace health checks
      if (event.transaction?.includes('/health')) {
        return null;
      }

      // Don't trace metrics endpoint
      if (event.transaction?.includes('/metrics')) {
        return null;
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Ignore network errors
      'Network request failed',
      'Failed to fetch',
      'NetworkError',

      // Ignore user-caused errors
      'AbortError',
      'ResizeObserver loop limit exceeded',

      // Ignore expected auth errors
      'Invalid token',
      'Token expired',
    ],
  });

  console.log(`[Sentry] Initialized for environment: ${finalConfig.environment}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CAPTURING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capture an exception with context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; email?: string };
    level?: Sentry.SeverityLevel;
  }
): string {
  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
    level: context?.level,
  });
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string {
  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  email?: string;
  organizationId?: string;
  role?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    role: user.role,
  } as Sentry.User);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAGS & CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set a tag on all future events
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Set extra context
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Set context for a specific category
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS & SPANS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start a new transaction
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Create a span within a transaction
 */
export function createSpan(
  transaction: Sentry.Transaction,
  op: string,
  description: string
): Sentry.Span {
  return transaction.startChild({
    op,
    description,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREADCRUMBS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLUSH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Flush pending events before shutdown
 */
export async function flush(timeout: number = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close the Sentry client
 */
export async function close(timeout: number = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Sentry request handler middleware
 */
export function getRequestHandler(): ReturnType<typeof Sentry.Handlers.requestHandler> {
  return Sentry.Handlers.requestHandler();
}

/**
 * Get Sentry tracing handler middleware
 */
export function getTracingHandler(): ReturnType<typeof Sentry.Handlers.tracingHandler> {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Get Sentry error handler middleware
 */
export function getErrorHandler(): ReturnType<typeof Sentry.Handlers.errorHandler> {
  return Sentry.Handlers.errorHandler();
}
