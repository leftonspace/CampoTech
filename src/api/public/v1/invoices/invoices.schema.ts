/**
 * Invoices Schema
 * ================
 *
 * Zod validation schemas for the Invoices public API endpoints.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const invoiceStatusSchema = z.enum([
  'draft',
  'pending',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
]);

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  tax_rate: z.number().min(0).max(100).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  job_id: z.string().uuid().optional(),
});

export const invoicePaymentTermsSchema = z.enum([
  'due_on_receipt',
  'net_7',
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'custom',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

export const createInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().optional(),
  invoice_number: z.string().max(50).optional(), // Auto-generated if not provided
  line_items: z.array(invoiceLineItemSchema).min(1),
  payment_terms: invoicePaymentTermsSchema.optional().default('due_on_receipt'),
  due_date: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  footer: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  send_immediately: z.boolean().optional().default(false),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

export const updateInvoiceSchema = z.object({
  line_items: z.array(invoiceLineItemSchema).min(1).optional(),
  payment_terms: invoicePaymentTermsSchema.optional(),
  due_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  footer: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIST INVOICES
// ═══════════════════════════════════════════════════════════════════════════════

export const listInvoicesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  customer_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  status: z.union([invoiceStatusSchema, z.array(invoiceStatusSchema)]).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  due_before: z.string().datetime().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  search: z.string().max(255).optional(),
  sort_by: z.enum([
    'created_at',
    'updated_at',
    'due_date',
    'total',
    'invoice_number',
  ]).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  include: z.array(z.enum(['customer', 'job', 'payments'])).optional(),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const sendInvoiceSchema = z.object({
  email: z.string().email().optional(), // Uses customer email if not provided
  cc: z.array(z.string().email()).max(5).optional(),
  message: z.string().max(2000).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'mercadopago', 'other']),
  payment_date: z.string().datetime().optional(), // Defaults to now
  reference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
});

export const refundInvoiceSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().max(500),
  refund_method: z.enum(['original_method', 'credit', 'cash', 'bank_transfer']).optional().default('original_method'),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().max(500),
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchSendInvoicesSchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
  message: z.string().max(2000).optional(),
});

export const batchDeleteInvoicesSchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(100),
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const invoiceResponseSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  invoice_number: z.string(),
  status: invoiceStatusSchema,
  line_items: z.array(invoiceLineItemSchema),
  subtotal: z.number(),
  tax_total: z.number(),
  discount_total: z.number(),
  total: z.number(),
  amount_paid: z.number(),
  amount_due: z.number(),
  payment_terms: invoicePaymentTermsSchema,
  due_date: z.string().datetime().nullable(),
  sent_at: z.string().datetime().nullable(),
  viewed_at: z.string().datetime().nullable(),
  paid_at: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  footer: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  pdf_url: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Optional expanded relations
  customer: z.any().optional(),
  job: z.any().optional(),
  payments: z.array(z.any()).optional(),
});

export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;
