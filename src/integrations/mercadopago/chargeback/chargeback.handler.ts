/**
 * MercadoPago Chargeback Handler
 * ==============================
 *
 * Handles chargeback/dispute notifications from MercadoPago.
 * Chargebacks occur when a customer disputes a charge with their bank.
 *
 * Flow:
 * 1. Customer disputes charge with bank
 * 2. MercadoPago notifies via webhook (chargeback.created/updated)
 * 3. We update payment status and notify merchant
 * 4. Merchant can respond with evidence
 * 5. Resolution: won (funds returned) or lost (funds deducted)
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { getEventBus, EventTypes } from '../../../lib/services/event-bus';
import { makeAuthenticatedRequest } from '../oauth';
import { PaymentStatus } from '../mercadopago.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ChargebackStatus =
  | 'opened'
  | 'claim'
  | 'evidence_pending'
  | 'under_review'
  | 'resolved'
  | 'covered'
  | 'not_covered'
  | 'cancelled';

export type ChargebackReason =
  | 'fraud'
  | 'product_not_received'
  | 'product_not_as_described'
  | 'duplicate_charge'
  | 'credit_not_processed'
  | 'unrecognized'
  | 'other';

export interface Chargeback {
  id: number;
  paymentId: number;
  amount: number;
  currency: 'ARS';
  status: ChargebackStatus;
  reason: ChargebackReason;
  reasonDetail?: string;
  dateCreated: string;
  dateLastUpdated: string;
  documentationStatus?: 'not_required' | 'required' | 'provided';
  documentationDeadline?: string;
  coverage: {
    covered: boolean;
    coverageReason?: string;
  };
}

export interface ChargebackProcessResult {
  success: boolean;
  chargebackId: string;
  paymentId?: string;
  invoiceId?: string;
  status?: ChargebackStatus;
  action: 'created' | 'updated' | 'resolved';
  error?: string;
}

export interface ChargebackEvidence {
  type: 'document' | 'receipt' | 'tracking' | 'communication' | 'other';
  description: string;
  fileUrl?: string;
  fileContent?: Buffer;
  fileName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARGEBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class ChargebackHandler {
  /**
   * Process a chargeback webhook notification
   */
  async processChargebackNotification(
    accessToken: string,
    chargebackId: string,
    action: 'chargeback.created' | 'chargeback.updated',
    orgId: string
  ): Promise<ChargebackProcessResult> {
    try {
      // Fetch chargeback details from MercadoPago
      const fetchResult = await this.fetchChargeback(accessToken, chargebackId);
      if (!fetchResult.success) {
        return {
          success: false,
          chargebackId,
          action: action === 'chargeback.created' ? 'created' : 'updated',
          error: fetchResult.error,
        };
      }

      const chargeback = fetchResult.chargeback!;

      // Find associated payment and invoice
      const payment = await this.findPaymentByMPId(orgId, String(chargeback.paymentId));
      if (!payment) {
        log.warn('Chargeback for unknown payment', {
          chargebackId,
          paymentId: chargeback.paymentId,
        });

        // Still record the chargeback for tracking
        await this.saveChargebackRecord(orgId, chargeback, undefined);

        return {
          success: true,
          chargebackId,
          paymentId: String(chargeback.paymentId),
          status: chargeback.status,
          action: action === 'chargeback.created' ? 'created' : 'updated',
        };
      }

      // Save/update chargeback record
      await this.saveChargebackRecord(orgId, chargeback, payment.invoiceId);

      // Update payment status
      await this.updatePaymentForChargeback(payment.id, chargeback);

      // Update invoice status if exists
      if (payment.invoiceId) {
        await this.updateInvoiceForChargeback(payment.invoiceId, chargeback);
      }

      // Notify administrators
      await this.notifyAdminsOfChargeback(orgId, chargeback, payment.invoiceId);

      // Emit event
      const eventBus = getEventBus();
      eventBus.emit({
        type: EventTypes.PAYMENT_FAILED,
        orgId,
        data: {
          chargebackId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          status: chargeback.status,
          amount: chargeback.amount,
          reason: chargeback.reason,
        },
      });

      log.info('Chargeback processed', {
        orgId,
        chargebackId,
        paymentId: payment.id,
        status: chargeback.status,
        amount: chargeback.amount,
      });

      return {
        success: true,
        chargebackId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        status: chargeback.status,
        action: action === 'chargeback.created' ? 'created' : 'updated',
      };
    } catch (error) {
      log.error('Failed to process chargeback', {
        chargebackId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        success: false,
        chargebackId,
        action: action === 'chargeback.created' ? 'created' : 'updated',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch chargeback details from MercadoPago
   */
  async fetchChargeback(
    accessToken: string,
    chargebackId: string
  ): Promise<{ success: true; chargeback: Chargeback } | { success: false; error: string }> {
    const result = await makeAuthenticatedRequest<any>(
      accessToken,
      'GET',
      `/v1/chargebacks/${chargebackId}`
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Map API response to our type
    const data = result.data;
    const chargeback: Chargeback = {
      id: data.id,
      paymentId: data.payment_id,
      amount: data.amount,
      currency: data.currency_id || 'ARS',
      status: this.mapChargebackStatus(data.status),
      reason: this.mapChargebackReason(data.reason),
      reasonDetail: data.reason_detail,
      dateCreated: data.date_created,
      dateLastUpdated: data.date_last_updated,
      documentationStatus: data.documentation_status,
      documentationDeadline: data.documentation_deadline,
      coverage: {
        covered: data.coverage_applied === true,
        coverageReason: data.coverage_reason,
      },
    };

    return { success: true, chargeback };
  }

  /**
   * Submit evidence for a chargeback dispute
   */
  async submitEvidence(
    accessToken: string,
    chargebackId: string,
    evidence: ChargebackEvidence[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Build evidence payload
      const evidencePayload = evidence.map((e) => ({
        type: e.type,
        description: e.description,
        file: e.fileContent ? e.fileContent.toString('base64') : undefined,
        file_name: e.fileName,
        url: e.fileUrl,
      }));

      const result = await makeAuthenticatedRequest(
        accessToken,
        'POST',
        `/v1/chargebacks/${chargebackId}/documentation`,
        { files: evidencePayload }
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      log.info('Chargeback evidence submitted', {
        chargebackId,
        evidenceCount: evidence.length,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get chargeback history for an organization
   */
  async getChargebackHistory(
    orgId: string,
    filters?: {
      status?: ChargebackStatus;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<{
    chargebacks: any[];
    totalAmount: number;
    totalCount: number;
  }> {
    const where: any = { orgId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.fromDate) {
      where.createdAt = { gte: filters.fromDate };
    }
    if (filters?.toDate) {
      where.createdAt = { ...where.createdAt, lte: filters.toDate };
    }

    const chargebacks = await db.chargeback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      include: {
        payment: true,
        invoice: true,
      },
    });

    const totalAmount = chargebacks.reduce((sum, cb) => sum + cb.amount, 0);

    return {
      chargebacks,
      totalAmount,
      totalCount: chargebacks.length,
    };
  }

  /**
   * Get statistics for chargebacks
   */
  async getChargebackStats(orgId: string, days: number = 90): Promise<{
    total: number;
    won: number;
    lost: number;
    pending: number;
    totalAmountDisputed: number;
    totalAmountLost: number;
    winRate: number;
    byReason: Record<ChargebackReason, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const chargebacks = await db.chargeback.findMany({
      where: {
        orgId,
        createdAt: { gte: since },
      },
    });

    let won = 0;
    let lost = 0;
    let pending = 0;
    let totalAmountDisputed = 0;
    let totalAmountLost = 0;
    const byReason: Record<string, number> = {};

    for (const cb of chargebacks) {
      totalAmountDisputed += cb.amount;
      byReason[cb.reason] = (byReason[cb.reason] || 0) + 1;

      if (cb.status === 'resolved' || cb.status === 'covered') {
        won++;
      } else if (cb.status === 'not_covered') {
        lost++;
        totalAmountLost += cb.amount;
      } else {
        pending++;
      }
    }

    const resolved = won + lost;
    const winRate = resolved > 0 ? won / resolved : 0;

    return {
      total: chargebacks.length,
      won,
      lost,
      pending,
      totalAmountDisputed,
      totalAmountLost,
      winRate,
      byReason: byReason as Record<ChargebackReason, number>,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async findPaymentByMPId(
    orgId: string,
    mpPaymentId: string
  ): Promise<{ id: string; invoiceId?: string } | null> {
    const payment = await db.payment.findFirst({
      where: {
        organizationId: orgId,
        reference: mpPaymentId, // MP payment ID stored as reference
      },
      select: {
        id: true,
        invoiceId: true,
      },
    });

    return payment;
  }

  private async saveChargebackRecord(
    orgId: string,
    chargeback: Chargeback,
    invoiceId?: string
  ): Promise<void> {
    await db.chargeback.upsert({
      where: {
        mpChargebackId: String(chargeback.id),
      },
      create: {
        orgId,
        mpChargebackId: String(chargeback.id),
        mpPaymentId: String(chargeback.paymentId),
        invoiceId,
        amount: chargeback.amount,
        currency: chargeback.currency,
        status: chargeback.status,
        reason: chargeback.reason,
        reasonDetail: chargeback.reasonDetail,
        documentationStatus: chargeback.documentationStatus,
        documentationDeadline: chargeback.documentationDeadline
          ? new Date(chargeback.documentationDeadline)
          : undefined,
        covered: chargeback.coverage.covered,
        coverageReason: chargeback.coverage.coverageReason,
        mpCreatedAt: new Date(chargeback.dateCreated),
        mpUpdatedAt: new Date(chargeback.dateLastUpdated),
      },
      update: {
        status: chargeback.status,
        reasonDetail: chargeback.reasonDetail,
        documentationStatus: chargeback.documentationStatus,
        documentationDeadline: chargeback.documentationDeadline
          ? new Date(chargeback.documentationDeadline)
          : undefined,
        covered: chargeback.coverage.covered,
        coverageReason: chargeback.coverage.coverageReason,
        mpUpdatedAt: new Date(chargeback.dateLastUpdated),
        updatedAt: new Date(),
      },
    });
  }

  private async updatePaymentForChargeback(
    paymentId: string,
    chargeback: Chargeback
  ): Promise<void> {
    const newStatus = this.getPaymentStatusForChargeback(chargeback.status);

    await db.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        metadata: {
          chargeback: {
            id: chargeback.id,
            status: chargeback.status,
            reason: chargeback.reason,
            amount: chargeback.amount,
            updatedAt: chargeback.dateLastUpdated,
          },
        },
      },
    });
  }

  private async updateInvoiceForChargeback(
    invoiceId: string,
    chargeback: Chargeback
  ): Promise<void> {
    // Determine invoice status based on chargeback outcome
    let invoiceStatus: string;

    if (chargeback.status === 'resolved' || chargeback.status === 'covered' || chargeback.status === 'cancelled') {
      // Chargeback resolved in our favor - keep as paid
      invoiceStatus = 'paid';
    } else if (chargeback.status === 'not_covered') {
      // We lost the chargeback - mark as disputed/refunded
      invoiceStatus = 'refunded';
    } else {
      // Ongoing dispute - mark as in_dispute
      invoiceStatus = 'in_dispute';
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: invoiceStatus,
        metadata: {
          chargeback: {
            id: chargeback.id,
            status: chargeback.status,
            reason: chargeback.reason,
          },
        },
      },
    });
  }

  private async notifyAdminsOfChargeback(
    orgId: string,
    chargeback: Chargeback,
    invoiceId?: string
  ): Promise<void> {
    const admins = await db.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['owner', 'admin', 'accountant'] },
      },
      select: { id: true },
    });

    const title = this.getNotificationTitle(chargeback.status);
    const body = this.getNotificationBody(chargeback);
    const priority = chargeback.status === 'evidence_pending' ? 'critical' : 'high';

    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'chargeback',
          title,
          body,
          metadata: {
            chargebackId: chargeback.id,
            paymentId: chargeback.paymentId,
            invoiceId,
            status: chargeback.status,
            reason: chargeback.reason,
            amount: chargeback.amount,
            documentationDeadline: chargeback.documentationDeadline,
          },
          priority,
        },
      });
    }

    log.info('Chargeback notification sent to admins', {
      orgId,
      chargebackId: chargeback.id,
      adminCount: admins.length,
    });
  }

  private getNotificationTitle(status: ChargebackStatus): string {
    const titles: Record<ChargebackStatus, string> = {
      opened: '⚠️ Nueva disputa de pago',
      claim: '⚠️ Reclamo de pago iniciado',
      evidence_pending: '🚨 URGENTE: Se requiere documentación',
      under_review: '🔍 Disputa en revisión',
      resolved: '✅ Disputa resuelta a favor',
      covered: '✅ Disputa cubierta por MercadoPago',
      not_covered: '❌ Disputa perdida',
      cancelled: '✅ Disputa cancelada',
    };

    return titles[status];
  }

  private getNotificationBody(chargeback: Chargeback): string {
    const amount = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(chargeback.amount);

    const reasonLabel = this.getReasonLabel(chargeback.reason);

    let body = `Monto: ${amount}\nMotivo: ${reasonLabel}`;

    if (chargeback.documentationDeadline) {
      const deadline = new Date(chargeback.documentationDeadline);
      body += `\n⏰ Fecha límite: ${deadline.toLocaleDateString('es-AR')}`;
    }

    if (chargeback.status === 'evidence_pending') {
      body += '\n\nSe requiere presentar documentación para disputar el contracargo.';
    }

    return body;
  }

  private getReasonLabel(reason: ChargebackReason): string {
    const labels: Record<ChargebackReason, string> = {
      fraud: 'Fraude / No autorizado',
      product_not_received: 'Producto no recibido',
      product_not_as_described: 'Producto diferente al descrito',
      duplicate_charge: 'Cobro duplicado',
      credit_not_processed: 'Reembolso no procesado',
      unrecognized: 'Cargo no reconocido',
      other: 'Otro motivo',
    };

    return labels[reason];
  }

  private getPaymentStatusForChargeback(chargebackStatus: ChargebackStatus): string {
    if (chargebackStatus === 'resolved' || chargebackStatus === 'covered' || chargebackStatus === 'cancelled') {
      return 'completed';
    }
    if (chargebackStatus === 'not_covered') {
      return 'charged_back';
    }
    return 'in_dispute';
  }

  private mapChargebackStatus(apiStatus: string): ChargebackStatus {
    const statusMap: Record<string, ChargebackStatus> = {
      opened: 'opened',
      claim: 'claim',
      evidence_pending: 'evidence_pending',
      waiting_evidence: 'evidence_pending',
      under_review: 'under_review',
      review: 'under_review',
      resolved: 'resolved',
      covered: 'covered',
      not_covered: 'not_covered',
      cancelled: 'cancelled',
    };

    return statusMap[apiStatus] || 'opened';
  }

  private mapChargebackReason(apiReason: string): ChargebackReason {
    const reasonMap: Record<string, ChargebackReason> = {
      fraud: 'fraud',
      not_authorized: 'fraud',
      product_not_received: 'product_not_received',
      goods_not_received: 'product_not_received',
      product_not_as_described: 'product_not_as_described',
      goods_not_as_described: 'product_not_as_described',
      duplicate: 'duplicate_charge',
      duplicate_charge: 'duplicate_charge',
      credit_not_processed: 'credit_not_processed',
      unrecognized: 'unrecognized',
      other: 'other',
    };

    return reasonMap[apiReason] || 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let chargebackHandlerInstance: ChargebackHandler | null = null;

export function getChargebackHandler(): ChargebackHandler {
  if (!chargebackHandlerInstance) {
    chargebackHandlerInstance = new ChargebackHandler();
  }
  return chargebackHandlerInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process a chargeback notification from MercadoPago webhook
 */
export async function processChargebackWebhook(
  accessToken: string,
  chargebackId: string,
  action: 'chargeback.created' | 'chargeback.updated',
  orgId: string
): Promise<ChargebackProcessResult> {
  const handler = getChargebackHandler();
  return handler.processChargebackNotification(accessToken, chargebackId, action, orgId);
}
