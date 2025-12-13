/**
 * MercadoPago Fallback Handler
 * ============================
 *
 * Handles fallback scenarios when MercadoPago integration fails.
 * Creates manual payment records and notifies administrators.
 *
 * Fallback scenarios:
 * - MercadoPago API unavailable
 * - Panic mode activated
 * - Max retries exceeded
 * - Authentication failures
 * - Rate limiting
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getEventBus, EventTypes } from '../../lib/services/event-bus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FallbackReason =
  | 'api_unavailable'
  | 'panic_mode'
  | 'max_retries'
  | 'auth_failure'
  | 'rate_limited'
  | 'preference_failed'
  | 'webhook_failed'
  | 'manual';

export interface FallbackPayment {
  id: string;
  orgId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: 'ARS';
  reason: FallbackReason;
  originalError?: string;
  suggestedMethod: 'cash' | 'transfer' | 'card_present';
  notificationSent: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolvedMethod?: string;
  createdAt: Date;
}

export interface FallbackResult {
  success: boolean;
  fallbackId?: string;
  message?: string;
  suggestedActions: string[];
}

export interface FallbackConfig {
  /** Auto-notify admins on fallback (default: true) */
  autoNotifyAdmins: boolean;
  /** Auto-notify customers on fallback (default: false) */
  autoNotifyCustomers: boolean;
  /** Default suggested payment method */
  defaultSuggestedMethod: 'cash' | 'transfer' | 'card_present';
  /** Max fallbacks before escalation */
  escalationThreshold: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: FallbackConfig = {
  autoNotifyAdmins: true,
  autoNotifyCustomers: false,
  defaultSuggestedMethod: 'transfer',
  escalationThreshold: 5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class MPFallbackHandler {
  private config: FallbackConfig;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a fallback payment record when MercadoPago fails
   */
  async createFallbackPayment(
    orgId: string,
    invoiceId: string,
    reason: FallbackReason,
    originalError?: string
  ): Promise<FallbackResult> {
    try {
      // Get invoice details
      const invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true },
      });

      if (!invoice) {
        return {
          success: false,
          message: 'Invoice not found',
          suggestedActions: [],
        };
      }

      // Create fallback payment record
      const fallbackId = await this.saveFallbackRecord({
        orgId,
        invoiceId,
        customerId: invoice.customerId,
        amount: invoice.total,
        reason,
        originalError,
      });

      // Update invoice status to indicate payment issue
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          metadata: {
            ...(invoice.metadata as object || {}),
            mpFallback: {
              fallbackId,
              reason,
              createdAt: new Date().toISOString(),
            },
          },
        },
      });

      // Notify administrators
      if (this.config.autoNotifyAdmins) {
        await this.notifyAdmins(orgId, invoiceId, reason, invoice.total);
      }

      // Optionally notify customer
      if (this.config.autoNotifyCustomers && invoice.customer) {
        await this.notifyCustomer(
          orgId,
          invoice.customer.id,
          invoice.customer.phone || undefined,
          invoiceId,
          invoice.total
        );
      }

      // Emit event for monitoring
      const eventBus = getEventBus();
      eventBus.emit({
        type: EventTypes.PAYMENT_FAILED,
        orgId,
        data: {
          invoiceId,
          reason,
          fallbackId,
          amount: invoice.total,
        },
      });

      // Check if escalation needed
      const fallbackCount = await this.countRecentFallbacks(orgId);
      const suggestedActions = this.getSuggestedActions(reason, fallbackCount);

      if (fallbackCount >= this.config.escalationThreshold) {
        await this.escalateToSupport(orgId, fallbackCount);
        suggestedActions.push('High volume of fallbacks - support ticket created');
      }

      log.warn('Fallback payment created', {
        orgId,
        invoiceId,
        fallbackId,
        reason,
        amount: invoice.total,
      });

      return {
        success: true,
        fallbackId,
        message: this.getFallbackMessage(reason),
        suggestedActions,
      };
    } catch (error) {
      log.error('Failed to create fallback payment', {
        orgId,
        invoiceId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create fallback',
        suggestedActions: ['Contact support', 'Retry payment manually'],
      };
    }
  }

  /**
   * Resolve a fallback payment with actual payment
   */
  async resolveFallback(
    fallbackId: string,
    resolvedBy: string,
    paymentMethod: 'cash' | 'transfer' | 'card_present' | 'mercadopago',
    paymentDetails?: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Update fallback record
      await db.fallbackPayment.update({
        where: { id: fallbackId },
        data: {
          resolvedAt: new Date(),
          resolvedBy,
          resolvedMethod: paymentMethod,
          metadata: paymentDetails,
        },
      });

      // Get the fallback to update invoice
      const fallback = await db.fallbackPayment.findUnique({
        where: { id: fallbackId },
      });

      if (fallback) {
        // Create actual payment record
        await db.payment.create({
          data: {
            organizationId: fallback.orgId,
            invoiceId: fallback.invoiceId,
            amount: fallback.amount,
            method: paymentMethod,
            status: 'COMPLETED',
            reference: `fallback_${fallbackId}`, // Store fallback reference
            paidAt: new Date(),
          },
        });

        // Update invoice status
        await db.invoice.update({
          where: { id: fallback.invoiceId },
          data: { status: 'PAID' },
        });

        log.info('Fallback payment resolved', {
          fallbackId,
          invoiceId: fallback.invoiceId,
          method: paymentMethod,
          resolvedBy,
        });
      }

      return { success: true };
    } catch (error) {
      log.error('Failed to resolve fallback payment', {
        fallbackId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resolve',
      };
    }
  }

  /**
   * Get pending fallback payments for an organization
   */
  async getPendingFallbacks(orgId: string): Promise<FallbackPayment[]> {
    const fallbacks = await db.fallbackPayment.findMany({
      where: {
        orgId,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return fallbacks as FallbackPayment[];
  }

  /**
   * Get fallback statistics for an organization
   */
  async getFallbackStats(orgId: string, days: number = 30): Promise<{
    total: number;
    pending: number;
    resolved: number;
    byReason: Record<FallbackReason, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const fallbacks = await db.fallbackPayment.findMany({
      where: {
        orgId,
        createdAt: { gte: since },
      },
    });

    const byReason: Record<string, number> = {};
    let pending = 0;
    let resolved = 0;

    for (const f of fallbacks) {
      byReason[f.reason] = (byReason[f.reason] || 0) + 1;
      if (f.resolvedAt) {
        resolved++;
      } else {
        pending++;
      }
    }

    return {
      total: fallbacks.length,
      pending,
      resolved,
      byReason: byReason as Record<FallbackReason, number>,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async saveFallbackRecord(data: {
    orgId: string;
    invoiceId: string;
    customerId: string;
    amount: number;
    reason: FallbackReason;
    originalError?: string;
  }): Promise<string> {
    const fallback = await db.fallbackPayment.create({
      data: {
        orgId: data.orgId,
        invoiceId: data.invoiceId,
        customerId: data.customerId,
        amount: data.amount,
        currency: 'ARS',
        reason: data.reason,
        originalError: data.originalError,
        suggestedMethod: this.config.defaultSuggestedMethod,
        notificationSent: false,
      },
    });

    return fallback.id;
  }

  private async notifyAdmins(
    orgId: string,
    invoiceId: string,
    reason: FallbackReason,
    amount: number
  ): Promise<void> {
    const admins = await db.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'payment_fallback',
          title: '⚠️ Pago requiere atención manual',
          body: `El cobro de la factura (${this.formatCurrency(amount)}) no pudo procesarse automáticamente. Razón: ${this.getReasonLabel(reason)}`,
          metadata: {
            invoiceId,
            reason,
            amount,
          },
          priority: 'high',
        },
      });
    }
  }

  private async notifyCustomer(
    orgId: string,
    customerId: string,
    phone: string | undefined,
    invoiceId: string,
    amount: number
  ): Promise<void> {
    if (!phone) return;

    // Queue WhatsApp message (if not in panic mode)
    // This would integrate with the WhatsApp service
    log.info('Customer fallback notification queued', {
      orgId,
      customerId,
      invoiceId,
    });
  }

  private async countRecentFallbacks(orgId: string): Promise<number> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const count = await db.fallbackPayment.count({
      where: {
        orgId,
        createdAt: { gte: oneHourAgo },
      },
    });

    return count;
  }

  private async escalateToSupport(orgId: string, fallbackCount: number): Promise<void> {
    // Create support ticket or high-priority notification
    await db.supportTicket.create({
      data: {
        orgId,
        type: 'payment_issues',
        priority: 'high',
        subject: 'Alto volumen de pagos fallidos',
        description: `Se detectaron ${fallbackCount} pagos que requieren atención manual en la última hora. Por favor revisar la configuración de MercadoPago.`,
        status: 'open',
      },
    });

    log.error('Payment fallbacks escalated to support', {
      orgId,
      fallbackCount,
    });
  }

  private getSuggestedActions(reason: FallbackReason, fallbackCount: number): string[] {
    const actions: string[] = [];

    switch (reason) {
      case 'auth_failure':
        actions.push('Verificar credenciales de MercadoPago');
        actions.push('Re-conectar cuenta de MercadoPago en Configuración');
        break;

      case 'rate_limited':
        actions.push('Esperar 5-10 minutos antes de reintentar');
        actions.push('Reducir frecuencia de operaciones');
        break;

      case 'api_unavailable':
        actions.push('Verificar estado de MercadoPago (status.mercadopago.com)');
        actions.push('Cobrar manualmente con transferencia o efectivo');
        break;

      case 'panic_mode':
        actions.push('Resolver modo pánico en Configuración > Integraciones');
        actions.push('Usar métodos de pago alternativos');
        break;

      case 'max_retries':
        actions.push('Revisar logs de errores');
        actions.push('Reintentar manualmente');
        break;

      default:
        actions.push('Contactar soporte técnico');
    }

    // Add common actions
    actions.push('Registrar pago manual si el cliente ya pagó');

    if (fallbackCount >= 3) {
      actions.push('Considerar desactivar MercadoPago temporalmente');
    }

    return actions;
  }

  private getFallbackMessage(reason: FallbackReason): string {
    const messages: Record<FallbackReason, string> = {
      api_unavailable: 'MercadoPago no está disponible. Se requiere cobro manual.',
      panic_mode: 'Integración con MercadoPago pausada. Se requiere cobro manual.',
      max_retries: 'No se pudo procesar el pago después de varios intentos.',
      auth_failure: 'Error de autenticación con MercadoPago. Verificar credenciales.',
      rate_limited: 'Se excedió el límite de operaciones. Reintentar más tarde.',
      preference_failed: 'No se pudo crear el link de pago.',
      webhook_failed: 'No se pudo procesar la notificación de pago.',
      manual: 'Pago marcado para procesamiento manual.',
    };

    return messages[reason];
  }

  private getReasonLabel(reason: FallbackReason): string {
    const labels: Record<FallbackReason, string> = {
      api_unavailable: 'API no disponible',
      panic_mode: 'Modo pánico',
      max_retries: 'Reintentos agotados',
      auth_failure: 'Error de autenticación',
      rate_limited: 'Límite de solicitudes',
      preference_failed: 'Error al crear link',
      webhook_failed: 'Error en webhook',
      manual: 'Manual',
    };

    return labels[reason];
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let fallbackHandlerInstance: MPFallbackHandler | null = null;

/**
 * Get the global fallback handler instance
 */
export function getMPFallbackHandler(): MPFallbackHandler {
  if (!fallbackHandlerInstance) {
    fallbackHandlerInstance = new MPFallbackHandler();
  }
  return fallbackHandlerInstance;
}

/**
 * Initialize fallback handler with custom config
 */
export function initializeMPFallbackHandler(config?: Partial<FallbackConfig>): void {
  fallbackHandlerInstance = new MPFallbackHandler(config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a fallback payment when MercadoPago fails
 */
export async function handleMPFallback(
  orgId: string,
  invoiceId: string,
  reason: FallbackReason,
  error?: string
): Promise<FallbackResult> {
  const handler = getMPFallbackHandler();
  return handler.createFallbackPayment(orgId, invoiceId, reason, error);
}
