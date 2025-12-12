/**
 * CampoTech Tier Enforcement Middleware
 * ======================================
 *
 * Middleware for enforcing subscription tier limits on API endpoints.
 * Checks limits before allowing resource creation/modification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { usageTracker, LimitExceededError } from '@/lib/services/usage-tracker';
import { LimitType } from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TierEnforcementOptions {
  limitType: LimitType;
  getAmount?: (request: NextRequest) => number | Promise<number>;
  getJobId?: (request: NextRequest) => string | Promise<string>; // For photo limits
  skipCheck?: (request: NextRequest) => boolean | Promise<boolean>;
}

export interface EnforcementResult {
  allowed: boolean;
  error?: LimitExceededError;
  warning?: {
    isApproaching: boolean;
    currentValue: number;
    limitValue: number;
    percentage: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIMIT EXCEEDED RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a 402 Payment Required response for limit exceeded
 */
export function createLimitExceededResponse(error: LimitExceededError): NextResponse {
  return NextResponse.json(error, { status: 402 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENFORCEMENT MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check tier limit before processing request
 * Use in API route handlers before creating/modifying resources
 */
export async function enforceTierLimit(
  request: NextRequest,
  options: TierEnforcementOptions
): Promise<EnforcementResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { allowed: true }; // Let auth middleware handle this
    }

    // Skip check if specified
    if (options.skipCheck && await options.skipCheck(request)) {
      return { allowed: true };
    }

    const orgId = session.organizationId;
    const amount = options.getAmount ? await options.getAmount(request) : 1;

    // Special handling for photos per job
    if (options.limitType === 'photos_per_job' && options.getJobId) {
      const jobId = await options.getJobId(request);
      const result = await usageTracker.checkJobPhotoLimit(orgId, jobId, amount);

      if (!result.allowed) {
        return {
          allowed: false,
          error: usageTracker.createLimitExceededResponse(result),
        };
      }

      return { allowed: true };
    }

    // Check standard limit
    const result = await usageTracker.checkLimit(orgId, options.limitType, amount);

    if (!result.allowed) {
      return {
        allowed: false,
        error: usageTracker.createLimitExceededResponse(result),
      };
    }

    // Return warning if approaching limit
    if (result.isApproaching) {
      return {
        allowed: true,
        warning: {
          isApproaching: true,
          currentValue: result.currentValue,
          limitValue: result.limitValue,
          percentage: Math.round((result.currentValue / result.limitValue) * 100),
        },
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Tier enforcement error:', error);
    // Fail open - don't block on errors
    return { allowed: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHER-ORDER FUNCTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap an API route handler with tier enforcement
 */
export function withTierEnforcement<T = Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>,
  options: TierEnforcementOptions
): (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const result = await enforceTierLimit(request, options);

    if (!result.allowed && result.error) {
      return createLimitExceededResponse(result.error);
    }

    // Execute original handler
    const response = await handler(request, context);

    // Add warning header if approaching limit
    if (result.warning) {
      response.headers.set(
        'X-Tier-Warning',
        JSON.stringify({
          approaching_limit: true,
          limit_type: options.limitType,
          current: result.warning.currentValue,
          limit: result.warning.limitValue,
          percentage: result.warning.percentage,
        })
      );
    }

    return response;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE CHECKERS FOR COMMON ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check user creation limit
 */
export async function checkUserLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'users');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check job creation limit
 */
export async function checkJobLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'jobs_monthly');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check customer creation limit
 */
export async function checkCustomerLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'customers');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check invoice creation limit
 */
export async function checkInvoiceLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'invoices_monthly');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check vehicle creation limit
 */
export async function checkVehicleLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'vehicles');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check product creation limit
 */
export async function checkProductLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'products');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check storage limit before upload
 */
export async function checkStorageLimit(orgId: string, fileSizeBytes: number): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'storage', fileSizeBytes);

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check photo per job limit
 */
export async function checkJobPhotoLimit(
  orgId: string,
  jobId: string,
  photoCount: number = 1
): Promise<EnforcementResult> {
  const result = await usageTracker.checkJobPhotoLimit(orgId, jobId, photoCount);

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check WhatsApp message limit
 */
export async function checkWhatsAppLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'whatsapp_monthly');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

/**
 * Check API rate limit (for EMPRESARIAL tier public API)
 */
export async function checkApiRateLimit(orgId: string): Promise<EnforcementResult> {
  const result = await usageTracker.checkLimit(orgId, 'api_daily');

  if (!result.allowed) {
    return {
      allowed: false,
      error: usageTracker.createLimitExceededResponse(result),
    };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING FUNCTIONS (call after successful operations)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track job creation
 */
export async function trackJobCreated(orgId: string): Promise<void> {
  await usageTracker.incrementMonthlyCounter(orgId, 'jobs');
}

/**
 * Track invoice creation
 */
export async function trackInvoiceCreated(orgId: string): Promise<void> {
  await usageTracker.incrementMonthlyCounter(orgId, 'invoices');
}

/**
 * Track WhatsApp message sent
 */
export async function trackWhatsAppSent(orgId: string, count: number = 1): Promise<void> {
  await usageTracker.incrementMonthlyCounter(orgId, 'whatsapp', count);
}

/**
 * Track storage usage change
 */
export async function trackStorageChange(orgId: string, bytesChange: number): Promise<void> {
  if (bytesChange > 0) {
    await usageTracker.incrementMonthlyCounter(orgId, 'storage', bytesChange);
  } else if (bytesChange < 0) {
    await usageTracker.decrementMonthlyCounter(orgId, 'storage', Math.abs(bytesChange));
  }
}

/**
 * Track API call
 */
export async function trackApiCall(orgId: string): Promise<void> {
  await usageTracker.incrementDailyApiCalls(orgId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT TO LIMIT TYPE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map API endpoints to their corresponding limit types
 * Used for automatic enforcement in middleware
 */
export const ENDPOINT_LIMIT_MAP: Record<string, { method: string; limitType: LimitType }[]> = {
  '/api/users': [{ method: 'POST', limitType: 'users' }],
  '/api/jobs': [{ method: 'POST', limitType: 'jobs_monthly' }],
  '/api/customers': [{ method: 'POST', limitType: 'customers' }],
  '/api/invoices': [{ method: 'POST', limitType: 'invoices_monthly' }],
  '/api/vehicles': [{ method: 'POST', limitType: 'vehicles' }],
  '/api/inventory/items': [{ method: 'POST', limitType: 'products' }],
  '/api/inventory/products': [{ method: 'POST', limitType: 'products' }],
  '/api/whatsapp/send': [{ method: 'POST', limitType: 'whatsapp_monthly' }],
};

/**
 * Get limit type for an endpoint and method
 */
export function getLimitTypeForEndpoint(path: string, method: string): LimitType | null {
  // Normalize path (remove trailing slash, query params)
  const normalizedPath = path.split('?')[0].replace(/\/$/, '');

  const limits = ENDPOINT_LIMIT_MAP[normalizedPath];
  if (!limits) return null;

  const match = limits.find(l => l.method === method.toUpperCase());
  return match?.limitType || null;
}
