/**
 * CampoTech Payment Processor
 * ===========================
 *
 * Handles subscription payment processing from MercadoPago webhooks.
 * Processes approved, failed, pending, and refunded payments.
 *
 * Business Rules:
 * - Approved payments activate/renew subscriptions
 * - Failed payments trigger retry logic with exponential backoff
 * - Pending payments (cash/transfer) don't activate until confirmed
 * - Refunds within 10 days (Ley 24.240) are processed automatically
 *
 * Timezone: All calculations use Buenos Aires time (America/Argentina/Buenos_Aires)
 */

import { prisma } from '@/lib/prisma';
import type {
  SubscriptionTier,
  BillingCycle,
} from '@/lib/types/subscription';


// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Buenos Aires timezone */
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Grace period after failed payment (days) */
export const GRACE_PERIOD_DAYS = 7;

/** Maximum retry attempts for failed payments */
export const MAX_RETRY_ATTEMPTS = 3;

/** Retry delays in hours [1st retry, 2nd retry, 3rd retry] */
export const RETRY_DELAYS_HOURS = [24, 48, 72];

/** Consumer protection law refund window (Ley 24.240) */
export const LEY_24240_REFUND_DAYS = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentData {
  mpPaymentId: string;
  mpPreferenceId?: string;
  mpExternalReference?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  payerEmail?: string;
  payerId?: string;
  dateCreated?: Date;
  dateApproved?: Date;
}

export interface ProcessPaymentResult {
  success: boolean;
  paymentId?: string;
  subscriptionId?: string;
  organizationId?: string;
  action?: string;
  error?: string;
}

