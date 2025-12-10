/**
 * Zapier Integration Service
 * ===========================
 *
 * Service for Zapier triggers and actions.
 */

import { Pool } from 'pg';
import {
  ZapierTrigger,
  ZapierAction,
  ZapierField,
} from './integration.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const ZAPIER_TRIGGERS: ZapierTrigger[] = [
  {
    id: 'new_customer',
    name: 'New Customer',
    description: 'Triggers when a new customer is created',
    event_type: 'customer.created',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Juan García',
      email: 'juan@example.com',
      phone: '+54 11 1234-5678',
      created_at: '2024-01-15T10:30:00Z',
    },
  },
  {
    id: 'new_job',
    name: 'New Job',
    description: 'Triggers when a new job is created',
    event_type: 'job.created',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'AC Repair',
      service_type: 'repair',
      status: 'pending',
      created_at: '2024-01-15T10:30:00Z',
    },
  },
  {
    id: 'job_completed',
    name: 'Job Completed',
    description: 'Triggers when a job is marked as completed',
    event_type: 'job.completed',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'AC Repair',
      status: 'completed',
      completed_at: '2024-01-15T14:30:00Z',
    },
  },
  {
    id: 'new_invoice',
    name: 'New Invoice',
    description: 'Triggers when a new invoice is created',
    event_type: 'invoice.created',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      invoice_number: 'INV-2024-000001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      total: 15000,
      status: 'draft',
    },
  },
  {
    id: 'invoice_paid',
    name: 'Invoice Paid',
    description: 'Triggers when an invoice is fully paid',
    event_type: 'invoice.paid',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      invoice_number: 'INV-2024-000001',
      total: 15000,
      status: 'paid',
      paid_at: '2024-01-16T09:00:00Z',
    },
  },
  {
    id: 'new_payment',
    name: 'New Payment',
    description: 'Triggers when a payment is recorded',
    event_type: 'payment.created',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 15000,
      payment_method: 'card',
      created_at: '2024-01-16T09:00:00Z',
    },
  },
  {
    id: 'job_scheduled',
    name: 'Job Scheduled',
    description: 'Triggers when a job is scheduled',
    event_type: 'job.scheduled',
    sample_data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'AC Repair',
      scheduled_start: '2024-01-17T09:00:00Z',
      scheduled_end: '2024-01-17T11:00:00Z',
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const ZAPIER_ACTIONS: ZapierAction[] = [
  {
    id: 'create_customer',
    name: 'Create Customer',
    description: 'Creates a new customer',
    action_type: 'create',
    input_fields: [
      field('name', 'Name', 'string', true),
      field('email', 'Email', 'string'),
      field('phone', 'Phone', 'string'),
      field('address_street', 'Street Address', 'string'),
      field('address_city', 'City', 'string'),
      field('address_state', 'State/Province', 'string'),
      field('address_postal_code', 'Postal Code', 'string'),
      field('tags', 'Tags', 'string', false, 'Comma-separated list of tags'),
    ],
    output_fields: [
      field('id', 'Customer ID', 'string'),
      field('name', 'Name', 'string'),
      field('email', 'Email', 'string'),
      field('created_at', 'Created At', 'datetime'),
    ],
  },
  {
    id: 'create_job',
    name: 'Create Job',
    description: 'Creates a new job/work order',
    action_type: 'create',
    input_fields: [
      field('customer_id', 'Customer ID', 'string', true),
      field('title', 'Title', 'string', true),
      field('service_type', 'Service Type', 'string', true),
      field('description', 'Description', 'text'),
      field('priority', 'Priority', 'string', false, undefined, [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ]),
      field('scheduled_start', 'Scheduled Start', 'datetime'),
      field('scheduled_end', 'Scheduled End', 'datetime'),
      field('address_street', 'Street Address', 'string'),
      field('address_city', 'City', 'string'),
    ],
    output_fields: [
      field('id', 'Job ID', 'string'),
      field('title', 'Title', 'string'),
      field('status', 'Status', 'string'),
      field('created_at', 'Created At', 'datetime'),
    ],
  },
  {
    id: 'create_invoice',
    name: 'Create Invoice',
    description: 'Creates a new invoice',
    action_type: 'create',
    input_fields: [
      field('customer_id', 'Customer ID', 'string', true),
      field('job_id', 'Job ID', 'string'),
      field('line_items', 'Line Items (JSON)', 'text', true, 'JSON array of line items'),
      field('payment_terms', 'Payment Terms', 'string', false, undefined, [
        { value: 'due_on_receipt', label: 'Due on Receipt' },
        { value: 'net_7', label: 'Net 7' },
        { value: 'net_15', label: 'Net 15' },
        { value: 'net_30', label: 'Net 30' },
      ]),
      field('notes', 'Notes', 'text'),
    ],
    output_fields: [
      field('id', 'Invoice ID', 'string'),
      field('invoice_number', 'Invoice Number', 'string'),
      field('total', 'Total', 'number'),
      field('status', 'Status', 'string'),
    ],
  },
  {
    id: 'create_payment',
    name: 'Record Payment',
    description: 'Records a new payment',
    action_type: 'create',
    input_fields: [
      field('customer_id', 'Customer ID', 'string', true),
      field('invoice_id', 'Invoice ID', 'string'),
      field('amount', 'Amount', 'number', true),
      field('payment_method', 'Payment Method', 'string', true, undefined, [
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'check', label: 'Check' },
        { value: 'mercadopago', label: 'MercadoPago' },
      ]),
      field('reference', 'Reference', 'string'),
      field('notes', 'Notes', 'text'),
    ],
    output_fields: [
      field('id', 'Payment ID', 'string'),
      field('amount', 'Amount', 'number'),
      field('status', 'Status', 'string'),
    ],
  },
  {
    id: 'update_job_status',
    name: 'Update Job Status',
    description: 'Updates the status of a job',
    action_type: 'update',
    input_fields: [
      field('job_id', 'Job ID', 'string', true),
      field('status', 'Status', 'string', true, undefined, [
        { value: 'pending', label: 'Pending' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ]),
    ],
    output_fields: [
      field('id', 'Job ID', 'string'),
      field('status', 'Status', 'string'),
      field('updated_at', 'Updated At', 'datetime'),
    ],
  },
  {
    id: 'find_customer',
    name: 'Find Customer',
    description: 'Finds a customer by email or phone',
    action_type: 'search',
    input_fields: [
      field('email', 'Email', 'string'),
      field('phone', 'Phone', 'string'),
      field('name', 'Name', 'string'),
    ],
    output_fields: [
      field('id', 'Customer ID', 'string'),
      field('name', 'Name', 'string'),
      field('email', 'Email', 'string'),
      field('phone', 'Phone', 'string'),
    ],
  },
];

function field(
  key: string,
  label: string,
  type: ZapierField['type'],
  required?: boolean,
  helpText?: string,
  choices?: Array<{ value: string; label: string }>
): ZapierField {
  return { key, label, type, required, helpText, choices };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ZapierService {
  constructor(private pool: Pool) {}

  /**
   * Get available triggers
   */
  getTriggers(): ZapierTrigger[] {
    return ZAPIER_TRIGGERS;
  }

  /**
   * Get available actions
   */
  getActions(): ZapierAction[] {
    return ZAPIER_ACTIONS;
  }

  /**
   * Subscribe to a trigger (webhook registration)
   */
  async subscribeTrigger(
    orgId: string,
    triggerId: string,
    webhookUrl: string,
    apiKey: string
  ): Promise<string> {
    const trigger = ZAPIER_TRIGGERS.find(t => t.id === triggerId);
    if (!trigger) {
      throw new Error(`Unknown trigger: ${triggerId}`);
    }

    // Create webhook subscription
    const result = await this.pool.query(
      `INSERT INTO webhooks (org_id, url, events, enabled, secret, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, true, $4, $5, NOW(), NOW())
       RETURNING id`,
      [
        orgId,
        webhookUrl,
        [trigger.event_type],
        apiKey,
        JSON.stringify({ source: 'zapier', trigger_id: triggerId }),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Unsubscribe from a trigger
   */
  async unsubscribeTrigger(subscriptionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM webhooks WHERE id = $1`,
      [subscriptionId]
    );
  }

  /**
   * Execute an action
   */
  async executeAction(
    orgId: string,
    actionId: string,
    input: Record<string, any>
  ): Promise<any> {
    const action = ZAPIER_ACTIONS.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }

    // Validate required fields
    for (const field of action.input_fields) {
      if (field.required && !input[field.key]) {
        throw new Error(`Missing required field: ${field.label}`);
      }
    }

    // Execute action based on type
    switch (actionId) {
      case 'create_customer':
        return this.createCustomer(orgId, input);
      case 'create_job':
        return this.createJob(orgId, input);
      case 'create_invoice':
        return this.createInvoice(orgId, input);
      case 'create_payment':
        return this.createPayment(orgId, input);
      case 'update_job_status':
        return this.updateJobStatus(orgId, input);
      case 'find_customer':
        return this.findCustomer(orgId, input);
      default:
        throw new Error(`Action not implemented: ${actionId}`);
    }
  }

  /**
   * Get sample data for a trigger
   */
  getSampleData(triggerId: string): any {
    const trigger = ZAPIER_TRIGGERS.find(t => t.id === triggerId);
    return trigger?.sample_data || null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTION IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  private async createCustomer(orgId: string, input: Record<string, any>): Promise<any> {
    const address = this.buildAddress(input);
    const tags = input.tags ? input.tags.split(',').map((t: string) => t.trim()) : [];

    const result = await this.pool.query(
      `INSERT INTO customers (org_id, name, email, phone, address, tags, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
       RETURNING *`,
      [orgId, input.name, input.email || null, input.phone || null, address ? JSON.stringify(address) : null, tags]
    );

    return this.formatCustomer(result.rows[0]);
  }

  private async createJob(orgId: string, input: Record<string, any>): Promise<any> {
    const address = this.buildAddress(input);

    const result = await this.pool.query(
      `INSERT INTO jobs (
        org_id, customer_id, title, service_type, description,
        priority, scheduled_start, scheduled_end, address,
        status, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())
       RETURNING *`,
      [
        orgId,
        input.customer_id,
        input.title,
        input.service_type,
        input.description || null,
        input.priority || 'normal',
        input.scheduled_start || null,
        input.scheduled_end || null,
        address ? JSON.stringify(address) : null,
      ]
    );

    return this.formatJob(result.rows[0]);
  }

  private async createInvoice(orgId: string, input: Record<string, any>): Promise<any> {
    let lineItems: any[];
    try {
      lineItems = typeof input.line_items === 'string'
        ? JSON.parse(input.line_items)
        : input.line_items;
    } catch {
      throw new Error('Invalid line_items JSON');
    }

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    for (const item of lineItems) {
      const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
      const tax = itemTotal * ((item.tax_rate || 0) / 100);
      subtotal += itemTotal;
      taxTotal += tax;
    }
    const total = subtotal + taxTotal;

    // Generate invoice number
    const countResult = await this.pool.query(
      `SELECT COUNT(*) + 1 as next_num FROM invoices WHERE org_id = $1`,
      [orgId]
    );
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(countResult.rows[0].next_num).padStart(6, '0')}`;

    const result = await this.pool.query(
      `INSERT INTO invoices (
        org_id, customer_id, job_id, invoice_number, status,
        line_items, subtotal, tax_total, total, amount_paid, amount_due,
        payment_terms, notes, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, 0, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        orgId,
        input.customer_id,
        input.job_id || null,
        invoiceNumber,
        JSON.stringify(lineItems),
        subtotal,
        taxTotal,
        total,
        input.payment_terms || 'due_on_receipt',
        input.notes || null,
      ]
    );

    return this.formatInvoice(result.rows[0]);
  }

  private async createPayment(orgId: string, input: Record<string, any>): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO payments (
        org_id, customer_id, invoice_id, amount, currency,
        payment_method, status, reference, notes,
        payment_date, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, 'ARS', $5, 'completed', $6, $7, NOW(), NOW(), NOW())
       RETURNING *`,
      [
        orgId,
        input.customer_id,
        input.invoice_id || null,
        input.amount,
        input.payment_method,
        input.reference || null,
        input.notes || null,
      ]
    );

    return this.formatPayment(result.rows[0]);
  }

  private async updateJobStatus(orgId: string, input: Record<string, any>): Promise<any> {
    const result = await this.pool.query(
      `UPDATE jobs SET status = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [input.status, input.job_id, orgId]
    );

    if (result.rows.length === 0) {
      throw new Error('Job not found');
    }

    return this.formatJob(result.rows[0]);
  }

  private async findCustomer(orgId: string, input: Record<string, any>): Promise<any> {
    const conditions: string[] = ['org_id = $1'];
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (input.email) {
      conditions.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }

    if (input.phone) {
      conditions.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }

    if (input.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      values.push(`%${input.name}%`);
    }

    if (conditions.length === 1) {
      throw new Error('At least one search parameter is required');
    }

    const result = await this.pool.query(
      `SELECT * FROM customers WHERE ${conditions.join(' AND ')} LIMIT 1`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatCustomer(result.rows[0]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private buildAddress(input: Record<string, any>): any | null {
    if (!input.address_street && !input.address_city) return null;
    return {
      street: input.address_street,
      city: input.address_city,
      state: input.address_state,
      postal_code: input.address_postal_code,
    };
  }

  private formatCustomer(row: any): any {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      created_at: row.created_at?.toISOString(),
    };
  }

  private formatJob(row: any): any {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString(),
    };
  }

  private formatInvoice(row: any): any {
    return {
      id: row.id,
      invoice_number: row.invoice_number,
      total: Number(row.total),
      status: row.status,
    };
  }

  private formatPayment(row: any): any {
    return {
      id: row.id,
      amount: Number(row.amount),
      status: row.status,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createZapierService(pool: Pool): ZapierService {
  return new ZapierService(pool);
}
