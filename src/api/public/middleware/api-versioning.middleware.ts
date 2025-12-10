/**
 * API Versioning Middleware
 * =========================
 *
 * Handles API versioning via URL path (/v1/, /v2/, etc.)
 * and provides version deprecation warnings.
 */

import { Request, Response, NextFunction, Router } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiVersionConfig {
  version: string;
  isLatest: boolean;
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  router: Router;
}

const API_VERSIONS: Map<string, ApiVersionConfig> = new Map();
let latestVersion = 'v1';

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register an API version
 */
export function registerApiVersion(config: ApiVersionConfig): void {
  API_VERSIONS.set(config.version, config);

  if (config.isLatest) {
    latestVersion = config.version;
  }
}

/**
 * Get router for a specific version
 */
export function getVersionRouter(version: string): Router | undefined {
  return API_VERSIONS.get(version)?.router;
}

/**
 * Get all registered versions
 */
export function getAllVersions(): ApiVersionConfig[] {
  return Array.from(API_VERSIONS.values());
}

/**
 * Get latest version
 */
export function getLatestVersion(): string {
  return latestVersion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Version extraction middleware
 * Extracts API version from URL path
 */
export function versionExtractionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract version from path (e.g., /v1/customers -> v1)
  const pathMatch = req.path.match(/^\/(v\d+)\//);

  if (pathMatch) {
    const version = pathMatch[1];
    (req as any).apiVersion = version;

    // Add version to response headers
    res.setHeader('X-API-Version', version);
  } else {
    // Default to latest version
    (req as any).apiVersion = latestVersion;
    res.setHeader('X-API-Version', latestVersion);
  }

  next();
}

/**
 * Version validation middleware
 * Returns 404 for unknown versions
 */
export function versionValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const version = (req as any).apiVersion as string;

  if (!API_VERSIONS.has(version)) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INVALID_API_VERSION',
        message: `API version '${version}' is not supported.`,
        details: {
          supportedVersions: Array.from(API_VERSIONS.keys()),
          latestVersion,
        },
      },
    });
    return;
  }

  next();
}

/**
 * Deprecation warning middleware
 * Adds warning headers for deprecated versions
 */
export function deprecationWarningMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const version = (req as any).apiVersion as string;
  const versionConfig = API_VERSIONS.get(version);

  if (versionConfig?.isDeprecated) {
    // Add deprecation headers
    res.setHeader('Deprecation', 'true');

    if (versionConfig.deprecationDate) {
      res.setHeader(
        'Deprecation',
        `@${versionConfig.deprecationDate.toISOString()}`
      );
    }

    if (versionConfig.sunsetDate) {
      res.setHeader('Sunset', versionConfig.sunsetDate.toISOString());
    }

    // Add Link header pointing to newer version
    const newerVersion = getLatestVersion();
    if (newerVersion !== version) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.setHeader(
        'Link',
        `<${baseUrl}/api/${newerVersion}>; rel="successor-version"`
      );
    }

    // Add warning header
    const warningMessage = versionConfig.sunsetDate
      ? `API version ${version} is deprecated and will be removed on ${versionConfig.sunsetDate.toDateString()}. Please migrate to ${latestVersion}.`
      : `API version ${version} is deprecated. Please migrate to ${latestVersion}.`;

    res.setHeader('Warning', `299 - "${warningMessage}"`);
  }

  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a versioned API router that handles all versions
 */
export function createVersionedRouter(): Router {
  const router = Router();

  // Apply version extraction
  router.use(versionExtractionMiddleware);

  // Route to appropriate version
  router.use('/:version/*', (req, res, next) => {
    const version = req.params.version;
    const versionConfig = API_VERSIONS.get(version);

    if (!versionConfig) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_API_VERSION',
          message: `API version '${version}' is not supported.`,
          details: {
            supportedVersions: Array.from(API_VERSIONS.keys()),
            latestVersion,
          },
        },
      });
      return;
    }

    // Add deprecation warnings
    if (versionConfig.isDeprecated) {
      deprecationWarningMiddleware(req, res, () => {});
    }

    // Forward to version router
    const versionRouter = versionConfig.router;
    req.url = req.url.replace(`/${version}`, '');
    versionRouter(req, res, next);
  });

  // Handle requests without version (redirect to latest)
  router.use((req, res, next) => {
    if (!req.path.match(/^\/v\d+\//)) {
      // Redirect to latest version
      const redirectUrl = `/api/${latestVersion}${req.path}`;
      res.redirect(307, redirectUrl);
      return;
    }
    next();
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION INFO ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handler for /api/versions endpoint
 */
export function versionsEndpointHandler(req: Request, res: Response): void {
  const versions = getAllVersions().map((v) => ({
    version: v.version,
    isLatest: v.isLatest,
    isDeprecated: v.isDeprecated,
    deprecationDate: v.deprecationDate?.toISOString(),
    sunsetDate: v.sunsetDate?.toISOString(),
    url: `/api/${v.version}`,
  }));

  res.json({
    success: true,
    data: {
      latestVersion,
      versions,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return API_VERSIONS.has(version);
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  return API_VERSIONS.get(version)?.isDeprecated ?? false;
}

/**
 * Check if a version will be sunset
 */
export function isVersionSunset(version: string): boolean {
  const config = API_VERSIONS.get(version);
  if (!config?.sunsetDate) return false;
  return config.sunsetDate < new Date();
}

/**
 * Get days until sunset for a version
 */
export function getDaysUntilSunset(version: string): number | null {
  const config = API_VERSIONS.get(version);
  if (!config?.sunsetDate) return null;

  const now = new Date();
  const sunset = config.sunsetDate;
  const diffMs = sunset.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
