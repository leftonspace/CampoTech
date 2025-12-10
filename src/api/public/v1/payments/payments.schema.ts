/**
 * Payments Schema
 * ================
 *
 * Zod validation schemas for the Payments public API endpoints.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

export const paymentMethodSchema = z.enum([
  'cash',
  'card',
  'bank_transfer',
  'check',
  'mercadopago',
  'paypal',
  'stripe',
  'wire_transfer',
  'credit',
  'other',
]);

export const paymentTypeSchema = z.enum([
  'invoice',
  'deposit',
  'advance',
  'refund',
  'adjustment',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const createPaymentSchema = z.object({
  customer_id: z.string().uuid(),
  invoice_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional().default('ARS'),
  payment_method: paymentMethodSchema,
  payment_type: paymentTypeSchema.optional().default('invoice'),
  reference: z.string().max(255).optional(),
  payment_date: z.string().datetime().optional(), // Defaults to now
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  // For card/online payments
  external_transaction_id: z.string().max(255).optional(),
  processor: z.string().max(50).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const updatePaymentSchema = z.object({
  status: paymentStatusSchema.optional(),
  reference: z.string().max(255).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  external_transaction_id: z.string().max(255).nullable().optional(),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIST PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const listPaymentsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  customer_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  status: z.union([paymentStatusSchema, z.array(paymentStatusSchema)]).optional(),
  payment_method: z.union([paymentMethodSchema, z.array(paymentMethodSchema)]).optional(),
  payment_type: z.union([paymentTypeSchema, z.array(paymentTypeSchema)]).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  search: z.string().max(255).optional(),
  sort_by: z.enum([
    'created_at',
    'payment_date',
    'amount',
  ]).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  include: z.array(z.enum(['customer', 'invoice', 'job'])).optional(),
});

export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const processPaymentSchema = z.object({
  // For online payment processing
  payment_intent_id: z.string().optional(),
  card_token: z.string().optional(),
  return_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(), // Full refund if not specified
  reason: z.string().max(500),
  refund_method: z.enum(['original_method', 'credit', 'cash', 'bank_transfer']).optional().default('original_method'),
  notes: z.string().max(1000).optional(),
});

export const capturePaymentSchema = z.object({
  amount: z.number().positive().optional(), // Captures full amount if not specified
});

export const cancelPaymentSchema = z.object({
  reason: z.string().max(500),
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchRecordPaymentsSchema = z.object({
  payments: z.array(z.object({
    customer_id: z.string().uuid(),
    invoice_id: z.string().uuid().optional(),
    amount: z.number().positive(),
    payment_method: paymentMethodSchema,
    reference: z.string().max(255).optional(),
    payment_date: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
  })).min(1).max(50),
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const paymentResponseSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable(),
  job_id: z.string().uuid().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: paymentStatusSchema,
  payment_method: paymentMethodSchema,
  payment_type: paymentTypeSchema,
  reference: z.string().nullable(),
  payment_date: z.string().datetime(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  external_transaction_id: z.string().nullable(),
  processor: z.string().nullable(),
  refunded_amount: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Optional expanded relations
  customer: z.any().optional(),
  invoice: z.any().optional(),
  job: z.any().optional(),
  refunds: z.array(z.any()).optional(),
});

export type PaymentResponse = z.infer<typeof paymentResponseSchema>;
