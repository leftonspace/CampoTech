/**
 * Database Utilities
 * ==================
 *
 * Transaction helpers and database utilities.
 */

import { Pool, PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a function within a database transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 *
 * @example
 * const result = await withTransaction(pool, async (client) => {
 *   await client.query('INSERT INTO users...');
 *   await client.query('INSERT INTO audit_logs...');
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a function with a client from the pool (no transaction)
 * Useful when you need a dedicated connection but not a transaction
 */
export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Execute multiple operations in a single transaction
 * Each operation receives the client and can be async
 */
export async function withBatchTransaction<T>(
  pool: Pool,
  operations: Array<(client: PoolClient) => Promise<T>>
): Promise<T[]> {
  return withTransaction(pool, async (client) => {
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation(client));
    }
    return results;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMERIC VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a numeric value
 * Throws an error if validation fails
 */
export function validateNumber(
  value: number,
  fieldName: string,
  options: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    allowZero?: boolean;
    maxDecimalPlaces?: number;
  } = {}
): number {
  const {
    min,
    max,
    allowNegative = false,
    allowZero = true,
    maxDecimalPlaces,
  } = options;

  // Check if it's a valid number
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  // Check for NaN
  if (Number.isNaN(value)) {
    throw new Error(`${fieldName} cannot be NaN`);
  }

  // Check negative
  if (!allowNegative && value < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  // Check zero
  if (!allowZero && value === 0) {
    throw new Error(`${fieldName} cannot be zero`);
  }

  // Check min
  if (min !== undefined && value < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  // Check max
  if (max !== undefined && value > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }

  // Check decimal places
  if (maxDecimalPlaces !== undefined) {
    const decimalStr = value.toString().split('.')[1] || '';
    if (decimalStr.length > maxDecimalPlaces) {
      throw new Error(`${fieldName} cannot have more than ${maxDecimalPlaces} decimal places`);
    }
  }

  return value;
}

/**
 * Validate a monetary amount (ARS)
 * Must be positive, max 2 decimal places, within reasonable range
 */
export function validateMoney(value: number, fieldName: string): number {
  return validateNumber(value, fieldName, {
    min: 0,
    max: 999999999.99, // ~1 billion
    allowNegative: false,
    allowZero: true,
    maxDecimalPlaces: 2,
  });
}

/**
 * Validate a quantity
 * Must be positive, within reasonable range
 */
export function validateQuantity(value: number, fieldName: string): number {
  return validateNumber(value, fieldName, {
    min: 0.001, // Allow fractional quantities
    max: 999999,
    allowNegative: false,
    allowZero: false,
  });
}

/**
 * Validate a tax rate (0 to 1)
 */
export function validateTaxRate(value: number, fieldName: string): number {
  return validateNumber(value, fieldName, {
    min: 0,
    max: 1,
    allowNegative: false,
    allowZero: true,
    maxDecimalPlaces: 4,
  });
}

/**
 * Validate a percentage (0 to 100)
 */
export function validatePercentage(value: number, fieldName: string): number {
  return validateNumber(value, fieldName, {
    min: 0,
    max: 100,
    allowNegative: false,
    allowZero: true,
    maxDecimalPlaces: 2,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UUID VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID
 */
export function validateUUID(value: string, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  if (!UUID_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }

  return value.toLowerCase();
}

/**
 * Validate an optional UUID
 */
export function validateOptionalUUID(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return validateUUID(value, fieldName);
}
