/**
 * Location Validation Schemas
 * ===========================
 *
 * Zod schemas for validating location-related data.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export const LocationTypeSchema = z.enum([
  'HEADQUARTERS',
  'BRANCH',
  'WAREHOUSE',
  'SERVICE_POINT',
]);

export const TransferTypeSchema = z.enum([
  'JOB_ASSIGNMENT',
  'TECHNICIAN_LOAN',
  'CUSTOMER_REFERRAL',
  'RESOURCE_SHARE',
  'FINANCIAL',
]);

export const TransferStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]);

export const CondicionIvaSchema = z.enum([
  'RESPONSABLE_INSCRIPTO',
  'MONOTRIBUTISTA',
  'EXENTO',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// GEOGRAPHIC SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const AddressSchema = z.object({
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  floor: z.string().max(10).optional(),
  apartment: z.string().max(10).optional(),
  city: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('Argentina'),
});

export const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(
    z.array(
      z.tuple([z.number(), z.number()]) // [lng, lat]
    ).min(4) // Minimum 4 points for a closed polygon
  ),
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const CreateLocationSchema = z.object({
  code: z.string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less')
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, underscores, and hyphens'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  type: LocationTypeSchema.default('BRANCH'),
  address: AddressSchema,
  coordinates: CoordinatesSchema.optional(),
  timezone: z.string()
    .min(1)
    .max(50)
    .default('America/Argentina/Buenos_Aires'),
  phone: z.string()
    .regex(/^\+?[0-9\s-]+$/, 'Invalid phone number')
    .optional(),
  email: z.string().email('Invalid email').optional(),
  managerId: z.string().cuid().optional(),
  isHeadquarters: z.boolean().default(false),
  coverageRadius: z.number().positive().max(500).optional(), // Max 500km
  coverageArea: GeoJSONPolygonSchema.optional(),
});

export const UpdateLocationSchema = CreateLocationSchema.partial().omit({
  // Code cannot be changed easily as it may be used in references
}).extend({
  code: z.string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i)
    .optional(),
  isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZONE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const CreateZoneSchema = z.object({
  locationId: z.string().cuid(),
  code: z.string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less')
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, underscores, and hyphens'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500).optional(),
  boundary: GeoJSONPolygonSchema.optional(),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)')
    .optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

export const UpdateZoneSchema = CreateZoneSchema.partial().omit({
  locationId: true, // Cannot change location
}).extend({
  isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION SETTINGS SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const TimeRangeSchema = z.object({
  open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
});

export const OperatingHoursSchema = z.object({
  monday: TimeRangeSchema.optional(),
  tuesday: TimeRangeSchema.optional(),
  wednesday: TimeRangeSchema.optional(),
  thursday: TimeRangeSchema.optional(),
  friday: TimeRangeSchema.optional(),
  saturday: TimeRangeSchema.optional(),
  sunday: TimeRangeSchema.optional(),
});

export const CreateLocationSettingsSchema = z.object({
  locationId: z.string().cuid(),
  operatingHours: OperatingHoursSchema.default({}),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')).default([]),
  serviceRadius: z.number().positive().max(500).optional(),
  maxJobsPerDay: z.number().int().positive().max(1000).optional(),
  defaultJobDuration: z.number().int().positive().max(480).optional(), // Max 8 hours
  allowEmergencyJobs: z.boolean().default(true),
  emergencyFeePercent: z.number().min(0).max(200).optional(),
  pricingMultiplier: z.number().positive().max(10).default(1.0),
  travelFeePerKm: z.number().min(0).optional(),
  minimumTravelFee: z.number().min(0).optional(),
  notifyOnNewJob: z.boolean().default(true),
  notifyOnJobComplete: z.boolean().default(true),
  notificationEmails: z.array(z.string().email()).default([]),
  whatsappNumber: z.string().regex(/^\+?[0-9\s-]+$/).optional(),
  whatsappBusinessId: z.string().optional(),
});

export const UpdateLocationSettingsSchema = CreateLocationSettingsSchema.partial().omit({
  locationId: true,
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION AFIP CONFIG SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const DomicilioFiscalSchema = z.object({
  calle: z.string().min(1).max(200),
  numero: z.string().min(1).max(20),
  piso: z.string().max(10).optional(),
  depto: z.string().max(10).optional(),
  localidad: z.string().min(1).max(100),
  provincia: z.string().min(1).max(100),
  cp: z.string().min(1).max(20),
});

export const CreateLocationAfipConfigSchema = z.object({
  locationId: z.string().cuid(),
  puntoDeVenta: z.number().int().positive().max(99999),
  tiposPuntoDeVenta: z.string().default('CAJA'),
  cuit: z.string()
    .regex(/^[0-9]{11}$/, 'CUIT must be 11 digits')
    .optional(),
  razonSocial: z.string().max(200).optional(),
  domicilioFiscal: DomicilioFiscalSchema.optional(),
  condicionIva: CondicionIvaSchema.default('RESPONSABLE_INSCRIPTO'),
});

export const UpdateLocationAfipConfigSchema = CreateLocationAfipConfigSchema.partial().omit({
  locationId: true,
}).extend({
  isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTER-LOCATION TRANSFER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const CreateInterLocationTransferSchema = z.object({
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  transferType: TransferTypeSchema,
  referenceId: z.string().optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  amount: z.number().positive().optional(),
}).refine(data => data.fromLocationId !== data.toLocationId, {
  message: 'Source and destination locations must be different',
  path: ['toLocationId'],
});

export const UpdateInterLocationTransferSchema = z.object({
  status: TransferStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY PARAMETER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const LocationFiltersSchema = z.object({
  type: LocationTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  isHeadquarters: z.coerce.boolean().optional(),
  managerId: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ZoneFiltersSchema = z.object({
  locationId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const TransferFiltersSchema = z.object({
  fromLocationId: z.string().cuid().optional(),
  toLocationId: z.string().cuid().optional(),
  transferType: TransferTypeSchema.optional(),
  status: TransferStatusSchema.optional(),
  requestedById: z.string().cuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════════════════
// COVERAGE CHECK SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const CoverageCheckSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
export type CreateZoneInput = z.infer<typeof CreateZoneSchema>;
export type UpdateZoneInput = z.infer<typeof UpdateZoneSchema>;
export type CreateLocationSettingsInput = z.infer<typeof CreateLocationSettingsSchema>;
export type UpdateLocationSettingsInput = z.infer<typeof UpdateLocationSettingsSchema>;
export type CreateLocationAfipConfigInput = z.infer<typeof CreateLocationAfipConfigSchema>;
export type UpdateLocationAfipConfigInput = z.infer<typeof UpdateLocationAfipConfigSchema>;
export type CreateInterLocationTransferInput = z.infer<typeof CreateInterLocationTransferSchema>;
export type UpdateInterLocationTransferInput = z.infer<typeof UpdateInterLocationTransferSchema>;
export type LocationFiltersInput = z.infer<typeof LocationFiltersSchema>;
export type ZoneFiltersInput = z.infer<typeof ZoneFiltersSchema>;
export type TransferFiltersInput = z.infer<typeof TransferFiltersSchema>;
export type CoverageCheckInput = z.infer<typeof CoverageCheckSchema>;
