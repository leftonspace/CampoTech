/**
 * CAE Request Handler
 * ===================
 *
 * Orchestrates the complete CAE request flow:
 * 1. Reserve invoice number
 * 2. Build request
 * 3. Submit to AFIP
 * 4. Handle response
 */

import { Pool, PoolClient } from 'pg';
import {
  AFIPConfig,
  AFIPInvoiceInput,
  AFIPInvoiceType,
  CAEResult,
  classifyAFIPError,
  AFIPErrorType,
} from '../afip.types';
import { getWSFEClient } from './wsfe.client';
import { buildCAERequest, roundAmount } from './invoice-builder';
import { log } from '../../../lib/logging/logger';
import { withTransaction } from '../../../shared/utils/database.utils';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE NUMBER SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reserve the next invoice number atomically
 * This ensures no gaps in invoice numbering
 */
export async function reserveInvoiceNumber(
  pool: Pool,
  orgId: string,
  puntoVenta: number,
  invoiceType: AFIPInvoiceType
): Promise<number> {
  return withTransaction(pool, async (client: PoolClient) => {
    // Lock and increment the sequence
    const result = await client.query(
      `INSERT INTO afip_sequences (org_id, punto_venta, invoice_type, last_number)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (org_id, punto_venta, invoice_type)
       DO UPDATE SET last_number = afip_sequences.last_number + 1
       RETURNING last_number`,
      [orgId, puntoVenta, invoiceType]
    );

    return result.rows[0].last_number;
  });
}

/**
 * Sync local sequence with AFIP
 * Call this during setup or after discrepancies
 */
export async function syncSequenceWithAFIP(
  pool: Pool,
  config: AFIPConfig,
  invoiceType: AFIPInvoiceType
): Promise<number> {
  const wsfeClient = getWSFEClient();

  // Get last number from AFIP
  const ultimo = await wsfeClient.getUltimoAutorizado(
    config,
    config.puntoVenta,
    invoiceType
  );

  // Update local sequence
  await pool.query(
    `INSERT INTO afip_sequences (org_id, punto_venta, invoice_type, last_number)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, punto_venta, invoice_type)
     DO UPDATE SET last_number = GREATEST(afip_sequences.last_number, $4)`,
    [config.cuit, config.puntoVenta, invoiceType, ultimo.CbteNro]
  );

  log.info('Synced AFIP sequence', {
    orgId: config.cuit,
    puntoVenta: config.puntoVenta,
    invoiceType,
    lastNumber: ultimo.CbteNro,
  });

  return ultimo.CbteNro;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAE REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export interface CAERequestResult extends CAEResult {
  reserved: boolean;
  errorType?: AFIPErrorType;
}

/**
 * Request CAE for an invoice
 *
 * This is the main entry point for CAE requests.
 * It handles:
 * - Invoice number reservation
 * - Request building
 * - AFIP communication
 * - Error classification
 */
export async function requestCAE(
  pool: Pool,
  config: AFIPConfig,
  invoice: AFIPInvoiceInput
): Promise<CAERequestResult> {
  log.info('Starting CAE request', {
    invoiceId: invoice.id,
    orgId: invoice.orgId,
    invoiceType: invoice.invoiceType,
  });

  // Step 1: Reserve invoice number
  let invoiceNumber: number;
  try {
    invoiceNumber = await reserveInvoiceNumber(
      pool,
      invoice.orgId,
      invoice.puntoVenta,
      invoice.invoiceType
    );

    log.info('Reserved invoice number', {
      invoiceId: invoice.id,
      invoiceNumber,
    });
  } catch (error) {
    log.error('Failed to reserve invoice number', error);
    return {
      success: false,
      reserved: false,
      errors: [{
        Code: 0,
        Msg: 'Failed to reserve invoice number',
      }],
    };
  }

  // Step 2: Build request
  const wsfeClient = getWSFEClient();
  const auth = {
    Token: '', // Will be filled by client
    Sign: '',
    Cuit: config.cuit,
  };

  const request = buildCAERequest(auth, invoice, invoiceNumber);

  // Step 3: Submit to AFIP
  try {
    const result = await wsfeClient.solicitarCAE(config, request);

    // Step 4: Process result
    const response: CAERequestResult = {
      ...result,
      reserved: true,
      invoiceNumber,
    };

    // Classify errors
    if (!result.success && result.errors && result.errors.length > 0) {
      const mainError = result.errors[0];
      response.errorType = classifyAFIPError(mainError.Code);
    }

    // Update invoice in database
    await updateInvoiceCAE(pool, invoice.id, response);

    return response;
  } catch (error) {
    log.error('AFIP request failed', error);

    const response: CAERequestResult = {
      success: false,
      reserved: true,
      invoiceNumber,
      errorType: 'transient',
      errors: [{
        Code: 0,
        Msg: error instanceof Error ? error.message : 'Unknown error',
      }],
    };

    // Still update invoice with the reserved number and error
    await updateInvoiceCAE(pool, invoice.id, response);

    return response;
  }
}

/**
 * Update invoice with CAE result
 */
async function updateInvoiceCAE(
  pool: Pool,
  invoiceId: string,
  result: CAERequestResult
): Promise<void> {
  if (result.success) {
    // CAE approved
    await pool.query(
      `UPDATE invoices
       SET invoice_number = $2,
           cae = $3,
           cae_expiry = $4,
           status = 'issued',
           issued_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, result.invoiceNumber, result.cae, result.caeExpiry]
    );
  } else {
    // CAE rejected or failed
    const errorJson = result.errors ? JSON.stringify(result.errors) : null;

    await pool.query(
      `UPDATE invoices
       SET invoice_number = $2,
           status = CASE
             WHEN $3 = 'permanent' THEN 'cae_failed'
             ELSE 'pending_cae'
           END,
           afip_response = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, result.invoiceNumber, result.errorType, errorJson]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine if a CAE request should be retried
 */
export function shouldRetryCAE(result: CAERequestResult): boolean {
  // Don't retry if successful
  if (result.success) return false;

  // Don't retry permanent errors
  if (result.errorType === 'permanent') return false;

  // Retry transient and authentication errors
  return result.errorType === 'transient' || result.errorType === 'authentication';
}

/**
 * Calculate retry delay (exponential backoff for AFIP)
 */
export function getRetryDelay(attempt: number): number {
  // AFIP-specific backoff: 30s → 2m → 5m → 15m → 30m
  const delays = [30000, 120000, 300000, 900000, 1800000];
  return delays[Math.min(attempt - 1, delays.length - 1)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request CAE for multiple invoices
 * Processes sequentially to maintain number ordering
 */
export async function requestCAEBatch(
  pool: Pool,
  config: AFIPConfig,
  invoices: AFIPInvoiceInput[]
): Promise<CAERequestResult[]> {
  const results: CAERequestResult[] = [];

  for (const invoice of invoices) {
    const result = await requestCAE(pool, config, invoice);
    results.push(result);

    // Stop on permanent error
    if (!result.success && result.errorType === 'permanent') {
      break;
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
