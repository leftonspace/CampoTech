/**
 * CampoTech Subscription Manager
 * ==============================
 *
 * Manages SaaS subscriptions for organizations.
 * Integrates with Mercado Pago for payment processing.
 *
 * Subscription Tiers:
 * - FREE: No payment required
 * - BASICO (Inicial): $25/month
 * - PROFESIONAL: $55/month
 * - EMPRESARIAL: $120/month
 */

import { prisma } from '@/lib/prisma';
import { SubscriptionTier, TIER_CONFIGS, getTierConfig } from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionStatus =
  | 'pending'        // Awaiting first payment
  | 'active'         // Active subscription
  | 'paused'         // Temporarily paused
  | 'cancelled'      // User cancelled
  | 'past_due'       // Payment failed, grace period
  | 'expired';       // Subscription ended

export interface Subscription {
  id: string;
  orgId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  mpSubscriptionId?: string;
  mpPayerId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  orgId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  processedAt?: Date;
  createdAt: Date;
}

export interface PlanChangeRequest {
  orgId: string;
  currentTier: SubscriptionTier;
  newTier: SubscriptionTier;
  immediate?: boolean; // Apply immediately vs at next billing cycle
}

export interface PlanChangeResult {
  success: boolean;
  subscription?: Subscription;
  checkoutUrl?: string;
  error?: string;
  effectiveDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERCADO PAGO PLAN IDs (configured in MP dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

const MP_PLAN_IDS: Record<SubscriptionTier, string | null> = {
  FREE: null, // No plan needed
  INICIAL: process.env.MP_PLAN_INICIAL || 'plan_inicial',
  PROFESIONAL: process.env.MP_PLAN_PROFESIONAL || 'plan_profesional',
  EMPRESA: process.env.MP_PLAN_EMPRESA || 'plan_empresa',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class SubscriptionManager {
  /**
   * Get current subscription for an organization
   */
  async getSubscription(orgId: string): Promise<Subscription | null> {
    try {
      const result = await prisma.$queryRaw<Subscription[]>`
        SELECT
          id,
          org_id as "orgId",
          tier,
          status,
          mp_subscription_id as "mpSubscriptionId",
          mp_payer_id as "mpPayerId",
          current_period_start as "currentPeriodStart",
          current_period_end as "currentPeriodEnd",
          cancelled_at as "cancelledAt",
          cancel_reason as "cancelReason",
          trial_ends_at as "trialEndsAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM organization_subscriptions
        WHERE org_id = ${orgId}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;

      return result[0] || null;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Get organization's current tier
   */
  async getCurrentTier(orgId: string): Promise<SubscriptionTier> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { subscriptionTier: true },
      });

      return org?.subscriptionTier || 'FREE';
    } catch {
      return 'FREE';
    }
  }

  /**
   * Update organization's subscription tier
   */
  async updateOrganizationTier(orgId: string, tier: SubscriptionTier): Promise<void> {
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: { subscriptionTier: tier },
      });
    } catch (error) {
      console.error('Error updating organization tier:', error);
      throw error;
    }
  }

  /**
   * Create or update subscription
   */
  async upsertSubscription(data: {
    orgId: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    mpSubscriptionId?: string;
    mpPayerId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<Subscription> {
    const now = new Date();
    const periodStart = data.currentPeriodStart || now;
    const periodEnd = data.currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$executeRaw`
      INSERT INTO organization_subscriptions (
        id, org_id, tier, status, mp_subscription_id, mp_payer_id,
        current_period_start, current_period_end, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${data.orgId}::uuid,
        ${data.tier},
        ${data.status},
        ${data.mpSubscriptionId || null},
        ${data.mpPayerId || null},
        ${periodStart},
        ${periodEnd},
        NOW(),
        NOW()
      )
      ON CONFLICT (org_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        mp_subscription_id = COALESCE(EXCLUDED.mp_subscription_id, organization_subscriptions.mp_subscription_id),
        mp_payer_id = COALESCE(EXCLUDED.mp_payer_id, organization_subscriptions.mp_payer_id),
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = NOW()
    `;

    // Also update the organization's tier setting
    await this.updateOrganizationTier(data.orgId, data.tier);

    return (await this.getSubscription(data.orgId))!;
  }

  /**
   * Request a plan change (upgrade or downgrade)
   */
  async requestPlanChange(request: PlanChangeRequest): Promise<PlanChangeResult> {
    const { orgId, currentTier, newTier, immediate } = request;

    // Validate tier change
    if (currentTier === newTier) {
      return { success: false, error: 'Ya estas en este plan.' };
    }

    const currentConfig = getTierConfig(currentTier);
    const newConfig = getTierConfig(newTier);

    if (!newConfig) {
      return { success: false, error: 'Plan no valido.' };
    }

    // Handle FREE tier - no payment needed
    if (newTier === 'FREE') {
      // Downgrade to FREE - cancel any existing subscription
      const subscription = await this.getSubscription(orgId);
      if (subscription?.mpSubscriptionId) {
        // TODO: Cancel MP subscription via API
      }

      const updated = await this.upsertSubscription({
        orgId,
        tier: 'FREE',
        status: 'active',
      });

      return {
        success: true,
        subscription: updated,
        effectiveDate: immediate ? new Date() : subscription?.currentPeriodEnd,
      };
    }

    // Upgrading from FREE or changing paid tier
    const mpPlanId = MP_PLAN_IDS[newTier];
    if (!mpPlanId) {
      return { success: false, error: 'Plan no disponible.' };
    }

    // Create checkout URL for the new plan
    const checkoutUrl = await this.createCheckoutUrl(orgId, newTier);

    return {
      success: true,
      checkoutUrl,
      effectiveDate: new Date(),
    };
  }

  /**
   * Create MP checkout URL for subscription
   */
  async createCheckoutUrl(orgId: string, tier: SubscriptionTier): Promise<string> {
    const tierConfig = getTierConfig(tier);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // TODO: Integrate with actual MP subscription API
    // For now, return a placeholder URL
    return `${baseUrl}/dashboard/settings/billing/checkout?tier=${tier}&org=${orgId}`;
  }

  /**
   * Handle MP subscription webhook event
   */
  async handleWebhookEvent(
    eventType: string,
    mpSubscriptionId: string,
    eventData: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find subscription by MP ID
      const subscriptions = await prisma.$queryRaw<Array<{ org_id: string }>>`
        SELECT org_id
        FROM organization_subscriptions
        WHERE mp_subscription_id = ${mpSubscriptionId}
      `;

      if (subscriptions.length === 0) {
        // New subscription - need to associate with org
        const externalRef = eventData.external_reference as string;
        if (!externalRef) {
          return { success: false, error: 'No external reference found' };
        }

        // External ref format: org_<orgId>
        const orgId = externalRef.replace('org_', '');
        await this.handleNewSubscription(orgId, mpSubscriptionId, eventData);
        return { success: true };
      }

      const orgId = subscriptions[0].org_id;

      // Process event based on type
      switch (eventType) {
        case 'subscription.authorized':
        case 'subscription.activated':
          await this.handleSubscriptionActivated(orgId, eventData);
          break;

        case 'subscription.payment.approved':
          await this.handlePaymentApproved(orgId, eventData);
          break;

        case 'subscription.payment.rejected':
        case 'subscription.payment.expired':
          await this.handlePaymentFailed(orgId, eventData);
          break;

        case 'subscription.paused':
          await this.handleSubscriptionPaused(orgId, eventData);
          break;

        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(orgId, eventData);
          break;

        case 'subscription.updated':
          await this.handleSubscriptionUpdated(orgId, eventData);
          break;

        default:
          console.log(`Unhandled subscription event: ${eventType}`);
      }

      // Log the event
      await this.logEvent(orgId, eventType, eventData);

      return { success: true };
    } catch (error) {
      console.error('Webhook event processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle new subscription creation
   */
  private async handleNewSubscription(
    orgId: string,
    mpSubscriptionId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const planId = eventData.preapproval_plan_id as string;
    const tier = this.getTierFromPlanId(planId);

    await this.upsertSubscription({
      orgId,
      tier,
      status: 'active',
      mpSubscriptionId,
      mpPayerId: eventData.payer_id as string,
    });
  }

  /**
   * Handle subscription activation
   */
  private async handleSubscriptionActivated(
    orgId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const planId = eventData.preapproval_plan_id as string;
    const tier = this.getTierFromPlanId(planId);

    await this.upsertSubscription({
      orgId,
      tier,
      status: 'active',
    });
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentApproved(
    orgId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const nextBillingDate = eventData.next_payment_date
      ? new Date(eventData.next_payment_date as string)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$executeRaw`
      UPDATE organization_subscriptions
      SET
        status = 'active',
        current_period_end = ${nextBillingDate},
        updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
    `;
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(
    orgId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    // Set to past_due status, keep current tier for grace period
    await prisma.$executeRaw`
      UPDATE organization_subscriptions
      SET
        status = 'past_due',
        updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
    `;

    // TODO: Send notification to organization owner
  }

  /**
   * Handle subscription pause
   */
  private async handleSubscriptionPaused(
    orgId: string,
    _eventData: Record<string, unknown>
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE organization_subscriptions
      SET
        status = 'paused',
        updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
    `;

    // Downgrade to FREE while paused
    await this.updateOrganizationTier(orgId, 'FREE');
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCancelled(
    orgId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE organization_subscriptions
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = ${(eventData.reason as string) || 'user_cancelled'},
        updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
    `;

    // Downgrade to FREE
    await this.updateOrganizationTier(orgId, 'FREE');
  }

  /**
   * Handle subscription update (plan change)
   */
  private async handleSubscriptionUpdated(
    orgId: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const planId = eventData.preapproval_plan_id as string;
    const newTier = this.getTierFromPlanId(planId);

    await this.updateOrganizationTier(orgId, newTier);

    await prisma.$executeRaw`
      UPDATE organization_subscriptions
      SET
        tier = ${newTier},
        updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
    `;
  }

  /**
   * Map MP plan ID to tier
   */
  private getTierFromPlanId(planId: string): SubscriptionTier {
    for (const [tier, id] of Object.entries(MP_PLAN_IDS)) {
      if (id === planId) {
        return tier as SubscriptionTier;
      }
    }
    return 'INICIAL'; // Default
  }

  /**
   * Log subscription event
   */
  private async logEvent(
    orgId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO subscription_events (id, org_id, event_type, event_data, created_at)
        VALUES (
          gen_random_uuid(),
          ${orgId}::uuid,
          ${eventType},
          ${JSON.stringify(eventData)}::jsonb,
          NOW()
        )
      `;
    } catch (error) {
      console.error('Error logging subscription event:', error);
    }
  }

  /**
   * Check and handle expired grace periods
   * Should be run daily via cron
   */
  async processExpiredSubscriptions(): Promise<number> {
    const gracePeriodDays = 7;
    const cutoffDate = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);

    try {
      // Find past_due subscriptions past grace period
      const expired = await prisma.$queryRaw<Array<{ org_id: string }>>`
        SELECT org_id
        FROM organization_subscriptions
        WHERE status = 'past_due'
          AND updated_at < ${cutoffDate}
      `;

      // Downgrade each to FREE
      for (const sub of expired) {
        await this.updateOrganizationTier(sub.org_id, 'FREE');
        await prisma.$executeRaw`
          UPDATE organization_subscriptions
          SET
            status = 'expired',
            tier = 'FREE',
            updated_at = NOW()
          WHERE org_id = ${sub.org_id}::uuid
        `;
      }

      return expired.length;
    } catch (error) {
      console.error('Error processing expired subscriptions:', error);
      return 0;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const subscriptionManager = new SubscriptionManager();
