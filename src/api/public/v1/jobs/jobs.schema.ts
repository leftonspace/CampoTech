/**
 * Jobs Schema
 * ===========
 *
 * Zod validation schemas for the Jobs public API endpoints.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const jobStatusSchema = z.enum([
  'pending',
  'scheduled',
  'assigned',
  'en_route',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);

export const jobPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const jobLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  tax_rate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
});

export const jobAddressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional().default('Argentina'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE JOB
// ═══════════════════════════════════════════════════════════════════════════════

export const createJobSchema = z.object({
  customer_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  service_type: z.string().min(1).max(100),
  priority: jobPrioritySchema.optional().default('normal'),
  scheduled_start: z.string().datetime().optional(),
  scheduled_end: z.string().datetime().optional(),
  estimated_duration_minutes: z.number().int().positive().optional(),
  address: jobAddressSchema.optional(),
  assigned_technician_id: z.string().uuid().optional(),
  line_items: z.array(jobLineItemSchema).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  notes: z.string().max(5000).optional(),
  internal_notes: z.string().max(5000).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE JOB
// ═══════════════════════════════════════════════════════════════════════════════

export const updateJobSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  service_type: z.string().min(1).max(100).optional(),
  status: jobStatusSchema.optional(),
  priority: jobPrioritySchema.optional(),
  scheduled_start: z.string().datetime().nullable().optional(),
  scheduled_end: z.string().datetime().nullable().optional(),
  estimated_duration_minutes: z.number().int().positive().nullable().optional(),
  address: jobAddressSchema.optional(),
  assigned_technician_id: z.string().uuid().nullable().optional(),
  line_items: z.array(jobLineItemSchema).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  notes: z.string().max(5000).nullable().optional(),
  internal_notes: z.string().max(5000).nullable().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIST JOBS
// ═══════════════════════════════════════════════════════════════════════════════

export const listJobsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  customer_id: z.string().uuid().optional(),
  technician_id: z.string().uuid().optional(),
  status: z.union([jobStatusSchema, z.array(jobStatusSchema)]).optional(),
  priority: z.union([jobPrioritySchema, z.array(jobPrioritySchema)]).optional(),
  service_type: z.string().optional(),
  scheduled_after: z.string().datetime().optional(),
  scheduled_before: z.string().datetime().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  search: z.string().max(255).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  sort_by: z.enum([
    'created_at',
    'updated_at',
    'scheduled_start',
    'priority',
    'status',
  ]).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  include: z.array(z.enum(['customer', 'technician', 'line_items', 'history'])).optional(),
});

export type ListJobsInput = z.infer<typeof listJobsSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const assignJobSchema = z.object({
  technician_id: z.string().uuid(),
  notify_technician: z.boolean().optional().default(true),
  notify_customer: z.boolean().optional().default(false),
});

export const scheduleJobSchema = z.object({
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime().optional(),
  notify_customer: z.boolean().optional().default(true),
});

export const startJobSchema = z.object({
  notes: z.string().max(1000).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

export const completeJobSchema = z.object({
  completion_notes: z.string().max(5000).optional(),
  line_items: z.array(jobLineItemSchema).optional(),
  photos: z.array(z.string().url()).max(20).optional(),
  signature_url: z.string().url().optional(),
  customer_rating: z.number().int().min(1).max(5).optional(),
});

export const cancelJobSchema = z.object({
  reason: z.string().max(500),
  notify_customer: z.boolean().optional().default(true),
  notify_technician: z.boolean().optional().default(true),
});

export const addJobNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  is_internal: z.boolean().optional().default(false),
  attachments: z.array(z.string().url()).max(10).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchUpdateJobsSchema = z.object({
  job_ids: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    status: jobStatusSchema.optional(),
    priority: jobPrioritySchema.optional(),
    assigned_technician_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const batchDeleteJobsSchema = z.object({
  job_ids: z.array(z.string().uuid()).min(1).max(100),
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const jobResponseSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  service_type: z.string(),
  status: jobStatusSchema,
  priority: jobPrioritySchema,
  scheduled_start: z.string().datetime().nullable(),
  scheduled_end: z.string().datetime().nullable(),
  estimated_duration_minutes: z.number().nullable(),
  actual_start: z.string().datetime().nullable(),
  actual_end: z.string().datetime().nullable(),
  address: jobAddressSchema.nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  line_items: z.array(jobLineItemSchema).nullable(),
  subtotal: z.number(),
  tax_total: z.number(),
  total: z.number(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Optional expanded relations
  customer: z.any().optional(),
  technician: z.any().optional(),
  history: z.array(z.any()).optional(),
});

export type JobResponse = z.infer<typeof jobResponseSchema>;
