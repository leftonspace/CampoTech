/**
 * Scope Check Middleware
 * ======================
 *
 * Middleware for checking if the authenticated API key/token has required scopes.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiRequestContext, ApiScope, API_SCOPES } from '../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Require specific scopes for an endpoint
 * @param requiredScopes - Array of scopes that are all required (AND logic)
 */
export function requireScopes(...requiredScopes: ApiScope[]) {
  return function scopeCheckMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context = (req as any).apiContext as ApiRequestContext | undefined;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const grantedScopes = new Set(context.scopes);

    // Check if all required scopes are present
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));

    if (missingScopes.length > 0) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `This endpoint requires the following scopes: ${requiredScopes.join(', ')}`,
          details: {
            required: requiredScopes,
            missing: missingScopes,
            granted: context.scopes,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require any one of the specified scopes (OR logic)
 * @param scopes - Array of scopes where at least one is required
 */
export function requireAnyScope(...scopes: ApiScope[]) {
  return function anyScopeCheckMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context = (req as any).apiContext as ApiRequestContext | undefined;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const grantedScopes = new Set(context.scopes);

    // Check if any required scope is present
    const hasRequiredScope = scopes.some((scope) => grantedScopes.has(scope));

    if (!hasRequiredScope) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `This endpoint requires at least one of the following scopes: ${scopes.join(', ')}`,
          details: {
            requiredAnyOf: scopes,
            granted: context.scopes,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Check if user has a specific scope (non-blocking, sets flag)
 */
export function checkScope(scope: ApiScope) {
  return function checkScopeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context = (req as any).apiContext as ApiRequestContext | undefined;

    if (context) {
      (req as any).hasScope = {
        ...(req as any).hasScope,
        [scope]: context.scopes.includes(scope),
      };
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCOPE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a scope grants a specific permission
 */
export function scopeGrantsPermission(
  grantedScopes: string[],
  requiredScope: ApiScope
): boolean {
  const scopeSet = new Set(grantedScopes);

  // Direct match
  if (scopeSet.has(requiredScope)) return true;

  // Check for wildcard scopes (e.g., write:* includes read:*)
  const [action, resource] = requiredScope.split(':');

  // write:resource implies read:resource
  if (action === 'read' && scopeSet.has(`write:${resource}`)) return true;

  // Check for admin/full scope
  if (scopeSet.has('admin') || scopeSet.has('*')) return true;

  return false;
}

/**
 * Get human-readable description for a scope
 */
export function getScopeDescription(scope: string): string {
  return API_SCOPES[scope as ApiScope] || scope;
}

/**
 * Parse scope string (space-separated) into array
 */
export function parseScopeString(scopeString: string): string[] {
  return scopeString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validate that all scopes are valid
 */
export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
  const validScopes = new Set(Object.keys(API_SCOPES));
  const invalidScopes = scopes.filter((s) => !validScopes.has(s));

  return {
    valid: invalidScopes.length === 0,
    invalid: invalidScopes,
  };
}

/**
 * Get all available scopes
 */
export function getAllScopes(): Array<{ scope: string; description: string }> {
  return Object.entries(API_SCOPES).map(([scope, description]) => ({
    scope,
    description,
  }));
}

/**
 * Get scopes grouped by resource
 */
export function getScopesGrouped(): Record<string, Array<{ scope: string; description: string }>> {
  const grouped: Record<string, Array<{ scope: string; description: string }>> = {};

  for (const [scope, description] of Object.entries(API_SCOPES)) {
    const [, resource] = scope.split(':');
    if (!grouped[resource]) {
      grouped[resource] = [];
    }
    grouped[resource].push({ scope, description });
  }

  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON SCOPE COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const SCOPE_PRESETS = {
  // Read-only access to all resources
  readOnly: [
    'read:customers',
    'read:jobs',
    'read:invoices',
    'read:payments',
    'read:technicians',
    'read:services',
    'read:inventory',
  ] as ApiScope[],

  // Full access to customers
  customersFullAccess: [
    'read:customers',
    'write:customers',
    'delete:customers',
  ] as ApiScope[],

  // Full access to jobs
  jobsFullAccess: [
    'read:jobs',
    'write:jobs',
    'delete:jobs',
  ] as ApiScope[],

  // Billing access
  billingAccess: [
    'read:invoices',
    'write:invoices',
    'read:payments',
    'write:payments',
  ] as ApiScope[],

  // Integration access (for typical integrations)
  integrationAccess: [
    'read:customers',
    'write:customers',
    'read:jobs',
    'write:jobs',
    'read:invoices',
    'read:webhooks',
    'write:webhooks',
  ] as ApiScope[],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS ROUTER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply read scope for GET endpoints
 */
export function readScope(resource: string) {
  return requireScopes(`read:${resource}` as ApiScope);
}

/**
 * Apply write scope for POST/PUT/PATCH endpoints
 */
export function writeScope(resource: string) {
  return requireScopes(`write:${resource}` as ApiScope);
}

/**
 * Apply delete scope for DELETE endpoints
 */
export function deleteScope(resource: string) {
  return requireScopes(`delete:${resource}` as ApiScope);
}
