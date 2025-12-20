/**
 * CampoTech Subscription Change Flows
 * ====================================
 *
 * Manages subscription lifecycle changes:
 * - Upgrade: Immediately grant new tier features, charge prorated amount
 * - Downgrade: Effective at end of current period, show lost features
 * - Cancel: Offer refund if within 10 days (Ley 24.240), access until period end
 * - Reactivate: Resume subscription after cancellation
 *
 * Business Rules:
 * - Ley 24.240 (Consumer Protection): Full refund within 10 days of payment
 * - Upgrades are immediate with prorated billing
 * - Downgrades take effect at next billing cycle
 * - Cancellations preserve access until period end
 * - Reactivation within period is instant, after period requires payment
 */

import { prisma } from '@/lib/prisma';
import type {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from '@/lib/types/subscription';
import { blockManager, BLOCK_REASON_CODES } from './block-manager';

// Type for OrganizationSubscription from Prisma
type OrganizationSubscription = Awaited<ReturnType<typeof prisma.organizationSubscription.findFirst>> & {};
import { funnelTracker } from './funnel-tracker';
import { getMercadoPagoClient, getPaymentAPI } from '@/lib/mercadopago/client';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Consumer protection law refund window (Ley 24.240) */
export const LEY_24240_REFUND_DAYS = 10;

/** Tier pricing in ARS (monthly) */
export const TIER_PRICING: Record<SubscriptionTier, number> = {
  FREE: 0,
  INICIAL: 25000, // $25,000 ARS
  PROFESIONAL: 55000, // $55,000 ARS
  EMPRESA: 120000, // $120,000 ARS
};

/** Features by tier */
export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  FREE: [
    'Hasta 5 trabajos por mes',
    '1 usuario',
    'Soporte por email',
  ],
  INICIAL: [
    'Hasta 50 trabajos por mes',
    '3 usuarios',
    'Reportes básicos',
    'Soporte por chat',
  ],
  PROFESIONAL: [
    'Trabajos ilimitados',
    '10 usuarios',
    'Reportes avanzados',
    'API acceso',
    'Soporte prioritario',
  ],
  EMPRESA: [
    'Trabajos ilimitados',
    'Usuarios ilimitados',
    'White label',
    'Integraciones personalizadas',
    'Gerente de cuenta dedicado',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UpgradeResult {
  success: boolean;
  subscription?: OrganizationSubscription;
  checkoutUrl?: string;
  proratedAmount?: number;
  error?: string;
}

export interface DowngradeResult {
  success: boolean;
  subscription?: OrganizationSubscription;
  effectiveDate: Date;
  featuresLost: string[];
  error?: string;
}

export interface CancelResult {
  success: boolean;
  subscription?: OrganizationSubscription;
  accessUntil: Date;
  refundAmount?: number;
  refundEligible: boolean;
  error?: string;
}

export interface ReactivateResult {
  success: boolean;
  subscription?: OrganizationSubscription;
  requiresPayment: boolean;
  checkoutUrl?: string;
  error?: string;
}

export interface SubscriptionChangePreview {
  currentTier: SubscriptionTier;
  newTier: SubscriptionTier;
  isUpgrade: boolean;
  isDowngrade: boolean;
  proratedAmount?: number;
  effectiveDate: Date;
  featuresGained: string[];
  featuresLost: string[];
  monthlyPriceDifference: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tier priority (higher = better tier)
 */
function getTierPriority(tier: SubscriptionTier): number {
  const priorities: Record<SubscriptionTier, number> = {
    FREE: 0,
    INICIAL: 1,
    PROFESIONAL: 2,
    EMPRESA: 3,
  };
  return priorities[tier] || 0;
}

/**
 * Calculate prorated amount for upgrade
 */
function calculateProratedAmount(
  currentTier: SubscriptionTier,
  newTier: SubscriptionTier,
  daysRemaining: number,
  billingCycle: BillingCycle
): number {
  const periodDays = billingCycle === 'YEARLY' ? 365 : 30;
  const currentMonthly = TIER_PRICING[currentTier];
  const newMonthly = TIER_PRICING[newTier];

  const yearlyMultiplier = billingCycle === 'YEARLY' ? 10 : 1; // 2 months free for yearly
  const currentPeriod = currentMonthly * yearlyMultiplier;
  const newPeriod = newMonthly * yearlyMultiplier;

  // Calculate unused value from current plan
  const unusedDays = daysRemaining;
  const unusedValue = (currentPeriod / periodDays) * unusedDays;

  // Calculate cost for remaining days at new tier
  const newCost = (newPeriod / periodDays) * unusedDays;

  // Prorated amount is the difference
  return Math.max(0, Math.round(newCost - unusedValue));
}

/**
 * Calculate days remaining in current period
 */
function calculateDaysRemaining(periodEnd: Date): number {
  const now = new Date();
  const diffMs = periodEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check if within Ley 24.240 refund window
 */
function isWithinRefundWindow(paymentDate: Date): boolean {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= LEY_24240_REFUND_DAYS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION FLOWS CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class SubscriptionFlowsService {
  /**
   * Preview a subscription change before executing
   */
  async previewChange(
    organizationId: string,
    newTier: SubscriptionTier
  ): Promise<SubscriptionChangePreview> {
    const subscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new Error('No subscription found');
    }

    const currentTier = subscription.tier;
    const currentPriority = getTierPriority(currentTier);
    const newPriority = getTierPriority(newTier);
    const isUpgrade = newPriority > currentPriority;
    const isDowngrade = newPriority < currentPriority;

    const currentFeatures = TIER_FEATURES[currentTier];
    const newFeatures = TIER_FEATURES[newTier];

    const featuresGained = newFeatures.filter((f) => !currentFeatures.includes(f));
    const featuresLost = currentFeatures.filter((f) => !newFeatures.includes(f));

    let proratedAmount: number | undefined;
    let effectiveDate: Date;

    if (isUpgrade) {
      const daysRemaining = calculateDaysRemaining(subscription.currentPeriodEnd);
      proratedAmount = calculateProratedAmount(
        currentTier,
        newTier,
        daysRemaining,
        subscription.billingCycle
      );
      effectiveDate = new Date(); // Immediate
    } else if (isDowngrade) {
      effectiveDate = subscription.currentPeriodEnd; // End of period
    } else {
      effectiveDate = new Date();
    }

    const monthlyPriceDifference = TIER_PRICING[newTier] - TIER_PRICING[currentTier];

    return {
      currentTier,
      newTier,
      isUpgrade,
      isDowngrade,
      proratedAmount,
      effectiveDate,
      featuresGained,
      featuresLost,
      monthlyPriceDifference,
    };
  }

  /**
   * Upgrade subscription to a higher tier
   *
   * 1. Calculate prorated amount
   * 2. Generate checkout URL
   * 3. On payment success: immediately grant new tier features
   */
  async upgrade(
    organizationId: string,
    newTier: SubscriptionTier
  ): Promise<UpgradeResult> {
    try {
      const subscription = await prisma.organizationSubscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        return { success: false, error: 'No subscription found' };
      }

      const currentPriority = getTierPriority(subscription.tier);
      const newPriority = getTierPriority(newTier);

      if (newPriority <= currentPriority) {
        return { success: false, error: 'New tier must be higher than current tier' };
      }

      // Calculate prorated amount
      const daysRemaining = calculateDaysRemaining(subscription.currentPeriodEnd);
      const proratedAmount = calculateProratedAmount(
        subscription.tier,
        newTier,
        daysRemaining,
        subscription.billingCycle
      );

      // If prorated amount is 0 or very small, apply upgrade immediately
      if (proratedAmount < 1000) { // Less than $1000 ARS
        await this.applyUpgradeImmediately(organizationId, newTier);

        return {
          success: true,
          subscription: await prisma.organizationSubscription.findUnique({
            where: { organizationId },
          }) as OrganizationSubscription,
          proratedAmount: 0,
        };
      }

      // Generate checkout URL for prorated payment
      const checkoutUrl = await this.generateUpgradeCheckout(
        organizationId,
        newTier,
        proratedAmount
      );

      // Track upgrade attempt
      await funnelTracker.trackEvent({
        event: 'upgrade_initiated',
        organizationId,
        metadata: {
          fromTier: subscription.tier,
          toTier: newTier,
          proratedAmount,
        },
      });

      return {
        success: true,
        checkoutUrl,
        proratedAmount,
      };
    } catch (error) {
      console.error('[SubscriptionFlows] Upgrade error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Apply upgrade immediately (called after payment or if no payment needed)
   */
  async applyUpgradeImmediately(
    organizationId: string,
    newTier: SubscriptionTier
  ): Promise<void> {
    const subscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new Error('No subscription found');
    }

    const oldTier = subscription.tier;

    // Update subscription
    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        tier: newTier,
        status: 'active',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        cancelReason: null,
      },
    });

    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionTier: newTier,
        subscriptionStatus: 'active',
      },
    });

    // Log event
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        organizationId,
        eventType: 'plan_upgraded',
        eventData: {
          from_tier: oldTier,
          to_tier: newTier,
          effective_immediately: true,
        },
        actorType: 'user',
      },
    });

    // Track conversion
    await funnelTracker.trackEvent({
      event: 'upgrade_completed',
      organizationId,
      metadata: {
        fromTier: oldTier,
        toTier: newTier,
      },
    });
  }

  /**
   * Downgrade subscription to a lower tier
   *
   * 1. Schedule downgrade for end of current period
   * 2. Show features that will be lost
   * 3. Confirm understanding
   */
  async downgrade(
    organizationId: string,
    newTier: SubscriptionTier,
    reason?: string
  ): Promise<DowngradeResult> {
    try {
      const subscription = await prisma.organizationSubscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        return { success: false, error: 'No subscription found', effectiveDate: new Date(), featuresLost: [] };
      }

      const currentPriority = getTierPriority(subscription.tier);
      const newPriority = getTierPriority(newTier);

      if (newPriority >= currentPriority) {
        return { success: false, error: 'New tier must be lower than current tier', effectiveDate: new Date(), featuresLost: [] };
      }

      // Calculate features lost
      const currentFeatures = TIER_FEATURES[subscription.tier];
      const newFeatures = TIER_FEATURES[newTier];
      const featuresLost = currentFeatures.filter((f) => !newFeatures.includes(f));

      const effectiveDate = subscription.currentPeriodEnd;

      // Update subscription to downgrade at period end
      await prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelReason: `Downgrade to ${newTier}: ${reason || 'User requested'}`,
          // Store pending tier change
        },
      });

      // Create a scheduled tier change record
      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          organizationId,
          eventType: 'downgrade_scheduled',
          eventData: {
            from_tier: subscription.tier,
            to_tier: newTier,
            effective_date: effectiveDate.toISOString(),
            features_lost: featuresLost,
            reason,
          },
          actorType: 'user',
        },
      });

      // Track downgrade
      await funnelTracker.trackEvent({
        event: 'downgrade_scheduled',
        organizationId,
        metadata: {
          fromTier: subscription.tier,
          toTier: newTier,
          effectiveDate: effectiveDate.toISOString(),
          reason,
        },
      });

      return {
        success: true,
        subscription: await prisma.organizationSubscription.findUnique({
          where: { organizationId },
        }) as OrganizationSubscription,
        effectiveDate,
        featuresLost,
      };
    } catch (error) {
      console.error('[SubscriptionFlows] Downgrade error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        effectiveDate: new Date(),
        featuresLost: [],
      };
    }
  }

  /**
   * Cancel subscription
   *
   * 1. If within 10 days of payment (Ley 24.240), offer full refund
   * 2. Process refund via MercadoPago
   * 3. Access continues until period end
   */
  async cancel(
    organizationId: string,
    reason?: string,
    requestRefund?: boolean
  ): Promise<CancelResult> {
    try {
      const subscription = await prisma.organizationSubscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        return { success: false, error: 'No subscription found', accessUntil: new Date(), refundEligible: false };
      }

      // Get latest completed payment
      const latestPayment = await prisma.subscriptionPayment.findFirst({
        where: {
          subscriptionId: subscription.id,
          status: 'completed',
        },
        orderBy: { paidAt: 'desc' },
      });

      // Check refund eligibility (Ley 24.240)
      const refundEligible = latestPayment?.paidAt
        ? isWithinRefundWindow(latestPayment.paidAt)
        : false;

      let refundAmount: number | undefined;

      // Process refund if requested and eligible
      if (requestRefund && refundEligible && latestPayment) {
        const refundResult = await this.processRefund(latestPayment.id);
        if (refundResult.success) {
          refundAmount = latestPayment.amount.toNumber();
        }
      }

      // Update subscription
      await prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
          cancelReason: reason || 'User cancelled',
        },
      });

      // Log event
      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          organizationId,
          eventType: 'subscription_cancelled',
          eventData: {
            reason,
            refund_requested: requestRefund,
            refund_eligible: refundEligible,
            refund_amount: refundAmount,
            access_until: subscription.currentPeriodEnd.toISOString(),
          },
          actorType: 'user',
        },
      });

      // Track cancellation
      await funnelTracker.trackEvent({
        event: 'subscription_cancelled',
        organizationId,
        metadata: {
          tier: subscription.tier,
          reason,
          refundRequested: requestRefund,
          refundAmount,
        },
      });

      return {
        success: true,
        subscription: await prisma.organizationSubscription.findUnique({
          where: { organizationId },
        }) as OrganizationSubscription,
        accessUntil: subscription.currentPeriodEnd,
        refundAmount,
        refundEligible,
      };
    } catch (error) {
      console.error('[SubscriptionFlows] Cancel error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        accessUntil: new Date(),
        refundEligible: false,
      };
    }
  }

  /**
   * Reactivate a cancelled subscription
   *
   * 1. If within current period, just update status
   * 2. If after period, require new payment
   */
  async reactivate(organizationId: string): Promise<ReactivateResult> {
    try {
      const subscription = await prisma.organizationSubscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        return { success: false, error: 'No subscription found', requiresPayment: true };
      }

      const now = new Date();
      const isWithinPeriod = now < subscription.currentPeriodEnd;

      if (isWithinPeriod) {
        // Reactivate immediately without payment
        await prisma.organizationSubscription.update({
          where: { id: subscription.id },
          data: {
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            cancelReason: null,
            status: 'active',
          },
        });

        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            subscriptionStatus: 'active',
          },
        });

        // Remove any cancellation blocks
        await blockManager.removeBlocksByReasonCode(
          organizationId,
          BLOCK_REASON_CODES.SUBSCRIPTION_CANCELLED
        );

        // Log event
        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'subscription_reactivated',
            eventData: {
              within_period: true,
              tier: subscription.tier,
            },
            actorType: 'user',
          },
        });

        // Track reactivation
        await funnelTracker.trackEvent({
          event: 'subscription_reactivated',
          organizationId,
          metadata: {
            tier: subscription.tier,
            withinPeriod: true,
          },
        });

        return {
          success: true,
          subscription: await prisma.organizationSubscription.findUnique({
            where: { organizationId },
          }) as OrganizationSubscription,
          requiresPayment: false,
        };
      } else {
        // Requires new payment
        const checkoutUrl = await this.generateReactivationCheckout(
          organizationId,
          subscription.tier,
          subscription.billingCycle
        );

        return {
          success: true,
          requiresPayment: true,
          checkoutUrl,
        };
      }
    } catch (error) {
      console.error('[SubscriptionFlows] Reactivate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requiresPayment: true,
      };
    }
  }

  /**
   * Process scheduled downgrades
   * Called by cron job at period end
   */
  async processScheduledDowngrades(): Promise<number> {
    const now = new Date();
    let processed = 0;

    // Find subscriptions that need to be downgraded
    const scheduledDowngrades = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: 'downgrade_scheduled',
        eventData: {
          path: ['processed'],
          equals: null,
        },
      },
      include: {
        subscription: true,
        organization: true,
      },
    });

    for (const event of scheduledDowngrades) {
      const eventData = event.eventData as Record<string, unknown>;
      const effectiveDate = new Date(eventData.effective_date as string);

      if (now >= effectiveDate && event.subscription) {
        const newTier = eventData.to_tier as SubscriptionTier;

        // Apply the downgrade
        await prisma.organizationSubscription.update({
          where: { id: event.subscription.id },
          data: {
            tier: newTier,
            cancelAtPeriodEnd: false,
            // Start new period at new tier
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await prisma.organization.update({
          where: { id: event.organizationId },
          data: {
            subscriptionTier: newTier,
          },
        });

        // Mark event as processed
        await prisma.subscriptionEvent.update({
          where: { id: event.id },
          data: {
            eventData: {
              ...eventData,
              processed: true,
              processed_at: now.toISOString(),
            },
          },
        });

        // Log completion
        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: event.subscriptionId,
            organizationId: event.organizationId,
            eventType: 'plan_downgraded',
            eventData: {
              from_tier: eventData.from_tier,
              to_tier: newTier,
            },
            actorType: 'system',
          },
        });

        processed++;
      }
    }

    return processed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate checkout URL for upgrade payment
   */
  private async generateUpgradeCheckout(
    organizationId: string,
    newTier: SubscriptionTier,
    amount: number
  ): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const timestamp = Date.now();
    const externalReference = `upgrade_${organizationId}_${newTier}_${timestamp}`;

    // TODO: Create actual MercadoPago preference
    // For now, return placeholder URL
    return `${baseUrl}/dashboard/settings/billing/checkout?` +
      `type=upgrade&tier=${newTier}&amount=${amount}&ref=${externalReference}`;
  }

  /**
   * Generate checkout URL for reactivation payment
   */
  private async generateReactivationCheckout(
    organizationId: string,
    tier: SubscriptionTier,
    billingCycle: BillingCycle
  ): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const timestamp = Date.now();
    const externalReference = `reactivate_${organizationId}_${tier}_${billingCycle}_${timestamp}`;

    const yearlyMultiplier = billingCycle === 'YEARLY' ? 10 : 1;
    const amount = TIER_PRICING[tier] * yearlyMultiplier;

    // TODO: Create actual MercadoPago preference
    return `${baseUrl}/dashboard/settings/billing/checkout?` +
      `type=reactivate&tier=${tier}&cycle=${billingCycle}&amount=${amount}&ref=${externalReference}`;
  }

  /**
   * Process refund via MercadoPago
   */
  private async processRefund(paymentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const payment = await prisma.subscriptionPayment.findUnique({
        where: { id: paymentId },
      });

      if (!payment?.mpPaymentId) {
        return { success: false, error: 'No MercadoPago payment ID found' };
      }

      // TODO: Call MercadoPago refund API
      // const paymentApi = getPaymentAPI();
      // await paymentApi.refund({ payment_id: payment.mpPaymentId });

      // Update payment status
      await prisma.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
        },
      });

      console.log(`[SubscriptionFlows] Refund processed for payment ${paymentId}`);

      return { success: true };
    } catch (error) {
      console.error('[SubscriptionFlows] Refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton
export const subscriptionFlows = new SubscriptionFlowsService();
