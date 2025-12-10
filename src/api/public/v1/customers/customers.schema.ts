/**
 * Customers API Schema
 * ====================
 *
 * Zod schemas for customer API validation.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const addressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default('AR'), // ISO country code
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(8).max(20).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  address: addressSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(8).max(20).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  address: addressSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIST CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

export const listCustomersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

export type ListCustomersInput = z.infer<typeof listCustomersSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

export const customerResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  address: addressSchema.nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  customFields: z.record(z.string(), z.any()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CustomerResponse = z.infer<typeof customerResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchDeleteCustomersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type BatchDeleteCustomersInput = z.infer<typeof batchDeleteCustomersSchema>;

export const batchUpdateCustomersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  update: updateCustomerSchema,
});

export type BatchUpdateCustomersInput = z.infer<typeof batchUpdateCustomersSchema>;
