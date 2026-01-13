/**
 * CampoTech Subscription Cancellation Service
 * =============================================
 *
 * Handles subscription cancellations per Ley 24.240 (Consumer Protection).
 * Key requirements:
 * - "Botón de Arrepentimiento" must be visible
 * - 10-day withdrawal period for full refund
 * - Clear cancellation process
 *
 * @see https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Ley 24.240 withdrawal period in days */
export const WITHDRAWAL_PERIOD_DAYS = 10;

/** Maximum days to process refund after cancellation */
export const REFUND_PROCESSING_DAYS = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CancellationReason =
  | 'arrepentimiento' // Right of withdrawal (Ley 24.240)
  | 'no_longer_needed'
  | 'too_expensive'
  | 'missing_features'
  | 'switching_competitor'
  | 'technical_issues'
  | 'other';

export type CancellationStatus =
  | 'pending'
  | 'processing'
  | 'refund_pending'
  | 'refund_completed'
  | 'completed'
  | 'cancelled';

export type RefundStatus =
  | 'not_applicable'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CancellationRequest {
  id: string;
  organizationId: string;
  userId: string;
  reason: CancellationReason;
  reasonDetails?: string;
  status: CancellationStatus;
  refundStatus: RefundStatus;
  refundAmount?: number;
  refundCurrency: 'ARS';
  /** Whether eligible for full refund (within 10 days) */
  eligibleForRefund: boolean;
  subscriptionStartDate?: Date;
  requestedAt: Date;
  processedAt?: Date;
  refundProcessedAt?: Date;
  effectiveDate?: Date;
  mercadoPagoPaymentId?: string;
  mercadoPagoRefundId?: string;
}

