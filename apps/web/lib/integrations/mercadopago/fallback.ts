/**
 * MercadoPago Fallback Handler
 * ============================
 *
 * Handles fallback to manual payment instructions when MercadoPago is unavailable.
 * Provides clear instructions for bank transfer, cash, or card-present payments.
 */

import { prisma } from '@/lib/prisma';
import {
  FallbackReason,
  FallbackDecision,
  ManualPaymentInstructions,
  FallbackPaymentRecord,
  MPServiceStatus,
} from './types';
import { getMPCircuitBreaker } from './circuit-breaker';

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class MPFallbackHandler {
  private defaultInstructions: ManualPaymentInstructions;

  constructor(defaultInstructions?: Partial<ManualPaymentInstructions>) {
    this.defaultInstructions = {
      method: 'transfer',
      title: 'Pago por Transferencia Bancaria',
      instructions: [
        'Realizá una transferencia al siguiente CBU/Alias',
        'Incluí tu número de factura en el concepto',
        'Envianos el comprobante por WhatsApp o email',
        'Recibirás confirmación en 24-48hs hábiles',
      ],
      customerMessage:
        'Nuestro sistema de pagos online está temporalmente fuera de servicio. ' +
        'Por favor realizá el pago por transferencia bancaria. ' +
        'Disculpá las molestias.',
      ...defaultInstructions,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK DECISIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Determine if should fallback based on current state
   */
  async shouldFallback(organizationId: string): Promise<FallbackDecision> {
    const circuitBreaker = getMPCircuitBreaker();
    const status = circuitBreaker.getStatus();

    // Check circuit breaker
    if (status.state === 'open') {
      return {
        shouldFallback: true,
        reason: 'circuit_open',
        message: 'MercadoPago no está disponible temporalmente',
        suggestedActions: [
          'Ofrecer pago por transferencia',
          'Registrar pago manual para seguimiento',
        ],
        retryAfter: status.nextRetryAt
          ? status.nextRetryAt.getTime() - Date.now()
          : undefined,
      };
    }

    // Check if organization has valid MP configuration
    const hasConfig = await this.checkMPConfiguration(organizationId);
    if (!hasConfig) {
      return {
        shouldFallback: true,
        reason: 'config_missing',
        message: 'MercadoPago no está configurado para esta organización',
        suggestedActions: [
          'Configurar credenciales de MercadoPago',
          'Usar métodos de pago alternativos',
        ],
      };
    }

    return {
      shouldFallback: false,
      message: 'MercadoPago disponible',
      suggestedActions: [],
    };
  }

  /**
   * Check if organization has MP configuration
   */
  private async checkMPConfiguration(organizationId: string): Promise<boolean> {
    try {
      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId },
        select: {
          mercadoPagoAccessToken: true,
          mercadoPagoEnabled: true,
        },
      });

      return !!(settings?.mercadoPagoAccessToken && settings?.mercadoPagoEnabled);
    } catch {
      // If table doesn't exist or query fails, assume not configured
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MANUAL PAYMENT INSTRUCTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get manual payment instructions for organization
   */
  async getPaymentInstructions(
    organizationId: string,
    method: 'transfer' | 'cash' | 'card_present' = 'transfer'
  ): Promise<ManualPaymentInstructions> {
    // Try to get organization-specific bank details
    try {
      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId },
        select: {
          bankName: true,
          bankAccountHolder: true,
          bankCbu: true,
          bankAlias: true,
          cuit: true,
          name: true,
        },
      });

      if (settings?.bankCbu) {
        return {
          method,
          title: this.getTitleForMethod(method),
          instructions: this.getInstructionsForMethod(method),
          bankDetails: {
            bankName: settings.bankName || 'Banco no especificado',
            accountHolder: settings.bankAccountHolder || settings.name || 'Titular',
            cbu: settings.bankCbu,
            alias: settings.bankAlias || undefined,
            cuit: settings.cuit || '',
          },
          customerMessage: this.getCustomerMessage(method),
        };
      }
    } catch {
      // Use defaults if query fails
    }

    return {
      ...this.defaultInstructions,
      method,
      title: this.getTitleForMethod(method),
      instructions: this.getInstructionsForMethod(method),
    };
  }

  /**
   * Get title for payment method
   */
  private getTitleForMethod(method: 'transfer' | 'cash' | 'card_present'): string {
    switch (method) {
      case 'transfer':
        return 'Pago por Transferencia Bancaria';
      case 'cash':
        return 'Pago en Efectivo';
      case 'card_present':
        return 'Pago con Tarjeta (Presencial)';
      default:
        return 'Método de Pago Alternativo';
    }
  }

  /**
   * Get instructions for payment method
   */
  private getInstructionsForMethod(
    method: 'transfer' | 'cash' | 'card_present'
  ): string[] {
    switch (method) {
      case 'transfer':
        return [
          'Realizá una transferencia al CBU/Alias indicado',
          'Incluí el número de factura en el concepto',
          'Envianos el comprobante por WhatsApp o email',
          'Recibirás confirmación en 24-48hs hábiles',
        ];
      case 'cash':
        return [
          'Acercate a nuestras oficinas en horario comercial',
          'Llevá el número de factura',
          'Aceptamos efectivo en pesos argentinos',
          'Recibirás un recibo al momento del pago',
        ];
      case 'card_present':
        return [
          'Acercate a nuestras oficinas con tu tarjeta',
          'Aceptamos débito y crédito (Visa, Mastercard, AMEX)',
          'El pago se procesa al momento',
          'Recibirás el comprobante inmediatamente',
        ];
      default:
        return this.defaultInstructions.instructions;
    }
  }

  /**
   * Get customer message for payment method
   */
  private getCustomerMessage(method: 'transfer' | 'cash' | 'card_present'): string {
    switch (method) {
      case 'transfer':
        return (
          'Nuestro sistema de pagos online está temporalmente fuera de servicio. ' +
          'Por favor realizá el pago por transferencia bancaria con los datos indicados. ' +
          'Disculpá las molestias ocasionadas.'
        );
      case 'cash':
        return (
          'Nuestro sistema de pagos online está temporalmente fuera de servicio. ' +
          'Podés realizar el pago en efectivo en nuestras oficinas. ' +
          'Disculpá las molestias ocasionadas.'
        );
      case 'card_present':
        return (
          'Nuestro sistema de pagos online está temporalmente fuera de servicio. ' +
          'Podés acercarte a pagar con tarjeta en nuestras oficinas. ' +
          'Disculpá las molestias ocasionadas.'
        );
      default:
        return this.defaultInstructions.customerMessage;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK PAYMENT RECORDS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a fallback payment record for tracking
   */
  async createFallbackPayment(params: {
    organizationId: string;
    invoiceId: string;
    customerId: string;
    amount: number;
    reason: FallbackReason;
    originalError?: string;
    suggestedMethod?: 'cash' | 'transfer' | 'card_present';
  }): Promise<FallbackPaymentRecord> {
    const record: FallbackPaymentRecord = {
      id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      customerId: params.customerId,
      amount: params.amount,
      currency: 'ARS',
      reason: params.reason,
      originalError: params.originalError,
      suggestedMethod: params.suggestedMethod || 'transfer',
      status: 'pending',
      notificationSent: false,
      createdAt: new Date(),
    };

    // Store in database
    try {
      await prisma.fallbackPayment.create({
        data: {
          id: record.id,
          organizationId: record.organizationId,
          invoiceId: record.invoiceId,
          customerId: record.customerId,
          amount: record.amount,
          currency: record.currency,
          reason: record.reason,
          originalError: record.originalError,
          suggestedMethod: record.suggestedMethod,
          status: record.status,
          notificationSent: record.notificationSent,
          createdAt: record.createdAt,
        },
      });
    } catch (error) {
      console.warn('[MP Fallback] Database write failed:', error);
      // Continue - we can track in memory/logs
    }

    console.log('[MP Fallback] Created fallback payment record:', record.id);
    return record;
  }

  /**
   * Resolve a fallback payment
   */
  async resolveFallback(
    fallbackId: string,
    resolution: {
      resolvedBy: string;
      resolvedMethod: string;
      notes?: string;
    }
  ): Promise<FallbackPaymentRecord | null> {
    try {
      const updated = await prisma.fallbackPayment.update({
        where: { id: fallbackId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: resolution.resolvedBy,
          resolvedMethod: resolution.resolvedMethod,
        },
      });

      return updated as unknown as FallbackPaymentRecord;
    } catch (error) {
      console.error('[MP Fallback] Failed to resolve fallback:', error);
      return null;
    }
  }

  /**
   * Get pending fallback payments for an organization
   */
  async getPendingFallbacks(organizationId: string): Promise<FallbackPaymentRecord[]> {
    try {
      const records = await prisma.fallbackPayment.findMany({
        where: {
          organizationId,
          status: 'pending',
        },
        orderBy: { createdAt: 'desc' },
      });

      return records as unknown as FallbackPaymentRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Get fallback payment count
   */
  async getFallbackCount(organizationId?: string): Promise<number> {
    try {
      return await prisma.fallbackPayment.count({
        where: {
          ...(organizationId && { organizationId }),
          status: 'pending',
        },
      });
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVICE STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current service status
   */
  async getServiceStatus(organizationId?: string): Promise<MPServiceStatus> {
    const circuitBreaker = getMPCircuitBreaker();
    const status = circuitBreaker.getStatus();
    const pendingFallbacks = await this.getFallbackCount(organizationId);

    return {
      available: status.state !== 'open',
      circuitState: status.state,
      lastSuccess: status.lastSuccess,
      lastError: status.lastFailure,
      successRate: this.calculateSuccessRate(status),
      avgLatency: 0, // Would need latency tracking
      pendingFallbacks,
    };
  }

  /**
   * Calculate success rate from circuit status
   */
  private calculateSuccessRate(status: {
    failures: number;
    successes: number;
  }): number {
    const total = status.failures + status.successes;
    if (total === 0) return 100;
    return Math.round((status.successes / total) * 100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format payment instructions for WhatsApp message
 */
export function formatInstructionsForWhatsApp(
  instructions: ManualPaymentInstructions,
  invoiceNumber?: string,
  amount?: number
): string {
  const lines: string[] = [];

  lines.push(`📋 *${instructions.title}*`);
  lines.push('');

  if (amount) {
    lines.push(`💰 Monto a pagar: $${amount.toLocaleString('es-AR')}`);
    lines.push('');
  }

  if (invoiceNumber) {
    lines.push(`📄 Factura: ${invoiceNumber}`);
    lines.push('');
  }

  if (instructions.bankDetails) {
    lines.push('🏦 *Datos bancarios:*');
    lines.push(`• Banco: ${instructions.bankDetails.bankName}`);
    lines.push(`• Titular: ${instructions.bankDetails.accountHolder}`);
    lines.push(`• CBU: ${instructions.bankDetails.cbu}`);
    if (instructions.bankDetails.alias) {
      lines.push(`• Alias: ${instructions.bankDetails.alias}`);
    }
    if (instructions.bankDetails.cuit) {
      lines.push(`• CUIT: ${instructions.bankDetails.cuit}`);
    }
    lines.push('');
  }

  lines.push('📝 *Pasos:*');
  instructions.instructions.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  lines.push('');
  lines.push('_' + instructions.customerMessage + '_');

  return lines.join('\n');
}

/**
 * Format payment instructions for email
 */
export function formatInstructionsForEmail(
  instructions: ManualPaymentInstructions,
  invoiceNumber?: string,
  amount?: number
): { subject: string; body: string } {
  const subject = `Instrucciones de pago - ${
    invoiceNumber ? `Factura ${invoiceNumber}` : 'Pendiente'
  }`;

  let body = `<h2>${instructions.title}</h2>`;

  if (amount) {
    body += `<p><strong>Monto a pagar:</strong> $${amount.toLocaleString('es-AR')}</p>`;
  }

  if (invoiceNumber) {
    body += `<p><strong>Factura:</strong> ${invoiceNumber}</p>`;
  }

  if (instructions.bankDetails) {
    body += '<h3>Datos bancarios</h3>';
    body += '<table style="border-collapse: collapse;">';
    body += `<tr><td style="padding: 5px;"><strong>Banco:</strong></td><td style="padding: 5px;">${instructions.bankDetails.bankName}</td></tr>`;
    body += `<tr><td style="padding: 5px;"><strong>Titular:</strong></td><td style="padding: 5px;">${instructions.bankDetails.accountHolder}</td></tr>`;
    body += `<tr><td style="padding: 5px;"><strong>CBU:</strong></td><td style="padding: 5px;">${instructions.bankDetails.cbu}</td></tr>`;
    if (instructions.bankDetails.alias) {
      body += `<tr><td style="padding: 5px;"><strong>Alias:</strong></td><td style="padding: 5px;">${instructions.bankDetails.alias}</td></tr>`;
    }
    if (instructions.bankDetails.cuit) {
      body += `<tr><td style="padding: 5px;"><strong>CUIT:</strong></td><td style="padding: 5px;">${instructions.bankDetails.cuit}</td></tr>`;
    }
    body += '</table>';
  }

  body += '<h3>Pasos a seguir</h3>';
  body += '<ol>';
  instructions.instructions.forEach((step) => {
    body += `<li>${step}</li>`;
  });
  body += '</ol>';

  body += `<p><em>${instructions.customerMessage}</em></p>`;

  return { subject, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let fallbackHandler: MPFallbackHandler | null = null;

export function getMPFallbackHandler(): MPFallbackHandler {
  if (!fallbackHandler) {
    fallbackHandler = new MPFallbackHandler();
  }
  return fallbackHandler;
}

export function resetMPFallbackHandler(): void {
  fallbackHandler = null;
}
