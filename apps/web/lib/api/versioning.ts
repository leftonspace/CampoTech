/**
 * CampoTech API Versioning (Phase 6.3)
 * =====================================
 *
 * Utilities for API versioning, including:
 * - Version headers for all responses
 * - Versioned response helpers
 * - Deprecation notices
 * - Version detection from requests
 *
 * Current Version: 1
 * Supported Versions: [1]
 *
 * @example
 * ```typescript
 * import { versionedJson, API_VERSION } from '@/lib/api/versioning';
 *
 * export async function GET(request: NextRequest) {
 *   return versionedJson({ data: 'hello' });
 * }
 * ```
 */

import { NextResponse, type NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Current API version
 */
export const API_VERSION = '1';

/**
 * Supported API versions
 */
export const SUPPORTED_VERSIONS = ['1'] as const;

/**
 * Deprecated versions (will be removed in future)
 */
export const DEPRECATED_VERSIONS: string[] = [];

/**
 * Header names for versioning
 */
export const VERSION_HEADERS = {
  /** Response header indicating API version */
  API_VERSION: 'X-API-Version',
  /** Response header for deprecation warnings */
  API_DEPRECATED: 'X-API-Deprecated',
  /** Response header for sunset date */
  SUNSET: 'Sunset',
  /** Request header for requested version */
  ACCEPT_VERSION: 'Accept-Version',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect API version from request
 *
 * Priority:
 * 1. URL path (/api/v1/..., /api/v2/...)
 * 2. Accept-Version header
 * 3. Default to current version
 */
export function detectApiVersion(request: NextRequest): string {
  const { pathname } = request.nextUrl;

  // Check URL path for version
  const pathMatch = pathname.match(/\/api\/v(\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Check Accept-Version header
  const headerVersion = request.headers.get(VERSION_HEADERS.ACCEPT_VERSION);
  if (headerVersion && SUPPORTED_VERSIONS.includes(headerVersion as typeof SUPPORTED_VERSIONS[number])) {
    return headerVersion;
  }

  // Default to current version
  return API_VERSION;
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version as typeof SUPPORTED_VERSIONS[number]);
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  return DEPRECATED_VERSIONS.includes(version);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONED RESPONSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard versioned headers for API responses
 */
export function getVersionHeaders(version: string = API_VERSION): Record<string, string> {
  const headers: Record<string, string> = {
    [VERSION_HEADERS.API_VERSION]: version,
  };

  // Add deprecation warning if applicable
  if (isVersionDeprecated(version)) {
    headers[VERSION_HEADERS.API_DEPRECATED] = 'true';
    // headers[VERSION_HEADERS.SUNSET] = '2025-12-31'; // Set actual sunset date
  }

  return headers;
}

/**
 * Create a versioned JSON response
 *
 * @param data - Response data
 * @param init - Optional response init (status, headers, etc.)
 * @param version - API version (defaults to current)
 *
 * @example
 * ```typescript
 * return versionedJson({ jobs: [...] });
 * return versionedJson({ error: 'Not found' }, { status: 404 });
 * ```
 */
export function versionedJson<T>(
  data: T,
  init?: ResponseInit,
  version: string = API_VERSION
): NextResponse<T> {
  const versionHeaders = getVersionHeaders(version);
  const existingHeaders = init?.headers || {};

  return NextResponse.json(data, {
    ...init,
    headers: {
      ...existingHeaders,
      ...versionHeaders,
    },
  });
}

/**
 * Create a versioned error response
 *
 * @param error - Error message or object
 * @param status - HTTP status code
 * @param version - API version
 */
export function versionedError(
  error: string | { message: string; code?: string; details?: unknown },
  status: number = 500,
  version: string = API_VERSION
): NextResponse {
  const errorBody = typeof error === 'string'
    ? { error, success: false }
    : { error: error.message, code: error.code, details: error.details, success: false };

  return versionedJson(errorBody, { status }, version);
}

/**
 * Create a 404 Not Found response
 */
export function versionedNotFound(
  message: string = 'Resource not found',
  version: string = API_VERSION
): NextResponse {
  return versionedError({ message, code: 'NOT_FOUND' }, 404, version);
}

/**
 * Create a 401 Unauthorized response
 */
export function versionedUnauthorized(
  message: string = 'Unauthorized',
  version: string = API_VERSION
): NextResponse {
  return versionedError({ message, code: 'UNAUTHORIZED' }, 401, version);
}

/**
 * Create a 403 Forbidden response
 */
export function versionedForbidden(
  message: string = 'Forbidden',
  version: string = API_VERSION
): NextResponse {
  return versionedError({ message, code: 'FORBIDDEN' }, 403, version);
}

/**
 * Create a 400 Bad Request response
 */
export function versionedBadRequest(
  message: string = 'Bad request',
  details?: unknown,
  version: string = API_VERSION
): NextResponse {
  return versionedError({ message, code: 'BAD_REQUEST', details }, 400, version);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add version headers to an existing response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: string = API_VERSION
): NextResponse {
  const headers = getVersionHeaders(version);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Check if a path is an API route
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Check if path should have version headers
 * Excludes health checks and webhooks which may have specific requirements
 */
export function shouldAddVersionHeaders(pathname: string): boolean {
  if (!isApiRoute(pathname)) return false;

  // Exclude specific paths
  const excludedPaths = [
    '/api/health',
    '/api/webhooks/',
  ];

  return !excludedPaths.some(path => pathname.startsWith(path));
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION INFO ENDPOINT DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get API version info for documentation endpoint
 */
export function getApiVersionInfo() {
  return {
    currentVersion: API_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    deprecatedVersions: DEPRECATED_VERSIONS,
    headers: {
      request: VERSION_HEADERS.ACCEPT_VERSION,
      response: VERSION_HEADERS.API_VERSION,
    },
    documentation: '/api/docs',
  };
}