export interface CancellationResult {
  success: boolean;
  cancellationId?: string;
  eligibleForRefund: boolean;
  refundAmount?: number;
  effectiveDate?: Date;
  message: string;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  message: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CANCELLATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SubscriptionCancellationService {
  /**
   * Request subscription cancellation (Botón de Arrepentimiento)
   */
  async requestCancellation(params: {
    organizationId: string;
    userId: string;
    reason: CancellationReason;
    reasonDetails?: string;
  }): Promise<CancellationResult> {
    const { organizationId, userId, reason, reasonDetails } = params;

    try {
      // Check for existing pending cancellation
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM subscription_cancellations
        WHERE organization_id = ${organizationId}::uuid
        AND status IN ('pending', 'processing', 'refund_pending')
        LIMIT 1
      `;

      if (existing.length > 0) {
        return {
          success: false,
          eligibleForRefund: false,
          message: 'Ya existe una solicitud de cancelación pendiente.',
          error: 'CANCELLATION_ALREADY_PENDING',
        };
      }

      // Get subscription info
      const subscription = await this.getSubscriptionInfo(organizationId);
      if (!subscription) {
        return {
          success: false,
          eligibleForRefund: false,
          message: 'No se encontró una suscripción activa.',
          error: 'NO_ACTIVE_SUBSCRIPTION',
        };
      }

      // Check if eligible for refund (within 10-day withdrawal period)
      const eligibleForRefund = this.isWithinWithdrawalPeriod(subscription.startDate);
      const refundAmount = eligibleForRefund ? subscription.lastPaymentAmount : 0;

      // Calculate effective cancellation date
      const effectiveDate = this.calculateEffectiveDate(eligibleForRefund);

      // Create cancellation request
      const cancellationId = await this.createCancellationRecord({
        organizationId,
        userId,
        reason,
        reasonDetails,
        eligibleForRefund,
        refundAmount,
        effectiveDate,
        subscriptionStartDate: subscription.startDate,
        mercadoPagoPaymentId: subscription.lastPaymentId,
      });

      // If eligible for refund, initiate refund process
      if (eligibleForRefund && refundAmount > 0) {
        await this.initiateRefund(cancellationId, organizationId);
      }

      return {
        success: true,
        cancellationId,
        eligibleForRefund,
        refundAmount: eligibleForRefund ? refundAmount : undefined,
        effectiveDate,
        message: eligibleForRefund
          ? `Tu cancelación ha sido procesada. Recibirás un reembolso de $${refundAmount?.toFixed(2)} ARS dentro de ${REFUND_PROCESSING_DAYS} días hábiles.`
          : `Tu suscripción será cancelada el ${effectiveDate.toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}. Podrás seguir usando el servicio hasta esa fecha.`,
      };
    } catch (error) {
      console.error('Error requesting cancellation:', error);
      return {
        success: false,
        eligibleForRefund: false,
        message: 'Error al procesar la solicitud de cancelación.',
        error: String(error),
      };
    }
  }

  /**
   * Check if within the 10-day withdrawal period (Ley 24.240)
   */
  isWithinWithdrawalPeriod(subscriptionStartDate: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - subscriptionStartDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= WITHDRAWAL_PERIOD_DAYS;
  }

  /**
   * Calculate when cancellation becomes effective
   */
  private calculateEffectiveDate(immediateCancel: boolean): Date {
    if (immediateCancel) {
      return new Date(); // Immediate for refund cases
    }
    // End of current billing period (simplified - end of month)
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  /**
   * Get subscription info for organization
   */
  private async getSubscriptionInfo(organizationId: string): Promise<{
    tierId: string;
    startDate: Date;
    lastPaymentAmount: number;
    lastPaymentId?: string;
  } | null> {
    try {
      const result = await prisma.$queryRaw<Array<{
        tier_id: string;
        subscription_started_at: Date;
        last_payment_amount: number | null;
        last_payment_id: string | null;
      }>>`
        SELECT
          o.tier_id,
          COALESCE(os.subscription_started_at, o.created_at) as subscription_started_at,
          os.last_payment_amount,
          os.last_payment_id
        FROM organizations o
        LEFT JOIN organization_settings os ON os.organization_id = o.id
        WHERE o.id = ${organizationId}::uuid
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const r = result[0];
      return {
        tierId: r.tier_id,
        startDate: r.subscription_started_at,
        lastPaymentAmount: r.last_payment_amount || 0,
        lastPaymentId: r.last_payment_id || undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create cancellation record in database
   */
  private async createCancellationRecord(params: {
    organizationId: string;
    userId: string;
    reason: CancellationReason;
    reasonDetails?: string;
    eligibleForRefund: boolean;
    refundAmount?: number;
    effectiveDate: Date;
    subscriptionStartDate: Date;
    mercadoPagoPaymentId?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();

    await prisma.$executeRaw`
      INSERT INTO subscription_cancellations (
        id,
        organization_id,
        user_id,
        reason,
        reason_details,
        status,
        refund_status,
        eligible_for_refund,
        refund_amount,
        refund_currency,
        subscription_start_date,
        effective_date,
        mercadopago_payment_id,
        requested_at
      ) VALUES (
        ${id}::uuid,
        ${params.organizationId}::uuid,
        ${params.userId}::uuid,
        ${params.reason},
        ${params.reasonDetails || null},
        'pending',
        ${params.eligibleForRefund ? 'pending' : 'not_applicable'},
        ${params.eligibleForRefund},
        ${params.refundAmount || null},
        'ARS',
        ${params.subscriptionStartDate},
        ${params.effectiveDate},
        ${params.mercadoPagoPaymentId || null},
        NOW()
      )
    `;

    return id;
  }

  /**
   * Initiate refund process through MercadoPago
   */
  private async initiateRefund(
    cancellationId: string,
    organizationId: string
  ): Promise<RefundResult> {
    try {
      // Update status to processing
      await prisma.$executeRaw`
        UPDATE subscription_cancellations
        SET
          status = 'refund_pending',
          refund_status = 'processing'
        WHERE id = ${cancellationId}::uuid
      `;

      // Get MercadoPago credentials
      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId },
        select: {
          mercadoPagoAccessToken: true,
          mercadoPagoEnabled: true,
        },
      });

      if (!settings?.mercadoPagoAccessToken || !settings.mercadoPagoEnabled) {
        // Manual refund required
        await prisma.$executeRaw`
          UPDATE subscription_cancellations
          SET
            refund_status = 'pending',
            notes = 'Reembolso manual requerido - MercadoPago no configurado'
          WHERE id = ${cancellationId}::uuid
        `;

        return {
          success: false,
          message: 'Refund will be processed manually',
          error: 'MANUAL_REFUND_REQUIRED',
        };
      }

      // Get cancellation details
      const cancellation = await prisma.$queryRaw<Array<{
        refund_amount: number;
        mercadopago_payment_id: string | null;
      }>>`
        SELECT refund_amount, mercadopago_payment_id
        FROM subscription_cancellations
        WHERE id = ${cancellationId}::uuid
      `;

      if (cancellation.length === 0 || !cancellation[0].mercadopago_payment_id) {
        return {
          success: false,
          message: 'No payment found to refund',
          error: 'NO_PAYMENT_TO_REFUND',
        };
      }

      // Process refund through MercadoPago API
      const refundResult = await this.processMercadoPagoRefund(
        settings.mercadoPagoAccessToken,
        cancellation[0].mercadopago_payment_id,
        cancellation[0].refund_amount
      );

      if (refundResult.success) {
        await prisma.$executeRaw`
          UPDATE subscription_cancellations
          SET
            status = 'refund_completed',
            refund_status = 'completed',
            mercadopago_refund_id = ${refundResult.refundId},
            refund_processed_at = NOW()
          WHERE id = ${cancellationId}::uuid
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE subscription_cancellations
          SET
            refund_status = 'failed',
            notes = ${refundResult.error || 'Refund failed'}
          WHERE id = ${cancellationId}::uuid
        `;
      }

      return refundResult;
    } catch (error) {
      console.error('Error initiating refund:', error);
      return {
        success: false,
        message: 'Error processing refund',
        error: String(error),
      };
    }
  }

  /**
   * Process refund through MercadoPago API
   */
  private async processMercadoPagoRefund(
    accessToken: string,
    paymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    try {
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `refund-${paymentId}-${Date.now()}`,
          },
          body: amount ? JSON.stringify({ amount }) : undefined,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || 'Refund failed',
          error: `HTTP ${response.status}: ${errorData.error || 'Unknown error'}`,
        };
      }

      const refund = await response.json();

      return {
        success: true,
        refundId: refund.id?.toString(),
        amount: refund.amount,
        message: 'Refund processed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error calling MercadoPago API',
        error: String(error),
      };
    }
  }

  /**
   * Get cancellation status
   */
  async getCancellationStatus(
    organizationId: string
  ): Promise<CancellationRequest | null> {
    try {
      const result = await prisma.$queryRaw<Array<{
        id: string;
        organization_id: string;
        user_id: string;
        reason: string;
        reason_details: string | null;
        status: string;
        refund_status: string;
        refund_amount: number | null;
        eligible_for_refund: boolean;
        subscription_start_date: Date | null;
        requested_at: Date;
        processed_at: Date | null;
        refund_processed_at: Date | null;
        effective_date: Date | null;
        mercadopago_payment_id: string | null;
        mercadopago_refund_id: string | null;
      }>>`
        SELECT *
        FROM subscription_cancellations
        WHERE organization_id = ${organizationId}::uuid
        AND status NOT IN ('completed', 'cancelled')
        ORDER BY requested_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const r = result[0];
      return {
        id: r.id,
        organizationId: r.organization_id,
        userId: r.user_id,
        reason: r.reason as CancellationReason,
        reasonDetails: r.reason_details || undefined,
        status: r.status as CancellationStatus,
        refundStatus: r.refund_status as RefundStatus,
        refundAmount: r.refund_amount || undefined,
        refundCurrency: 'ARS',
        eligibleForRefund: r.eligible_for_refund,
        subscriptionStartDate: r.subscription_start_date || undefined,
        requestedAt: r.requested_at,
        processedAt: r.processed_at || undefined,
        refundProcessedAt: r.refund_processed_at || undefined,
        effectiveDate: r.effective_date || undefined,
        mercadoPagoPaymentId: r.mercadopago_payment_id || undefined,
        mercadoPagoRefundId: r.mercadopago_refund_id || undefined,
      };
    } catch (error) {
      console.error('Error getting cancellation status:', error);
      return null;
    }
  }

  /**
   * Cancel a pending cancellation request
   */
  async cancelCancellationRequest(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await prisma.$executeRaw`
        UPDATE subscription_cancellations
        SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = ${userId}::uuid
        WHERE organization_id = ${organizationId}::uuid
        AND status = 'pending'
        AND refund_status NOT IN ('completed', 'processing')
      `;

      if (result === 0) {
        return {
          success: false,
          message: 'No se encontró una solicitud de cancelación que pueda ser revertida.',
        };
      }

      return {
        success: true,
        message: 'La solicitud de cancelación ha sido revertida. Tu suscripción continúa activa.',
      };
    } catch (error) {
      console.error('Error cancelling cancellation request:', error);
      return {
        success: false,
        message: 'Error al revertir la solicitud.',
      };
    }
  }

  /**
   * Process pending cancellations (called by cron job)
   */
  async processPendingCancellations(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Find all cancellations that have reached their effective date
      const pendingCancellations = await prisma.$queryRaw<Array<{
        id: string;
        organization_id: string;
      }>>`
        SELECT id, organization_id
        FROM subscription_cancellations
        WHERE status IN ('pending', 'refund_completed')
        AND effective_date <= NOW()
      `;

      for (const cancellation of pendingCancellations) {
        try {
          // Downgrade organization to free tier
          await prisma.organization.update({
            where: { id: cancellation.organization_id },
            data: { tierId: 'FREE' },
          });

          // Mark cancellation as completed
          await prisma.$executeRaw`
            UPDATE subscription_cancellations
            SET
              status = 'completed',
              processed_at = NOW()
            WHERE id = ${cancellation.id}::uuid
          `;

          processed++;
        } catch (error) {
          console.error(`Error processing cancellation ${cancellation.id}:`, error);
          errors++;
        }
      }
    } catch (error) {
      console.error('Error in processPendingCancellations:', error);
    }

    return { processed, errors };
  }

  /**
   * Get cancellation eligibility info for UI
   */
  async getEligibilityInfo(organizationId: string): Promise<{
    canCancel: boolean;
    eligibleForRefund: boolean;
    daysUntilRefundExpires: number | null;
    currentPlan: string;
    refundAmount: number | null;
    message: string;
  }> {
    const subscription = await this.getSubscriptionInfo(organizationId);

    if (!subscription) {
      return {
        canCancel: false,
        eligibleForRefund: false,
        daysUntilRefundExpires: null,
        currentPlan: 'FREE',
        refundAmount: null,
        message: 'No tienes una suscripción activa para cancelar.',
      };
    }

    if (subscription.tierId === 'FREE') {
      return {
        canCancel: false,
        eligibleForRefund: false,
        daysUntilRefundExpires: null,
        currentPlan: 'Gratis',
        refundAmount: null,
        message: 'Ya estás en el plan gratuito.',
      };
    }

    const eligibleForRefund = this.isWithinWithdrawalPeriod(subscription.startDate);
    const daysSinceStart = Math.floor(
      (Date.now() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilRefundExpires = eligibleForRefund
      ? WITHDRAWAL_PERIOD_DAYS - daysSinceStart
      : null;

    return {
      canCancel: true,
      eligibleForRefund,
      daysUntilRefundExpires,
      currentPlan: subscription.tierId,
      refundAmount: eligibleForRefund ? subscription.lastPaymentAmount : null,
      message: eligibleForRefund
        ? `Tenés ${daysUntilRefundExpires} días para solicitar el reembolso completo según la Ley 24.240.`
        : 'Tu suscripción será cancelada al final del período de facturación actual.',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let cancellationServiceInstance: SubscriptionCancellationService | null = null;

export function getSubscriptionCancellationService(): SubscriptionCancellationService {
  if (!cancellationServiceInstance) {
    cancellationServiceInstance = new SubscriptionCancellationService();
  }
  return cancellationServiceInstance;
}

export const subscriptionCancellation = getSubscriptionCancellationService();
