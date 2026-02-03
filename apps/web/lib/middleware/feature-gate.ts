/**
 * CampoTech Feature Gate Middleware
 * ==================================
 *
 * Middleware for enforcing feature access based on subscription tier.
 * Blocks access to premium features for lower-tier organizations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  FeatureId,
  hasFeatureAccess,
  getFeatureForRoute,
  createFeatureNotAvailableError,
  FeatureNotAvailableError,
  FEATURES,
} from '@/lib/config/feature-flags';
import { SubscriptionTier } from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeatureGateOptions {
  feature?: FeatureId;
  skipCheck?: (request: NextRequest) => boolean | Promise<boolean>;
}

export interface FeatureGateResult {
  allowed: boolean;
  error?: FeatureNotAvailableError;
  tier?: SubscriptionTier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE NOT AVAILABLE RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a 403 Forbidden response for feature not available
 */
export function createFeatureNotAvailableResponse(error: FeatureNotAvailableError): NextResponse {
  return NextResponse.json(error, { status: 403 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get organization's subscription tier
 */
async function getOrganizationTier(orgId: string): Promise<SubscriptionTier> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionTier: true },
    });

    return org?.subscriptionTier || 'FREE';
  } catch (error) {
    console.error('Error getting organization tier:', error);
    return 'FREE';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE GATE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check feature access before processing request
 */
export async function enforceFeatureAccess(
  request: NextRequest,
  options?: FeatureGateOptions
): Promise<FeatureGateResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { allowed: true }; // Let auth middleware handle this
    }

    // Skip check if specified
    if (options?.skipCheck && await options.skipCheck(request)) {
      return { allowed: true };
    }

    // Determine feature to check
    let featureId = options?.feature;
    if (!featureId) {
      // Auto-detect from route
      const path = request.nextUrl.pathname;
      featureId = getFeatureForRoute(path) || undefined;
    }

    // No feature required for this route
    if (!featureId) {
      return { allowed: true };
    }

    const tier = await getOrganizationTier(session.organizationId);

    if (!hasFeatureAccess(tier, featureId)) {
      return {
        allowed: false,
        error: createFeatureNotAvailableError(featureId, tier),
        tier,
      };
    }

    return { allowed: true, tier };
  } catch (error) {
    console.error('Feature gate error:', error);
    // Fail open - don't block on errors
    return { allowed: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHER-ORDER FUNCTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap an API route handler with feature gating
 */
export function withFeatureGate<T = Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>,
  featureId: FeatureId
): (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const result = await enforceFeatureAccess(request, { feature: featureId });

    if (!result.allowed && result.error) {
      return createFeatureNotAvailableResponse(result.error);
    }

    return handler(request, context);
  };
}

/**
 * Combined wrapper for both feature gating and tier limits
 */
export function withFeatureAndLimitCheck<T = Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>,
  featureId: FeatureId,
  options?: { skipFeatureCheck?: boolean }
): (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse> {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    // Check feature access first (unless skipped)
    if (!options?.skipFeatureCheck) {
      const featureResult = await enforceFeatureAccess(request, { feature: featureId });

      if (!featureResult.allowed && featureResult.error) {
        return createFeatureNotAvailableResponse(featureResult.error);
      }
    }

    return handler(request, context);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FEATURE CHECKERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if organization has access to AFIP integration
 */
export async function hasAfipAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'afip_integration');
}

/**
 * Check if organization has access to Mercado Pago
 */
export async function hasMercadoPagoAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'mercado_pago');
}

/**
 * Check if organization has access to WhatsApp sending
 */
export async function hasWhatsAppSendAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'whatsapp_send');
}

/**
 * Check if organization has access to WhatsApp AI
 */
export async function hasWhatsAppAiAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'whatsapp_ai');
}

/**
 * Check if organization has access to voice transcription
 */
export async function hasVoiceTranscriptionAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'voice_transcription');
}

/**
 * Check if organization has access to live tracking
 */
export async function hasLiveTrackingAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'live_tracking');
}

/**
 * Check if organization has access to fleet management
 */
export async function hasFleetAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'fleet_management');
}

/**
 * Check if organization has access to inventory management
 */
export async function hasInventoryAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'inventory_management');
}

/**
 * Check if organization has access to advanced analytics
 */
export async function hasAdvancedAnalyticsAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'advanced_analytics');
}

/**
 * Check if organization has access to public API
 */
export async function hasPublicApiAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'public_api');
}

/**
 * Check if organization has access to webhooks
 */
export async function hasWebhooksAccess(orgId: string): Promise<boolean> {
  const tier = await getOrganizationTier(orgId);
  return hasFeatureAccess(tier, 'webhooks');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK FEATURE CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all feature access for an organization (for frontend state)
 */
export async function getOrganizationFeatureAccess(orgId: string): Promise<Record<FeatureId, boolean>> {
  const tier = await getOrganizationTier(orgId);

  const featureAccess: Record<string, boolean> = {};

  for (const featureId of Object.keys(FEATURES) as FeatureId[]) {
    featureAccess[featureId] = hasFeatureAccess(tier, featureId);
  }

  return featureAccess as Record<FeatureId, boolean>;
}

/**
 * Get feature summary for settings/billing page
 */
export async function getFeatureSummary(orgId: string): Promise<{
  tier: SubscriptionTier;
  availableFeatures: FeatureId[];
  lockedFeatures: FeatureId[];
}> {
  const tier = await getOrganizationTier(orgId);
  const allFeatures = Object.keys(FEATURES) as FeatureId[];

  const availableFeatures: FeatureId[] = [];
  const lockedFeatures: FeatureId[] = [];

  for (const featureId of allFeatures) {
    if (hasFeatureAccess(tier, featureId)) {
      availableFeatures.push(featureId);
    } else {
      lockedFeatures.push(featureId);
    }
  }

  return { tier, availableFeatures, lockedFeatures };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-GATING MIDDLEWARE (for Next.js middleware.ts)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware function to automatically gate routes based on path
 * Use in Next.js middleware.ts for automatic route protection
 */
export async function autoGateRoute(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;

  // Only check API routes
  if (!path.startsWith('/api/')) {
    return null;
  }

  // Get required feature for this route
  const requiredFeature = getFeatureForRoute(path);
  if (!requiredFeature) {
    return null; // No feature required
  }

  const result = await enforceFeatureAccess(request, { feature: requiredFeature });

  if (!result.allowed && result.error) {
    return createFeatureNotAvailableResponse(result.error);
  }

  return null; // Allow request to proceed
}
