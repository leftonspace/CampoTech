/**
 * AFIP Service
 * ============
 *
 * Main entry point for AFIP integration.
 * Coordinates authentication, invoicing, and lookups.
 */

import { Pool } from 'pg';
import {
  AFIPConfig,
  AFIPEnvironment,
  AFIPInvoiceInput,
  AFIPInvoiceType,
  CAEResult,
  CUITLookupResult,
  classifyAFIPError,
} from './afip.types';
import { getWSAAClient, invalidateAllTokens } from './wsaa';
import { getWSFEClient, requestCAE, syncSequenceWithAFIP, CAERequestResult } from './wsfe';
import { getCUITLookupClient, validateCUITFormat } from './padron';
import { generateInvoiceQR, QRGenerationResult } from './qr-generator';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPService {
  private pool: Pool;
  private environment: AFIPEnvironment;

  constructor(pool: Pool, environment?: AFIPEnvironment) {
    this.pool = pool;
    this.environment = environment || (process.env.AFIP_ENVIRONMENT as AFIPEnvironment) || 'homologation';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get AFIP configuration for an organization
   */
  async getConfig(orgId: string): Promise<AFIPConfig | null> {
    const result = await this.pool.query(
      `SELECT cuit, afip_punto_venta, afip_cert, afip_key, afip_cert_expiry
       FROM organizations
       WHERE id = $1`,
      [orgId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const org = result.rows[0];

    if (!org.cuit || !org.afip_cert || !org.afip_key) {
      return null;
    }

    return {
      environment: this.environment,
      cuit: org.cuit,
      puntoVenta: org.afip_punto_venta || 1,
      certificate: org.afip_cert, // Should be decrypted
      privateKey: org.afip_key,   // Should be decrypted
      certExpiry: org.afip_cert_expiry,
    };
  }

  /**
   * Check if AFIP is configured for an organization
   */
  async isConfigured(orgId: string): Promise<boolean> {
    const config = await this.getConfig(orgId);
    return config !== null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Test AFIP authentication
   */
  async testAuthentication(config: AFIPConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const wsaaClient = getWSAAClient(this.environment);
      const result = await wsaaClient.authenticate(
        config.cuit,
        config.certificate,
        config.privateKey,
        'wsfe'
      );

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear cached authentication tokens for an organization
   */
  clearAuthCache(cuit: string): void {
    invalidateAllTokens(cuit);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVOICING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Request CAE for an invoice
   */
  async requestCAE(config: AFIPConfig, invoice: AFIPInvoiceInput): Promise<CAERequestResult> {
    return requestCAE(this.pool, config, invoice);
  }

  /**
   * Get the last authorized invoice number
   */
  async getLastInvoiceNumber(
    config: AFIPConfig,
    invoiceType: AFIPInvoiceType
  ): Promise<number> {
    const wsfeClient = getWSFEClient(this.environment);
    const result = await wsfeClient.getUltimoAutorizado(
      config,
      config.puntoVenta,
      invoiceType
    );
    return result.CbteNro;
  }

  /**
   * Sync local invoice sequence with AFIP
   */
  async syncInvoiceSequence(config: AFIPConfig, invoiceType: AFIPInvoiceType): Promise<number> {
    return syncSequenceWithAFIP(this.pool, config, invoiceType);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CUIT LOOKUP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate CUIT format (offline)
   */
  validateCUIT(cuit: string): { valid: boolean; error?: string } {
    return validateCUITFormat(cuit);
  }

  /**
   * Lookup taxpayer information by CUIT
   */
  async lookupCUIT(config: AFIPConfig, cuit: string): Promise<CUITLookupResult> {
    const client = getCUITLookupClient(this.environment);
    return client.lookup(config, cuit);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QR CODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate QR code for an invoice
   */
  generateQRCode(params: {
    date: Date;
    cuit: string;
    puntoVenta: number;
    invoiceType: AFIPInvoiceType;
    invoiceNumber: number;
    total: number;
    customerDocType: number;
    customerDocNumber: string;
    cae: string;
  }): QRGenerationResult {
    return generateInvoiceQR({
      ...params,
      includeSvg: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check AFIP service health
   */
  async healthCheck(): Promise<{
    wsaa: boolean;
    wsfe: boolean;
    overall: boolean;
  }> {
    const wsaaClient = getWSAAClient(this.environment);
    const wsfeClient = getWSFEClient(this.environment);

    const [wsaaHealth, wsfeHealth] = await Promise.all([
      wsaaClient.healthCheck().catch(() => false),
      wsfeClient.healthCheck().catch(() => false),
    ]);

    return {
      wsaa: wsaaHealth,
      wsfe: wsfeHealth,
      overall: wsaaHealth && wsfeHealth,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let afipService: AFIPService | null = null;

export function getAFIPService(pool: Pool, environment?: AFIPEnvironment): AFIPService {
  if (!afipService) {
    afipService = new AFIPService(pool, environment);
  }
  return afipService;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetAFIPService(): void {
  afipService = null;
}
