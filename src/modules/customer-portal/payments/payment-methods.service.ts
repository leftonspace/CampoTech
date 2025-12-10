/**
 * Payment Methods Service
 * =======================
 *
 * Manages saved payment methods for customers.
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SavedPaymentMethod {
  id: string;
  customerId: string;
  type: 'card' | 'bank_account';
  provider: 'mercadopago';
  lastFourDigits: string;
  brand?: string;          // visa, mastercard, etc.
  expirationMonth?: number;
  expirationYear?: number;
  holderName?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface SavePaymentMethodRequest {
  customerId: string;
  orgId: string;
  token: string;           // Token from MercadoPago
  setAsDefault?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PaymentMethodsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Save a payment method for customer
   */
  async savePaymentMethod(request: SavePaymentMethodRequest): Promise<SavedPaymentMethod> {
    // In production, this would call MercadoPago API to create a card token
    // For now, we'll create a mock saved method

    const methodId = crypto.randomUUID();

    // If setting as default, unset other defaults first
    if (request.setAsDefault) {
      await this.pool.query(
        `UPDATE customer_payment_methods SET is_default = false
         WHERE customer_id = $1`,
        [request.customerId]
      );
    }

    // Check if this is first method (auto-set as default)
    const existingResult = await this.pool.query(
      `SELECT COUNT(*) FROM customer_payment_methods WHERE customer_id = $1`,
      [request.customerId]
    );
    const isFirst = parseInt(existingResult.rows[0].count, 10) === 0;

    await this.pool.query(
      `INSERT INTO customer_payment_methods (
        id, customer_id, org_id, type, provider, external_token,
        last_four_digits, brand, expiration_month, expiration_year,
        holder_name, is_default, created_at
      ) VALUES ($1, $2, $3, 'card', 'mercadopago', $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        methodId,
        request.customerId,
        request.orgId,
        request.token,
        '****', // Would be extracted from MP response
        'visa', // Would be extracted from MP response
        12,     // Would be extracted from MP response
        2025,   // Would be extracted from MP response
        null,   // Would be extracted from MP response
        request.setAsDefault || isFirst,
      ]
    );

    const saved = await this.getPaymentMethodById(methodId, request.customerId);
    return saved!;
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethodById(
    methodId: string,
    customerId: string
  ): Promise<SavedPaymentMethod | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_payment_methods
       WHERE id = $1 AND customer_id = $2`,
      [methodId, customerId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToMethod(result.rows[0]);
  }

  /**
   * Get saved payment methods for customer
   */
  async getPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    const result = await this.pool.query(
      `SELECT * FROM customer_payment_methods
       WHERE customer_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [customerId]
    );

    return result.rows.map(row => this.mapRowToMethod(row));
  }

  /**
   * Set default payment method
   */
  async setDefaultMethod(methodId: string, customerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_payment_methods SET is_default = false
       WHERE customer_id = $1`,
      [customerId]
    );

    await this.pool.query(
      `UPDATE customer_payment_methods SET is_default = true
       WHERE id = $1 AND customer_id = $2`,
      [methodId, customerId]
    );
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(methodId: string, customerId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM customer_payment_methods
       WHERE id = $1 AND customer_id = $2
       RETURNING id`,
      [methodId, customerId]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Get default payment method
   */
  async getDefaultMethod(customerId: string): Promise<SavedPaymentMethod | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_payment_methods
       WHERE customer_id = $1 AND is_default = true
       LIMIT 1`,
      [customerId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToMethod(result.rows[0]);
  }

  /**
   * Map database row to SavedPaymentMethod
   */
  private mapRowToMethod(row: any): SavedPaymentMethod {
    return {
      id: row.id,
      customerId: row.customer_id,
      type: row.type,
      provider: row.provider,
      lastFourDigits: row.last_four_digits,
      brand: row.brand,
      expirationMonth: row.expiration_month,
      expirationYear: row.expiration_year,
      holderName: row.holder_name,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: PaymentMethodsService | null = null;

export function getPaymentMethodsService(pool?: Pool): PaymentMethodsService {
  if (!instance && pool) {
    instance = new PaymentMethodsService(pool);
  }
  if (!instance) {
    throw new Error('PaymentMethodsService not initialized');
  }
  return instance;
}
