/**
 * Request Instrumentation Middleware (Phase 8.2.1)
 * =================================================
 *
 * Automatic HTTP request instrumentation for metrics collection.
 * Tracks request latency, status codes, and active users.
 *
 * Usage:
 * Add to middleware.ts:
 * ```typescript
 * import { instrumentRequest } from '@/lib/monitoring/request-instrumentation';
 *
 * export async function middleware(request: NextRequest) {
 *   const start = Date.now();
 *   const response = await NextResponse.next();
 *
 *   // Instrument after response
 *   instrumentRequest({
 *     method: request.method,
 *     path: request.nextUrl.pathname,
 *     status: response.status,
 *     duration: Date.now() - start,
 *     userId: // extract from session
 *   });
 *
 *   return response;
 * }
 * ```
 */

import { recordRequestLatency, recordActiveUser } from './business-metrics';

interface RequestData {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: string;
}

/**
 * Normalize route path for metric labeling
 * Replaces dynamic segments with placeholders
 */
function normalizeRoute(path: string): string {
  // Skip static assets and internal paths
  if (path.startsWith('/_next/') || path.startsWith('/static/')) {
    return path;
  }

  // Replace common dynamic segments with placeholders
  return path
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Tokens (alphanumeric strings longer than 20 chars)
    .replace(/\/[a-zA-Z0-9]{20,}/g, '/:token')
    // Organization IDs (org_ prefix)
    .replace(/\/org_[a-zA-Z0-9]+/g, '/:orgId')
    // User IDs (user_ prefix)
    .replace(/\/user_[a-zA-Z0-9]+/g, '/:userId');
}

/**
 * Instrument an HTTP request for metrics collection
 */
export async function instrumentRequest(data: RequestData): Promise<void> {
  const { method, path, status, duration, userId } = data;

  // Skip instrumentation for metrics endpoint itself
  if (path === '/api/monitoring/metrics') {
    return;
  }

  // Normalize route for consistent metric labels
  const route = normalizeRoute(path);

  // Record request latency
  await recordRequestLatency(duration, {
    method,
    route,
    status,
  });

  // Record active user if authenticated
  if (userId) {
    await recordActiveUser(userId);
  }
}

/**
 * Create a request timer for manual instrumentation
 */
export function createRequestTimer(method: string, path: string) {
  const start = Date.now();

  return async (status: number, userId?: string) => {
    await instrumentRequest({
      method,
      path,
      status,
      duration: Date.now() - start,
      userId,
    });
  };
}

/**
 * Higher-order function to wrap API handlers with instrumentation
 */
export function withInstrumentation<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  options: { path: string }
): T {
  return (async (...args: Parameters<T>) => {
    const start = Date.now();
    let status = 200;

    try {
      const response = await handler(...args);
      status = response.status;
      return response;
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      const request = args[0] as { method?: string };
      await instrumentRequest({
        method: request?.method || 'GET',
        path: options.path,
        status,
        duration: Date.now() - start,
      });
    }
  }) as T;
}

export default instrumentRequest;
