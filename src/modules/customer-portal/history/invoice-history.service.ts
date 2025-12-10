/**
 * Invoice History Service
 * =======================
 *
 * Provides customer access to their invoice history and PDF downloads.
 */

import { Pool } from 'pg';
import { InvoiceStatus, InvoiceType } from '../../../shared/types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerInvoice {
  id: string;
  invoiceNumber?: number;
  invoiceType: InvoiceType;
  puntoVenta: number;
  status: InvoiceStatus;
  issuedAt?: Date;
  dueDate?: Date;
  lineItems: CustomerInvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  cae?: string;
  caeExpiry?: Date;
  qrCode?: string;
  pdfUrl?: string;
  paidAt?: Date;
  paymentMethod?: string;
  relatedJobId?: string;
  relatedJobDescription?: string;
  createdAt: Date;
}

export interface CustomerInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceHistoryParams {
  customerId: string;
  orgId: string;
  status?: InvoiceStatus[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface InvoiceSummary {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class InvoiceHistoryService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get invoice history for customer
   */
  async getInvoiceHistory(params: InvoiceHistoryParams): Promise<{
    invoices: CustomerInvoice[];
    total: number;
  }> {
    const { customerId, orgId, status, startDate, endDate, limit = 20, offset = 0 } = params;

    let whereClause = 'WHERE i.customer_id = $1 AND i.org_id = $2';
    const queryParams: any[] = [customerId, orgId];
    let paramIndex = 3;

    // Only show issued/sent/paid invoices to customers (not drafts)
    whereClause += ` AND i.status IN ('issued', 'sent', 'paid', 'voided')`;

    if (status && status.length > 0) {
      whereClause += ` AND i.status = ANY($${paramIndex})`;
      queryParams.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND i.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND i.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    // Get count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM invoices i ${whereClause}`,
      queryParams.slice(0, paramIndex - 1)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get invoices with job info
    queryParams.push(limit, offset);
    const result = await this.pool.query(
      `SELECT
        i.*,
        j.description as job_description,
        p.method as payment_method
       FROM invoices i
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'completed'
       ${whereClause}
       ORDER BY COALESCE(i.issued_at, i.created_at) DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return {
      invoices: result.rows.map(row => this.mapRowToInvoice(row)),
      total,
    };
  }

  /**
   * Get single invoice details
   */
  async getInvoiceById(
    invoiceId: string,
    customerId: string,
    orgId: string
  ): Promise<CustomerInvoice | null> {
    const result = await this.pool.query(
      `SELECT
        i.*,
        j.description as job_description,
        p.method as payment_method
       FROM invoices i
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'completed'
       WHERE i.id = $1 AND i.customer_id = $2 AND i.org_id = $3
         AND i.status IN ('issued', 'sent', 'paid', 'voided')`,
      [invoiceId, customerId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToInvoice(result.rows[0]);
  }

  /**
   * Get invoice PDF URL
   */
  async getInvoicePdfUrl(
    invoiceId: string,
    customerId: string,
    orgId: string
  ): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT pdf_url FROM invoices
       WHERE id = $1 AND customer_id = $2 AND org_id = $3
         AND status IN ('issued', 'sent', 'paid')`,
      [invoiceId, customerId, orgId]
    );

    return result.rows[0]?.pdf_url || null;
  }

  /**
   * Get invoice summary
   */
  async getInvoiceSummary(customerId: string, orgId: string): Promise<InvoiceSummary> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status IN ('issued', 'sent')) as pending_invoices,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) as total_paid,
        COALESCE(SUM(total) FILTER (WHERE status IN ('issued', 'sent')), 0) as total_pending
       FROM invoices
       WHERE customer_id = $1 AND org_id = $2
         AND status IN ('issued', 'sent', 'paid')`,
      [customerId, orgId]
    );

    const row = result.rows[0];

    return {
      totalInvoices: parseInt(row.total_invoices, 10),
      paidInvoices: parseInt(row.paid_invoices, 10),
      pendingInvoices: parseInt(row.pending_invoices, 10),
      totalAmount: parseFloat(row.total_amount),
      totalPaid: parseFloat(row.total_paid),
      totalPending: parseFloat(row.total_pending),
    };
  }

  /**
   * Get unpaid invoices
   */
  async getUnpaidInvoices(customerId: string, orgId: string): Promise<CustomerInvoice[]> {
    const result = await this.pool.query(
      `SELECT
        i.*,
        j.description as job_description
       FROM invoices i
       LEFT JOIN jobs j ON j.id = i.job_id
       WHERE i.customer_id = $1
         AND i.org_id = $2
         AND i.status IN ('issued', 'sent')
       ORDER BY i.due_date ASC NULLS LAST`,
      [customerId, orgId]
    );

    return result.rows.map(row => this.mapRowToInvoice(row));
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(customerId: string, orgId: string): Promise<CustomerInvoice[]> {
    const result = await this.pool.query(
      `SELECT
        i.*,
        j.description as job_description
       FROM invoices i
       LEFT JOIN jobs j ON j.id = i.job_id
       WHERE i.customer_id = $1
         AND i.org_id = $2
         AND i.status IN ('issued', 'sent')
         AND i.due_date < NOW()
       ORDER BY i.due_date ASC`,
      [customerId, orgId]
    );

    return result.rows.map(row => this.mapRowToInvoice(row));
  }

  /**
   * Get recent invoices for dashboard
   */
  async getRecentInvoices(
    customerId: string,
    orgId: string,
    limit = 5
  ): Promise<CustomerInvoice[]> {
    const result = await this.pool.query(
      `SELECT
        i.*,
        j.description as job_description,
        p.method as payment_method
       FROM invoices i
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'completed'
       WHERE i.customer_id = $1
         AND i.org_id = $2
         AND i.status IN ('issued', 'sent', 'paid')
       ORDER BY COALESCE(i.issued_at, i.created_at) DESC
       LIMIT $3`,
      [customerId, orgId, limit]
    );

    return result.rows.map(row => this.mapRowToInvoice(row));
  }

  /**
   * Format invoice number for display
   */
  formatInvoiceNumber(invoiceType: InvoiceType, puntoVenta: number, invoiceNumber: number): string {
    const pvStr = puntoVenta.toString().padStart(4, '0');
    const numStr = invoiceNumber.toString().padStart(8, '0');
    return `${invoiceType} ${pvStr}-${numStr}`;
  }

  /**
   * Map database row to CustomerInvoice
   */
  private mapRowToInvoice(row: any): CustomerInvoice {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceType: row.invoice_type,
      puntoVenta: row.punto_venta,
      status: row.status,
      issuedAt: row.issued_at ? new Date(row.issued_at) : undefined,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      lineItems: (row.line_items || []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        total: item.total,
      })),
      subtotal: parseFloat(row.subtotal || 0),
      taxAmount: parseFloat(row.tax_amount || 0),
      total: parseFloat(row.total || 0),
      cae: row.cae,
      caeExpiry: row.cae_expiry ? new Date(row.cae_expiry) : undefined,
      qrCode: row.qr_code,
      pdfUrl: row.pdf_url,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      paymentMethod: row.payment_method,
      relatedJobId: row.job_id,
      relatedJobDescription: row.job_description,
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: InvoiceHistoryService | null = null;

export function getInvoiceHistoryService(pool?: Pool): InvoiceHistoryService {
  if (!instance && pool) {
    instance = new InvoiceHistoryService(pool);
  }
  if (!instance) {
    throw new Error('InvoiceHistoryService not initialized');
  }
  return instance;
}
