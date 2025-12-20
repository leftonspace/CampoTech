/**
 * CampoTech API Utilities (Phase 6.3)
 * ====================================
 *
 * Central exports for API utilities:
 * - Versioning helpers
 * - OpenAPI specification
 * - Response helpers
 */

export {
  // Version configuration
  API_VERSION,
  SUPPORTED_VERSIONS,
  DEPRECATED_VERSIONS,
  VERSION_HEADERS,

  // Version detection
  detectApiVersion,
  isVersionSupported,
  isVersionDeprecated,

  // Versioned response helpers
  versionedJson,
  versionedError,
  versionedNotFound,
  versionedUnauthorized,
  versionedForbidden,
  versionedBadRequest,

  // Middleware helpers
  addVersionHeaders,
  getVersionHeaders,
  isApiRoute,
  shouldAddVersionHeaders,

  // Version info
  getApiVersionInfo,
} from './versioning';

export {
  // OpenAPI
  generateOpenAPISpec,
  getOpenAPISpecJson,
  type OpenAPISpec,
} from './openapi';
