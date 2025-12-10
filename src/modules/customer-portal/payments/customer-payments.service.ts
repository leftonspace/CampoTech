/**
 * Customer Payments Service
 * =========================
 *
 * Handles customer-initiated payments via the portal.
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import { PaymentStatus, PaymentMethod } from '../../../shared/types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerPayment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  externalId?: string;
  receivedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface PaymentInitiationRequest {
  customerId: string;
  orgId: string;
  invoiceId: string;
  method: PaymentMethod;
  returnUrl?: string;
  notificationUrl?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
  error?: string;
}

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CustomerPaymentsService {
  private pool: Pool;
  private mpConfigs: Map<string, MercadoPagoConfig> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Set MercadoPago config for an organization
   */
  setMercadoPagoConfig(orgId: string, config: MercadoPagoConfig): void {
    this.mpConfigs.set(orgId, config);
  }

  /**
   * Initiate a payment for an invoice
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    // Verify invoice exists and belongs to customer
    const invoiceResult = await this.pool.query(
      `SELECT i.*, c.full_name as customer_name, c.email as customer_email, o.name as org_name
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       JOIN organizations o ON o.id = i.org_id
       WHERE i.id = $1 AND i.customer_id = $2 AND i.org_id = $3
         AND i.status IN ('issued', 'sent')`,
      [request.invoiceId, request.customerId, request.orgId]
    );

    if (!invoiceResult.rows[0]) {
      return { success: false, error: 'Invoice not found or not payable' };
    }

    const invoice = invoiceResult.rows[0];

    // Check if already paid
    const existingPayment = await this.pool.query(
      `SELECT id FROM payments
       WHERE invoice_id = $1 AND status = 'completed'`,
      [request.invoiceId]
    );

    if (existingPayment.rows.length > 0) {
      return { success: false, error: 'Invoice already paid' };
    }

    // Handle different payment methods
    switch (request.method) {
      case 'mercadopago':
        return this.initiateMercadoPagoPayment(request, invoice);
      case 'transfer':
        return this.initiateTransferPayment(request, invoice);
      default:
        return { success: false, error: 'Payment method not supported for online payments' };
    }
  }

  /**
   * Initiate MercadoPago payment
   */
  private async initiateMercadoPagoPayment(
    request: PaymentInitiationRequest,
    invoice: any
  ): Promise<PaymentInitiationResult> {
    const config = this.mpConfigs.get(request.orgId);
    if (!config) {
      return { success: false, error: 'MercadoPago not configured for this organization' };
    }

    try {
      // Create payment preference
      const preferenceData = {
        items: [
          {
            title: `Factura ${invoice.invoice_type} ${invoice.punto_venta.toString().padStart(4, '0')}-${(invoice.invoice_number || 0).toString().padStart(8, '0')}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: parseFloat(invoice.total),
          },
        ],
        payer: {
          name: invoice.customer_name,
          email: invoice.customer_email,
        },
        external_reference: `${request.orgId}:${request.invoiceId}`,
        notification_url: request.notificationUrl,
        back_urls: {
          success: request.returnUrl ? `${request.returnUrl}?status=success` : undefined,
          failure: request.returnUrl ? `${request.returnUrl}?status=failure` : undefined,
          pending: request.returnUrl ? `${request.returnUrl}?status=pending` : undefined,
        },
        auto_return: 'approved',
        statement_descriptor: invoice.org_name.slice(0, 22),
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferenceData),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[CustomerPayments] MercadoPago preference creation failed:', error);
        return { success: false, error: 'Failed to create payment' };
      }

      const preference = await response.json();

      // Create pending payment record
      const paymentId = crypto.randomUUID();
      await this.pool.query(
        `INSERT INTO payments (
          id, org_id, invoice_id, external_id, method, status,
          amount, currency, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'mercadopago', 'pending', $5, 'ARS', $6, NOW(), NOW())`,
        [
          paymentId,
          request.orgId,
          request.invoiceId,
          preference.id,
          invoice.total,
          JSON.stringify({ preferenceId: preference.id }),
        ]
      );

      console.log(`[CustomerPayments] Created MercadoPago preference for invoice ${request.invoiceId}`);

      return {
        success: true,
        paymentId,
        redirectUrl: preference.init_point,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    } catch (error) {
      console.error('[CustomerPayments] MercadoPago error:', error);
      return { success: false, error: 'Payment service error' };
    }
  }

  /**
   * Initiate transfer payment (provide bank details)
   */
  private async initiateTransferPayment(
    request: PaymentInitiationRequest,
    invoice: any
  ): Promise<PaymentInitiationResult> {
    // Get organization bank details
    const orgResult = await this.pool.query(
      `SELECT settings FROM organizations WHERE id = $1`,
      [request.orgId]
    );

    const bankDetails = orgResult.rows[0]?.settings?.bankDetails;

    // Create pending payment record
    const paymentId = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO payments (
        id, org_id, invoice_id, method, status, amount, currency, created_at, updated_at
      ) VALUES ($1, $2, $3, 'transfer', 'pending', $4, 'ARS', NOW(), NOW())`,
      [paymentId, request.orgId, request.invoiceId, invoice.total]
    );

    console.log(`[CustomerPayments] Created transfer payment request for invoice ${request.invoiceId}`);

    return {
      success: true,
      paymentId,
      // Bank details would be returned for display
    };
  }

  /**
   * Process MercadoPago webhook
   */
  async processMercadoPagoWebhook(
    orgId: string,
    paymentId: string,
    status: string
  ): Promise<void> {
    const statusMap: Record<string, PaymentStatus> = {
      approved: 'completed',
      pending: 'pending',
      in_process: 'pending',
      rejected: 'failed',
      refunded: 'refunded',
      cancelled: 'failed',
    };

    const paymentStatus = statusMap[status] || 'pending';

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update payment status
      await client.query(
        `UPDATE payments
         SET status = $2,
             received_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE received_at END,
             updated_at = NOW()
         WHERE external_id = $1 OR id = $1`,
        [paymentId, paymentStatus]
      );

      // If completed, update invoice status
      if (paymentStatus === 'completed') {
        const paymentResult = await client.query(
          `SELECT invoice_id FROM payments WHERE external_id = $1 OR id = $1`,
          [paymentId]
        );

        if (paymentResult.rows[0]) {
          await client.query(
            `UPDATE invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [paymentResult.rows[0].invoice_id]
          );
        }
      }

      await client.query('COMMIT');

      console.log(`[CustomerPayments] Processed webhook: payment ${paymentId} is ${paymentStatus}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentId: string,
    customerId: string,
    orgId: string
  ): Promise<CustomerPayment | null> {
    const result = await this.pool.query(
      `SELECT p.*
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.id = $1 AND i.customer_id = $2 AND p.org_id = $3`,
      [paymentId, customerId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToPayment(result.rows[0]);
  }

  /**
   * Get payment history for customer
   */
  async getPaymentHistory(
    customerId: string,
    orgId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    payments: CustomerPayment[];
    total: number;
  }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*)
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE i.customer_id = $1 AND p.org_id = $2`,
      [customerId, orgId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT p.*
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE i.customer_id = $1 AND p.org_id = $2
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [customerId, orgId, limit, offset]
    );

    return {
      payments: result.rows.map(row => this.mapRowToPayment(row)),
      total,
    };
  }

  /**
   * Map database row to CustomerPayment
   */
  private mapRowToPayment(row: any): CustomerPayment {
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      method: row.method,
      status: row.status,
      externalId: row.external_id,
      receivedAt: row.received_at ? new Date(row.received_at) : undefined,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: CustomerPaymentsService | null = null;

export function getCustomerPaymentsService(pool?: Pool): CustomerPaymentsService {
  if (!instance && pool) {
    instance = new CustomerPaymentsService(pool);
  }
  if (!instance) {
    throw new Error('CustomerPaymentsService not initialized');
  }
  return instance;
}