export interface RefundData {
  mpPaymentId: string;
  mpRefundId?: string;
  amount?: number;
  reason?: string;
  refundDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse external reference to extract organization ID and tier info
 * Format: sub_<orgId>_<tier>_<billingCycle>_<timestamp>
 */
export function parseExternalReference(externalRef: string): {
  organizationId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  timestamp: number;
} | null {
  if (!externalRef) return null;

  const parts = externalRef.split('_');
  if (parts.length < 5 || parts[0] !== 'sub') return null;

  const tierMap: Record<string, SubscriptionTier> = {
    INICIAL: 'INICIAL',
    PROFESIONAL: 'PROFESIONAL',
    EMPRESA: 'EMPRESA',
    FREE: 'FREE',
  };

  const cycleMap: Record<string, BillingCycle> = {
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
  };

  const tier = tierMap[parts[2]];
  const billingCycle = cycleMap[parts[3]];

  if (!tier || !billingCycle) return null;

  return {
    organizationId: parts[1],
    tier,
    billingCycle,
    timestamp: parseInt(parts[4], 10),
  };
}

/**
 * Calculate billing period end date
 */
function calculatePeriodEnd(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start);
  if (cycle === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * Calculate next retry date based on retry count
 */
function calculateNextRetry(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRY_ATTEMPTS) return null;

  const hours = RETRY_DELAYS_HOURS[retryCount] || 72;
  const next = new Date();
  next.setHours(next.getHours() + hours);
  return next;
}

/**
 * Check if refund is within Ley 24.240 window (10 days)
 */
function isWithinLey24240Window(paymentDate: Date): boolean {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= LEY_24240_REFUND_DAYS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PROCESSOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class PaymentProcessor {
  /**
   * Process an approved (successful) payment
   *
   * 1. Creates subscription_payments record with status='completed'
   * 2. Updates organization_subscriptions: status='active', sets period dates
   * 3. Updates organization: subscription_tier, subscription_status
   * 4. Logs subscription_event
   */
  async processApprovedPayment(
    paymentData: PaymentData
  ): Promise<ProcessPaymentResult> {
    const { mpPaymentId, mpExternalReference } = paymentData;

    console.log('[PaymentProcessor] Processing approved payment:', mpPaymentId);

    try {
      // Parse external reference to get org info
      const refInfo = mpExternalReference
        ? parseExternalReference(mpExternalReference)
        : null;

      if (!refInfo) {
        // Try to find by MP payment ID
        console.warn(
          '[PaymentProcessor] No external reference, attempting to find by mpPaymentId'
        );

        const existingPayment = await prisma.subscriptionPayment.findFirst({
          where: { mpPaymentId },
          include: { subscription: true },
        });

        if (existingPayment) {
          // Update existing pending payment to completed
          return this.updatePendingToCompleted(existingPayment.id, paymentData);
        }

        return {
          success: false,
          error: 'Could not identify organization from payment',
        };
      }

      const { organizationId, tier, billingCycle } = refInfo;

      // Execute in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Get or create subscription
        let subscription = await tx.organizationSubscription.findUnique({
          where: { organizationId },
        });

        const periodStart = paymentData.dateApproved || new Date();
        const periodEnd = calculatePeriodEnd(periodStart, billingCycle);

        if (!subscription) {
          subscription = await tx.organizationSubscription.create({
            data: {
              organizationId,
              tier,
              billingCycle,
              status: 'active',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              mpPayerId: paymentData.payerId,
            },
          });
        } else {
          // Update existing subscription
          subscription = await tx.organizationSubscription.update({
            where: { id: subscription.id },
            data: {
              tier,
              billingCycle,
              status: 'active',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              mpPayerId: paymentData.payerId,
              trialEndsAt: null, // Clear trial when paid
              gracePeriodEndsAt: null, // Clear any grace period
              cancelAtPeriodEnd: false, // Clear cancellation
              cancelledAt: null,
              cancelReason: null,
            },
          });
        }

        // 2. Create payment record
        const payment = await tx.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            amount: paymentData.amount,
            currency: paymentData.currency || 'ARS',
            status: 'completed',
            paymentType: 'recurring',
            paymentMethod: paymentData.paymentMethod,
            billingCycle,
            periodStart,
            periodEnd,
            mpPaymentId,
            mpPreferenceId: paymentData.mpPreferenceId,
            mpExternalReference: mpExternalReference,
            paidAt: paymentData.dateApproved || new Date(),
          },
        });

        // 3. Update organization tier
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            subscriptionTier: tier,
            subscriptionStatus: 'active',
            trialEndsAt: null,
          },
        });

        // 4. Log subscription event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'payment_succeeded',
            eventData: {
              payment_id: payment.id,
              mp_payment_id: mpPaymentId,
              amount: paymentData.amount,
              currency: paymentData.currency || 'ARS',
              tier,
              billing_cycle: billingCycle,
              webhook_id: mpPaymentId,
            },
            actorType: 'webhook',
          },
        });

        // Also log activation if this is a new subscription or reactivation
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'activated',
            eventData: {
              tier,
              billing_cycle: billingCycle,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
            },
            actorType: 'webhook',
          },
        });

        return { subscription, payment };
      });

      console.log(
        '[PaymentProcessor] Payment processed successfully:',
        result.payment.id
      );

      // TODO: Send confirmation email
      // await sendPaymentConfirmationEmail(organizationId, result.payment);

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        organizationId,
        action: 'subscription_activated',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error processing approved payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a pending payment to completed (e.g., cash payment confirmed)
   */
  private async updatePendingToCompleted(
    paymentId: string,
    paymentData: PaymentData
  ): Promise<ProcessPaymentResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get payment with subscription
        const payment = await tx.subscriptionPayment.findUnique({
          where: { id: paymentId },
          include: { subscription: true },
        });

        if (!payment) {
          throw new Error('Payment not found');
        }

        // Update payment to completed
        const updatedPayment = await tx.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'completed',
            paidAt: paymentData.dateApproved || new Date(),
          },
        });

        // Activate subscription
        const periodEnd = calculatePeriodEnd(
          new Date(),
          payment.billingCycle
        );

        await tx.organizationSubscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            trialEndsAt: null,
            gracePeriodEndsAt: null,
          },
        });

        // Update organization
        await tx.organization.update({
          where: { id: payment.organizationId },
          data: {
            subscriptionTier: payment.subscription.tier,
            subscriptionStatus: 'active',
            trialEndsAt: null,
          },
        });

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: payment.subscriptionId,
            organizationId: payment.organizationId,
            eventType: 'payment_succeeded',
            eventData: {
              payment_id: paymentId,
              mp_payment_id: paymentData.mpPaymentId,
              payment_method: paymentData.paymentMethod,
              was_pending: true,
            },
            actorType: 'webhook',
          },
        });

        return { payment: updatedPayment, subscription: payment.subscription };
      });

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        organizationId: result.payment.organizationId,
        action: 'pending_payment_completed',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error completing pending payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a failed payment
   *
   * 1. Creates/updates subscription_payments record with status='failed'
   * 2. Increments retry_count
   * 3. Sets grace period if first failure
   * 4. Logs event
   */
  async processFailedPayment(
    paymentData: PaymentData,
    reason: string,
    failureCode?: string
  ): Promise<ProcessPaymentResult> {
    const { mpPaymentId, mpExternalReference } = paymentData;

    console.log('[PaymentProcessor] Processing failed payment:', mpPaymentId, reason);

    try {
      const refInfo = mpExternalReference
        ? parseExternalReference(mpExternalReference)
        : null;

      if (!refInfo) {
        // Try to find existing payment
        const existingPayment = await prisma.subscriptionPayment.findFirst({
          where: { mpPaymentId },
        });

        if (existingPayment) {
          return this.updatePaymentToFailed(
            existingPayment.id,
            reason,
            failureCode
          );
        }

        return {
          success: false,
          error: 'Could not identify organization from payment',
        };
      }

      const { organizationId, tier, billingCycle } = refInfo;

      const result = await prisma.$transaction(async (tx) => {
        // Get subscription
        let subscription = await tx.organizationSubscription.findUnique({
          where: { organizationId },
        });

        if (!subscription) {
          // Create subscription in failed state
          subscription = await tx.organizationSubscription.create({
            data: {
              organizationId,
              tier,
              billingCycle,
              status: 'past_due',
              currentPeriodStart: new Date(),
              currentPeriodEnd: calculatePeriodEnd(new Date(), billingCycle),
              gracePeriodEndsAt: this.calculateGracePeriodEnd(),
            },
          });
        } else {
          // Check if this is first failure (start grace period)
          const isFirstFailure = subscription.status === 'active';

          subscription = await tx.organizationSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'past_due',
              gracePeriodEndsAt: isFirstFailure
                ? this.calculateGracePeriodEnd()
                : subscription.gracePeriodEndsAt,
            },
          });
        }

        // Create failed payment record
        const payment = await tx.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            amount: paymentData.amount || 0,
            currency: paymentData.currency || 'ARS',
            status: 'failed',
            paymentType: 'recurring',
            paymentMethod: paymentData.paymentMethod,
            billingCycle,
            periodStart: new Date(),
            periodEnd: calculatePeriodEnd(new Date(), billingCycle),
            mpPaymentId,
            mpPreferenceId: paymentData.mpPreferenceId,
            mpExternalReference,
            failureReason: reason,
            failureCode,
            retryCount: 1,
            nextRetryAt: calculateNextRetry(0),
          },
        });

        // Update organization status
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            subscriptionStatus: 'past_due',
          },
        });

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'payment_failed',
            eventData: {
              payment_id: payment.id,
              mp_payment_id: mpPaymentId,
              failure_reason: reason,
              failure_code: failureCode,
              retry_count: 1,
              next_retry_at: calculateNextRetry(0)?.toISOString(),
              webhook_id: mpPaymentId,
            },
            actorType: 'webhook',
          },
        });

        // Log grace period start if first failure
        if (subscription.status === 'active') {
          await tx.subscriptionEvent.create({
            data: {
              subscriptionId: subscription.id,
              organizationId,
              eventType: 'grace_period_started',
              eventData: {
                grace_period_ends_at: this.calculateGracePeriodEnd().toISOString(),
                grace_period_days: GRACE_PERIOD_DAYS,
              },
              actorType: 'webhook',
            },
          });
        }

        return { subscription, payment };
      });

      // TODO: Send failure notification email
      // await sendPaymentFailureEmail(organizationId, result.payment, reason);

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        organizationId,
        action: 'payment_failed',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error processing failed payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing payment to failed status
   */
  private async updatePaymentToFailed(
    paymentId: string,
    reason: string,
    failureCode?: string
  ): Promise<ProcessPaymentResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.subscriptionPayment.findUnique({
          where: { id: paymentId },
          include: { subscription: true },
        });

        if (!payment) {
          throw new Error('Payment not found');
        }

        const newRetryCount = payment.retryCount + 1;

        // Update payment
        const updatedPayment = await tx.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'failed',
            failureReason: reason,
            failureCode,
            retryCount: newRetryCount,
            nextRetryAt: calculateNextRetry(newRetryCount - 1),
          },
        });

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: payment.subscriptionId,
            organizationId: payment.organizationId,
            eventType: 'payment_failed',
            eventData: {
              payment_id: paymentId,
              failure_reason: reason,
              failure_code: failureCode,
              retry_count: newRetryCount,
            },
            actorType: 'webhook',
          },
        });

        return { payment: updatedPayment };
      });

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: result.payment.subscriptionId,
        organizationId: result.payment.organizationId,
        action: 'payment_retry_failed',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error updating payment to failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a pending payment (cash/transfer)
   *
   * 1. Creates subscription_payments record with status='pending'
   * 2. Does NOT activate subscription yet
   * 3. Logs event
   */
  async processPendingPayment(
    paymentData: PaymentData
  ): Promise<ProcessPaymentResult> {
    const { mpPaymentId, mpExternalReference } = paymentData;

    console.log('[PaymentProcessor] Processing pending payment:', mpPaymentId);

    try {
      const refInfo = mpExternalReference
        ? parseExternalReference(mpExternalReference)
        : null;

      if (!refInfo) {
        return {
          success: false,
          error: 'Could not identify organization from payment',
        };
      }

      const { organizationId, tier, billingCycle } = refInfo;

      const result = await prisma.$transaction(async (tx) => {
        // Get or create subscription (but don't activate it)
        let subscription = await tx.organizationSubscription.findUnique({
          where: { organizationId },
        });

        if (!subscription) {
          subscription = await tx.organizationSubscription.create({
            data: {
              organizationId,
              tier,
              billingCycle,
              status: 'trialing', // Keep current status, don't activate
              currentPeriodStart: new Date(),
              currentPeriodEnd: calculatePeriodEnd(new Date(), billingCycle),
            },
          });
        }

        // Check for existing pending payment with same MP ID
        const existingPayment = await tx.subscriptionPayment.findFirst({
          where: { mpPaymentId },
        });

        if (existingPayment) {
          // Already have this payment, skip
          return { subscription, payment: existingPayment, skipped: true };
        }

        // Create pending payment record
        const payment = await tx.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            amount: paymentData.amount,
            currency: paymentData.currency || 'ARS',
            status: 'pending',
            paymentType: 'recurring',
            paymentMethod: paymentData.paymentMethod,
            billingCycle,
            periodStart: new Date(),
            periodEnd: calculatePeriodEnd(new Date(), billingCycle),
            mpPaymentId,
            mpPreferenceId: paymentData.mpPreferenceId,
            mpExternalReference,
          },
        });

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'payment_pending',
            eventData: {
              payment_id: payment.id,
              mp_payment_id: mpPaymentId,
              payment_method: paymentData.paymentMethod,
              amount: paymentData.amount,
              currency: paymentData.currency || 'ARS',
              webhook_id: mpPaymentId,
            },
            actorType: 'webhook',
          },
        });

        return { subscription, payment, skipped: false };
      });

      if (result.skipped) {
        console.log(
          '[PaymentProcessor] Pending payment already exists:',
          result.payment.id
        );
        return {
          success: true,
          paymentId: result.payment.id,
          subscriptionId: result.subscription.id,
          organizationId,
          action: 'payment_already_pending',
        };
      }

      // TODO: Send pending payment email with instructions
      // await sendPendingPaymentEmail(organizationId, result.payment);

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        organizationId,
        action: 'payment_pending_created',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error processing pending payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a refund
   *
   * 1. Updates payment status to 'refunded'
   * 2. If within 10 days (Ley 24.240), processes automatically
   * 3. Updates subscription status if needed
   * 4. Logs event
   */
  async processRefund(refundData: RefundData): Promise<ProcessPaymentResult> {
    const { mpPaymentId, reason } = refundData;

    console.log('[PaymentProcessor] Processing refund for payment:', mpPaymentId);

    try {
      // Find the payment
      const payment = await prisma.subscriptionPayment.findFirst({
        where: { mpPaymentId },
        include: { subscription: true },
      });

      if (!payment) {
        console.warn('[PaymentProcessor] Payment not found for refund:', mpPaymentId);
        return {
          success: false,
          error: 'Payment not found',
        };
      }

      // Check if refund is within Ley 24.240 window
      const withinLaw = payment.paidAt
        ? isWithinLey24240Window(payment.paidAt)
        : false;

      const result = await prisma.$transaction(async (tx) => {
        // Update payment to refunded
        const updatedPayment = await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
          },
        });

        // If this was the only/latest completed payment, downgrade subscription
        const otherCompletedPayments = await tx.subscriptionPayment.count({
          where: {
            subscriptionId: payment.subscriptionId,
            status: 'completed',
            id: { not: payment.id },
          },
        });

        if (otherCompletedPayments === 0) {
          // No other completed payments, cancel/expire subscription
          await tx.organizationSubscription.update({
            where: { id: payment.subscriptionId },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: reason || 'Payment refunded',
            },
          });

          // Downgrade organization
          await tx.organization.update({
            where: { id: payment.organizationId },
            data: {
              subscriptionTier: 'FREE',
              subscriptionStatus: 'cancelled',
            },
          });
        }

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: payment.subscriptionId,
            organizationId: payment.organizationId,
            eventType: 'payment_refunded',
            eventData: {
              payment_id: payment.id,
              mp_payment_id: mpPaymentId,
              refund_id: refundData.mpRefundId,
              refund_amount: refundData.amount || payment.amount.toNumber(),
              reason,
              within_ley_24240: withinLaw,
              refund_date: refundData.refundDate?.toISOString() || new Date().toISOString(),
            },
            actorType: 'webhook',
          },
        });

        return { payment: updatedPayment };
      });

      // TODO: Send refund confirmation email
      // await sendRefundConfirmationEmail(payment.organizationId, result.payment);

      return {
        success: true,
        paymentId: result.payment.id,
        subscriptionId: payment.subscriptionId,
        organizationId: payment.organizationId,
        action: withinLaw ? 'refund_ley_24240' : 'refund_processed',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error processing refund:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate grace period end date
   */
  private calculateGracePeriodEnd(): Date {
    const end = new Date();
    end.setDate(end.getDate() + GRACE_PERIOD_DAYS);
    return end;
  }

  /**
   * Handle subscription preapproval (recurring billing setup)
   */
  async processSubscriptionPreapproval(
    subscriptionId: string,
    organizationId: string,
    status: string
  ): Promise<ProcessPaymentResult> {
    console.log(
      '[PaymentProcessor] Processing subscription preapproval:',
      subscriptionId,
      status
    );

    try {
      const result = await prisma.$transaction(async (tx) => {
        const subscription = await tx.organizationSubscription.findUnique({
          where: { organizationId },
        });

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Update MP subscription ID
        const updated = await tx.organizationSubscription.update({
          where: { id: subscription.id },
          data: {
            mpSubscriptionId: subscriptionId,
          },
        });

        // Log event
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            eventType: 'preapproval_updated',
            eventData: {
              mp_subscription_id: subscriptionId,
              status,
            },
            actorType: 'webhook',
          },
        });

        return { subscription: updated };
      });

      return {
        success: true,
        subscriptionId: result.subscription.id,
        organizationId,
        action: 'preapproval_processed',
      };
    } catch (error) {
      console.error('[PaymentProcessor] Error processing preapproval:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const paymentProcessor = new PaymentProcessor();
