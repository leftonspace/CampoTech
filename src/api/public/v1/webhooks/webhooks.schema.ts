/**
 * Webhooks Schema
 * ================
 *
 * Zod validation schemas for the Webhooks public API endpoints.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const webhookEventTypes = [
  // Customer events
  'customer.created',
  'customer.updated',
  'customer.deleted',

  // Job events
  'job.created',
  'job.updated',
  'job.scheduled',
  'job.assigned',
  'job.started',
  'job.completed',
  'job.cancelled',

  // Invoice events
  'invoice.created',
  'invoice.sent',
  'invoice.viewed',
  'invoice.paid',
  'invoice.partially_paid',
  'invoice.overdue',
  'invoice.voided',

  // Payment events
  'payment.created',
  'payment.completed',
  'payment.failed',
  'payment.refunded',

  // Technician events
  'technician.created',
  'technician.updated',
  'technician.location_updated',

  // Route events
  'route.optimized',
  'route.started',
  'route.completed',

  // Inventory events
  'inventory.low_stock',
  'inventory.out_of_stock',
  'inventory.restocked',
] as const;

export const webhookEventTypeSchema = z.enum(webhookEventTypes);
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const createWebhookSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(webhookEventTypeSchema).min(1).max(50),
  description: z.string().max(500).optional(),
  secret: z.string().min(16).max(256).optional(), // Auto-generated if not provided
  enabled: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  // Advanced options
  headers: z.record(z.string(), z.string()).optional(), // Custom headers to send
  retry_policy: z.object({
    max_attempts: z.number().int().min(1).max(10).optional().default(5),
    initial_delay_ms: z.number().int().min(100).max(60000).optional().default(1000),
    max_delay_ms: z.number().int().min(1000).max(3600000).optional().default(300000),
  }).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const updateWebhookSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(webhookEventTypeSchema).min(1).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  retry_policy: z.object({
    max_attempts: z.number().int().min(1).max(10).optional(),
    initial_delay_ms: z.number().int().min(100).max(60000).optional(),
    max_delay_ms: z.number().int().min(1000).max(3600000).optional(),
  }).nullable().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIST WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export const listWebhooksSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  enabled: z.coerce.boolean().optional(),
  event: webhookEventTypeSchema.optional(),
  search: z.string().max(255).optional(),
});

export type ListWebhooksInput = z.infer<typeof listWebhooksSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const testWebhookSchema = z.object({
  event_type: webhookEventTypeSchema,
  payload: z.record(z.string(), z.any()).optional(),
});

export const rotateSecretSchema = z.object({
  new_secret: z.string().min(16).max(256).optional(), // Auto-generated if not provided
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY LOGS
// ═══════════════════════════════════════════════════════════════════════════════

export const listDeliveriesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  webhook_id: z.string().uuid().optional(),
  event_type: webhookEventTypeSchema.optional(),
  status: z.enum(['pending', 'delivered', 'failed']).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
});

export type ListDeliveriesInput = z.infer<typeof listDeliveriesSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const webhookResponseSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  url: z.string(),
  events: z.array(webhookEventTypeSchema),
  description: z.string().nullable(),
  secret: z.string(), // Only returned on create
  enabled: z.boolean(),
  metadata: z.record(z.string(), z.any()).nullable(),
  headers: z.record(z.string(), z.string()).nullable(),
  retry_policy: z.object({
    max_attempts: z.number(),
    initial_delay_ms: z.number(),
    max_delay_ms: z.number(),
  }).nullable(),
  last_delivery_at: z.string().datetime().nullable(),
  last_delivery_status: z.enum(['delivered', 'failed']).nullable(),
  total_deliveries: z.number(),
  successful_deliveries: z.number(),
  failed_deliveries: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type WebhookResponse = z.infer<typeof webhookResponseSchema>;

export const deliveryResponseSchema = z.object({
  id: z.string().uuid(),
  webhook_id: z.string().uuid(),
  event_type: webhookEventTypeSchema,
  event_id: z.string().uuid(),
  status: z.enum(['pending', 'delivered', 'failed']),
  request_url: z.string(),
  request_headers: z.record(z.string(), z.string()),
  request_body: z.any(),
  response_status: z.number().nullable(),
  response_headers: z.record(z.string(), z.string()).nullable(),
  response_body: z.string().nullable(),
  attempts: z.number(),
  next_retry_at: z.string().datetime().nullable(),
  delivered_at: z.string().datetime().nullable(),
  duration_ms: z.number().nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type DeliveryResponse = z.infer<typeof deliveryResponseSchema>;
