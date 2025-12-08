/**
 * Validation Schemas
 * ==================
 *
 * Zod schemas for input validation across the application
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((val) => val.toLowerCase().trim());

/**
 * Phone number validation (Argentine format)
 */
export const phoneSchema = z
  .string()
  .regex(
    /^(\+54)?[1-9]\d{9,10}$/,
    'Invalid phone number. Use format: +541112345678 or 1112345678'
  )
  .transform((val) => {
    // Normalize to +54 format
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('54')) {
      return `+${digits}`;
    }
    return `+54${digits}`;
  });

/**
 * Password validation
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/**
 * Safe string (no XSS)
 */
export const safeStringSchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => !/<script/i.test(val), 'Invalid characters detected');

/**
 * Pagination
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Date range
 */
export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine((data) => data.from <= data.to, {
  message: 'From date must be before to date',
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: safeStringSchema.min(2, 'Name too short').max(100, 'Name too long'),
  phone: phoneSchema.optional(),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const updateUserSchema = z.object({
  name: safeStringSchema.min(2).max(100).optional(),
  phone: phoneSchema.optional(),
  avatar: z.string().url().optional(),
});

export const userRoleSchema = z.enum(['ADMIN', 'DISPATCHER', 'TECHNICIAN']);

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: userRoleSchema,
  name: safeStringSchema.min(2).max(100).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const createCustomerSchema = z.object({
  name: safeStringSchema.min(2, 'Name too short').max(100, 'Name too long'),
  phone: phoneSchema,
  email: emailSchema.optional(),
  address: z.object({
    street: safeStringSchema.max(200),
    number: safeStringSchema.max(20).optional(),
    floor: safeStringSchema.max(20).optional(),
    apartment: safeStringSchema.max(20).optional(),
    neighborhood: safeStringSchema.max(100).optional(),
    city: safeStringSchema.max(100).default('Buenos Aires'),
    postalCode: safeStringSchema.max(20).optional(),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }).optional(),
  }),
  notes: safeStringSchema.max(1000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ═══════════════════════════════════════════════════════════════════════════════
// JOB SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const serviceTypeSchema = z.enum([
  'instalacion_split',
  'reparacion_split',
  'mantenimiento_split',
  'instalacion_calefactor',
  'reparacion_calefactor',
  'mantenimiento_calefactor',
  'otro',
]);

export const jobStatusSchema = z.enum([
  'pending',
  'assigned',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
]);

export const urgencySchema = z.enum(['normal', 'urgente']);

export const createJobSchema = z.object({
  customerId: uuidSchema,
  serviceType: serviceTypeSchema,
  description: safeStringSchema.max(2000),
  urgency: urgencySchema.default('normal'),
  scheduledDate: z.coerce.date().optional(),
  scheduledTimeSlot: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  }).optional(),
  technicianId: uuidSchema.optional(),
  notes: safeStringSchema.max(1000).optional(),
  estimatedDuration: z.number().int().positive().optional(),
});

export const updateJobSchema = createJobSchema.partial().extend({
  status: jobStatusSchema.optional(),
});

export const assignJobSchema = z.object({
  technicianId: uuidSchema,
  scheduledDate: z.coerce.date(),
  scheduledTimeSlot: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
});

export const completeJobSchema = z.object({
  resolution: safeStringSchema.min(10).max(2000),
  materialsUsed: z.array(z.object({
    name: safeStringSchema.max(100),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive().optional(),
  })).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  customerSignature: z.string().optional(),
  paymentReceived: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'mercadopago']).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const availabilitySchema = z.object({
  date: z.coerce.date(),
  slots: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    available: z.boolean(),
  })),
});

export const blockTimeSchema = z.object({
  technicianId: uuidSchema,
  date: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: safeStringSchema.max(200).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const sendMessageSchema = z.object({
  to: phoneSchema,
  template: z.string().max(100).optional(),
  templateParams: z.record(z.string()).optional(),
  text: safeStringSchema.max(4096).optional(),
}).refine(
  (data) => data.template || data.text,
  'Either template or text must be provided'
);

export const webhookVerifySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE MESSAGE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const voiceReviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit']),
  corrections: z.object({
    customerName: safeStringSchema.max(100).optional(),
    customerAddress: safeStringSchema.max(300).optional(),
    serviceType: serviceTypeSchema.optional(),
    description: safeStringSchema.max(2000).optional(),
    urgency: urgencySchema.optional(),
  }).optional(),
  rejectionReason: safeStringSchema.max(500).optional(),
}).refine(
  (data) => {
    if (data.action === 'reject' && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  { message: 'Rejection reason is required when rejecting' }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const updateOrganizationSchema = z.object({
  name: safeStringSchema.min(2).max(100).optional(),
  logo: z.string().url().optional(),
  settings: z.object({
    defaultScheduleStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    defaultScheduleEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    autoAssignEnabled: z.boolean().optional(),
    notificationPreferences: z.object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      push: z.boolean().optional(),
    }).optional(),
  }).optional(),
});
