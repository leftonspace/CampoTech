/**
 * Validation Middleware
 * =====================
 *
 * Input validation schemas and middleware for request validation.
 * Prevents mass assignment and ensures type safety.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole, IVACondition, JobStatus, PaymentMethod } from '../types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

export class ValidationError extends Error {
  code: string;
  statusCode: number;
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
    this.fields = fields;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type SchemaField = {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'enum';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: readonly string[];
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
};

type Schema = Record<string, SchemaField>;

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function validateField(value: any, field: SchemaField, fieldName: string): string | null {
  // Handle required
  if (value === undefined || value === null) {
    if (field.required) {
      return `${fieldName} is required`;
    }
    return null; // Optional field not provided
  }

  // Type checks
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        return `${fieldName} must be at least ${field.minLength} characters`;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `${fieldName} must be at most ${field.maxLength} characters`;
      }
      if (field.pattern && !field.pattern.test(value)) {
        return `${fieldName} has invalid format`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `${fieldName} must be a valid number`;
      }
      if (field.min !== undefined && value < field.min) {
        return `${fieldName} must be at least ${field.min}`;
      }
      if (field.max !== undefined && value > field.max) {
        return `${fieldName} must be at most ${field.max}`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${fieldName} must be a boolean`;
      }
      break;

    case 'date':
      if (!(value instanceof Date) && isNaN(Date.parse(value))) {
        return `${fieldName} must be a valid date`;
      }
      break;

    case 'enum':
      if (!field.enum?.includes(value)) {
        return `${fieldName} must be one of: ${field.enum?.join(', ')}`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `${fieldName} must be an array`;
      }
      if (field.items) {
        for (let i = 0; i < value.length; i++) {
          const itemError = validateField(value[i], field.items, `${fieldName}[${i}]`);
          if (itemError) return itemError;
        }
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `${fieldName} must be an object`;
      }
      if (field.properties) {
        for (const [key, propSchema] of Object.entries(field.properties)) {
          const propError = validateField(value[key], propSchema, `${fieldName}.${key}`);
          if (propError) return propError;
        }
      }
      break;
  }

  return null;
}

function validateSchema<T>(data: unknown, schema: Schema): T {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('Request body must be an object');
  }

  const errors: Record<string, string> = {};
  const result: Record<string, any> = {};

  // Only extract allowed fields (prevents mass assignment)
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = (data as Record<string, any>)[fieldName];
    const error = validateField(value, fieldSchema, fieldName);

    if (error) {
      errors[fieldName] = error;
    } else if (value !== undefined) {
      // Convert date strings to Date objects
      if (fieldSchema.type === 'date' && typeof value === 'string') {
        result[fieldName] = new Date(value);
      } else {
        result[fieldName] = value;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return result as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// User schemas
export const CreateUserSchema: Schema = {
  phone: { type: 'string', required: true, minLength: 8, maxLength: 20 },
  fullName: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  email: { type: 'string', maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  role: { type: 'enum', required: true, enum: ['admin', 'technician'] as const },
};

export const UpdateUserSchema: Schema = {
  fullName: { type: 'string', minLength: 1, maxLength: 200 },
  email: { type: 'string', maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  role: { type: 'enum', enum: ['admin', 'technician'] as const },
};

// Customer schemas
export const CreateCustomerSchema: Schema = {
  fullName: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  phone: { type: 'string', required: true, minLength: 8, maxLength: 20 },
  email: { type: 'string', maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  cuit: { type: 'string', minLength: 11, maxLength: 13 },
  ivaCondition: { type: 'enum', enum: ['responsable_inscripto', 'monotributista', 'exento', 'consumidor_final'] as const },
  address: { type: 'string', maxLength: 500 },
  city: { type: 'string', maxLength: 100 },
  province: { type: 'string', maxLength: 100 },
  postalCode: { type: 'string', maxLength: 20 },
  notes: { type: 'string', maxLength: 2000 },
};

export const UpdateCustomerSchema: Schema = {
  fullName: { type: 'string', minLength: 1, maxLength: 200 },
  phone: { type: 'string', minLength: 8, maxLength: 20 },
  email: { type: 'string', maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  cuit: { type: 'string', minLength: 11, maxLength: 13 },
  ivaCondition: { type: 'enum', enum: ['responsable_inscripto', 'monotributista', 'exento', 'consumidor_final'] as const },
  address: { type: 'string', maxLength: 500 },
  city: { type: 'string', maxLength: 100 },
  province: { type: 'string', maxLength: 100 },
  postalCode: { type: 'string', maxLength: 20 },
  notes: { type: 'string', maxLength: 2000 },
};

// Job schemas
export const CreateJobSchema: Schema = {
  customerId: { type: 'string', required: true, minLength: 36, maxLength: 36 },
  assignedTo: { type: 'string', minLength: 36, maxLength: 36 },
  scheduledAt: { type: 'date' },
  description: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
  address: { type: 'string', required: true, minLength: 1, maxLength: 500 },
  city: { type: 'string', maxLength: 100 },
  province: { type: 'string', maxLength: 100 },
  postalCode: { type: 'string', maxLength: 20 },
  latitude: { type: 'number', min: -90, max: 90 },
  longitude: { type: 'number', min: -180, max: 180 },
  estimatedDuration: { type: 'number', min: 0, max: 1440 },
  lineItems: {
    type: 'array', items: {
      type: 'object',
      properties: {
        priceBookItemId: { type: 'string', maxLength: 36 },
        description: { type: 'string', required: true, maxLength: 500 },
        quantity: { type: 'number', required: true, min: 0.01, max: 999999 },
        unitPrice: { type: 'number', required: true, min: 0, max: 999999999 },
        taxRate: { type: 'number', required: true, min: 0, max: 1 },
      },
    }
  },
};

export const TransitionJobSchema: Schema = {
  status: { type: 'enum', required: true, enum: ['pending', 'scheduled', 'en_camino', 'working', 'completed', 'cancelled'] as const },
  reason: { type: 'string', maxLength: 1000 },
  photos: { type: 'array', items: { type: 'string', maxLength: 2000 } },
  signature: { type: 'string', maxLength: 50000 },
  notes: { type: 'string', maxLength: 5000 },
};

// Invoice schemas
export const CreateInvoiceSchema: Schema = {
  jobId: { type: 'string', minLength: 36, maxLength: 36 },
  customerId: { type: 'string', required: true, minLength: 36, maxLength: 36 },
  dueDate: { type: 'date' },
  lineItems: {
    type: 'array', required: true, items: {
      type: 'object',
      properties: {
        productCode: { type: 'string', required: true, maxLength: 50 },
        description: { type: 'string', required: true, maxLength: 500 },
        quantity: { type: 'number', required: true, min: 0.01, max: 999999 },
        unitPrice: { type: 'number', required: true, min: 0, max: 999999999 },
        taxRate: { type: 'number', required: true, min: 0, max: 1 },
      },
    }
  },
};

// Payment schemas
export const CreatePaymentSchema: Schema = {
  invoiceId: { type: 'string', required: true, minLength: 36, maxLength: 36 },
  amount: { type: 'number', required: true, min: 0.01, max: 999999999 },
  method: { type: 'enum', required: true, enum: ['mercadopago', 'cash', 'transfer', 'check', 'card_present'] as const },
  reference: { type: 'string', maxLength: 200 },
  notes: { type: 'string', maxLength: 2000 },
};

export const RefundPaymentSchema: Schema = {
  amount: { type: 'number', required: true, min: 0.01, max: 999999999 },
  reason: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
};

// PriceBook schemas
export const CreatePriceBookItemSchema: Schema = {
  categoryId: { type: 'string', minLength: 36, maxLength: 36 },
  code: { type: 'string', required: true, minLength: 1, maxLength: 50 },
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  unitPrice: { type: 'number', required: true, min: 0, max: 999999999 },
  unit: { type: 'string', required: true, minLength: 1, maxLength: 50 },
  taxRate: { type: 'number', required: true, min: 0, max: 1 },
  estimatedDuration: { type: 'number', min: 0, max: 1440 },
};

export const CreateCategorySchema: Schema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  description: { type: 'string', maxLength: 500 },
  parentId: { type: 'string', minLength: 36, maxLength: 36 },
  sortOrder: { type: 'number', min: 0, max: 9999 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create validation middleware for a schema
 */
export function validate<T>(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = validateSchema<T>(req.body, schema);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
          },
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(allowedParams: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const unknownParams = Object.keys(req.query).filter(
      key => !allowedParams.includes(key)
    );
    if (unknownParams.length > 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_QUERY_PARAMS',
          message: `Unknown query parameters: ${unknownParams.join(', ')}`,
        },
      });
      return;
    }
    next();
  };
}
