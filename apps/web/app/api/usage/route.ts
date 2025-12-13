/**
 * Organization Usage API
 * =======================
 *
 * GET /api/usage - Get organization usage summary and tier information
 *
 * Returns current usage, limits, and tier details for billing/upgrade UI.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { usageTracker } from '@/lib/services/usage-tracker';
import {
  getTierConfig,
  TIER_CONFIGS,
  LIMIT_MESSAGES,
  LimitType,
  WARNING_THRESHOLD,
} from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// GET USAGE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/usage
 * Get organization usage summary
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { organizationId, role } = session;

    // Only OWNER and ADMIN can see full usage details
    if (!['OWNER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'No tienes permisos para ver esta información.' },
        { status: 403 }
      );
    }

    // Get usage summary
    const summary = await usageTracker.getUsageSummary(organizationId);
    const tierConfig = getTierConfig(summary.tier);

    // Calculate warnings for limits approaching threshold
    const warnings: Array<{
      limitType: LimitType;
      label: string;
      percentage: number;
      message: string;
    }> = [];

    // Determine which limits are near/exceeded
    const criticalLimits: LimitType[] = [];
    const approachingLimits: LimitType[] = [];

    for (const [key, value] of Object.entries(summary.usage)) {
      const limitType = key as LimitType;
      const limitConfig = LIMIT_MESSAGES[limitType];

      if (value.percentage >= 100) {
        criticalLimits.push(limitType);
        warnings.push({
          limitType,
          label: limitConfig.labelEs,
          percentage: value.percentage,
          message: `Has alcanzado el límite de ${limitConfig.labelEs.toLowerCase()}.`,
        });
      } else if (value.percentage >= WARNING_THRESHOLD * 100) {
        approachingLimits.push(limitType);
        warnings.push({
          limitType,
          label: limitConfig.labelEs,
          percentage: value.percentage,
          message: `Estás acercándote al límite de ${limitConfig.labelEs.toLowerCase()} (${value.percentage}%).`,
        });
      }
    }

    // Build upgrade recommendation if needed
    let upgradeRecommendation: {
      recommended: boolean;
      suggestedTier?: string;
      suggestedTierName?: string;
      reason?: string;
      upgradeUrl: string;
    } | null = null;

    if (criticalLimits.length > 0 || approachingLimits.length >= 2) {
      // Find next tier
      const tierOrder = ['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL'] as const;
      const currentIndex = tierOrder.indexOf(summary.tier);
      const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;

      if (nextTier) {
        const nextTierConfig = getTierConfig(nextTier);
        upgradeRecommendation = {
          recommended: true,
          suggestedTier: nextTier,
          suggestedTierName: nextTierConfig?.name,
          reason: criticalLimits.length > 0
            ? `Has alcanzado el límite en ${criticalLimits.length} recurso(s).`
            : `Te estás acercando al límite en ${approachingLimits.length} recursos.`,
          upgradeUrl: '/settings/billing/upgrade',
        };
      }
    }

    // Calculate billing period info
    const now = new Date();
    const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billingCycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.ceil((billingCycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Build comprehensive response
    return NextResponse.json({
      // Current tier information
      tier: {
        id: summary.tier,
        name: tierConfig?.name || summary.tier,
        description: tierConfig?.description || '',
        priceDisplay: tierConfig?.limits.priceDisplay || 'Gratis',
      },

      // Billing period
      billingPeriod: {
        current: summary.period,
        startDate: billingCycleStart.toISOString().split('T')[0],
        endDate: billingCycleEnd.toISOString().split('T')[0],
        daysRemaining,
      },

      // Usage by category
      usage: {
        // Core resources
        users: {
          ...summary.usage.users,
          label: LIMIT_MESSAGES.users.labelEs,
          isMonthly: false,
        },
        customers: {
          ...summary.usage.customers,
          label: LIMIT_MESSAGES.customers.labelEs,
          isMonthly: false,
        },
        jobs: {
          ...summary.usage.jobs_monthly,
          label: LIMIT_MESSAGES.jobs_monthly.labelEs,
          isMonthly: true,
        },
        invoices: {
          ...summary.usage.invoices_monthly,
          label: LIMIT_MESSAGES.invoices_monthly.labelEs,
          isMonthly: true,
        },

        // Fleet & inventory
        vehicles: {
          ...summary.usage.vehicles,
          label: LIMIT_MESSAGES.vehicles.labelEs,
          isMonthly: false,
        },
        products: {
          ...summary.usage.products,
          label: LIMIT_MESSAGES.products.labelEs,
          isMonthly: false,
        },

        // Storage
        storage: {
          ...summary.usage.storage,
          label: LIMIT_MESSAGES.storage.labelEs,
          isMonthly: false,
        },
        documents: {
          ...summary.usage.document_uploads,
          label: LIMIT_MESSAGES.document_uploads.labelEs,
          isMonthly: false,
        },

        // Communications
        whatsapp: {
          ...summary.usage.whatsapp_monthly,
          label: LIMIT_MESSAGES.whatsapp_monthly.labelEs,
          isMonthly: true,
        },

        // API (only for EMPRESARIAL)
        api: {
          ...summary.usage.api_daily,
          label: LIMIT_MESSAGES.api_daily.labelEs,
          isDaily: true,
        },
      },

      // Warnings for approaching/exceeded limits
      warnings,
      criticalLimits,
      approachingLimits,

      // Upgrade recommendation
      upgradeRecommendation,

      // Available tiers for comparison
      availableTiers: TIER_CONFIGS.map(config => ({
        id: config.id,
        name: config.name,
        description: config.description,
        price: config.limits.priceDisplay,
        priceUsd: config.limits.priceUsd,
        isCurrent: config.id === summary.tier,
        highlights: getHighlightsForTier(config.id),
      })),
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener el uso' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tier highlights for comparison display
 */
function getHighlightsForTier(tierId: string): string[] {
  const highlights: Record<string, string[]> = {
    FREE: [
      '1 usuario',
      '30 trabajos/mes',
      '50 clientes',
      '50MB almacenamiento',
    ],
    BASICO: [
      '3 usuarios',
      '150 trabajos/mes',
      'Facturación AFIP',
      '3 vehículos',
      '500 WhatsApp/mes',
    ],
    PROFESIONAL: [
      '8 usuarios',
      '500 trabajos/mes',
      'Seguimiento GPS en vivo',
      '10 vehículos',
      '2000 WhatsApp/mes',
    ],
    EMPRESARIAL: [
      '20 usuarios',
      'Trabajos ilimitados',
      'Multi-zona',
      'API acceso',
      'Soporte prioritario',
    ],
  };

  return highlights[tierId] || [];
}
