/**
 * Domain Service
 * ==============
 *
 * Manages custom domains for white-label portal instances.
 * Handles domain verification and routing.
 */

import * as crypto from 'crypto';
import * as dns from 'dns';
import { promisify } from 'util';
import { Pool } from 'pg';
import { DomainConfig } from './whitelabel.types';

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_TOKEN_PREFIX = 'campotech-verify=';
const BASE_DOMAIN = process.env.BASE_PORTAL_DOMAIN || 'portal.campotech.io';

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DomainService {
  private pool: Pool;
  private domainCache: Map<string, { config: DomainConfig | null; expiresAt: number }>;
  private orgDomainCache: Map<string, { domain: string | null; expiresAt: number }>;
  private cacheTTLMs: number;

  constructor(pool: Pool, options?: { cacheTTLMs?: number }) {
    this.pool = pool;
    this.domainCache = new Map();
    this.orgDomainCache = new Map();
    this.cacheTTLMs = options?.cacheTTLMs || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get organization ID for a domain (for routing)
   */
  async getOrgIdByDomain(domain: string): Promise<string | null> {
    // Normalize domain
    const normalizedDomain = this.normalizeDomain(domain);

    // Check cache
    const cached = this.domainCache.get(normalizedDomain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config?.orgId || null;
    }

    // Check for custom domain
    const customQuery = `
      SELECT org_id, custom_domain, subdomain, ssl_enabled, verification_status
      FROM whitelabel_domains
      WHERE custom_domain = $1 AND verification_status = 'verified'
    `;
    let result = await this.pool.query(customQuery, [normalizedDomain]);

    if (result.rows.length > 0) {
      const config = this.mapRowToDomain(result.rows[0]);
      this.domainCache.set(normalizedDomain, {
        config,
        expiresAt: Date.now() + this.cacheTTLMs,
      });
      return config.orgId;
    }

    // Check for subdomain pattern (orgslug.portal.campotech.io)
    if (normalizedDomain.endsWith(`.${BASE_DOMAIN}`)) {
      const subdomain = normalizedDomain.replace(`.${BASE_DOMAIN}`, '');
      const subdomainQuery = `
        SELECT id FROM organizations WHERE slug = $1
      `;
      result = await this.pool.query(subdomainQuery, [subdomain]);

      if (result.rows.length > 0) {
        const config: DomainConfig = {
          orgId: result.rows[0].id,
          customDomain: normalizedDomain,
          subdomain,
          sslEnabled: true,
          verificationStatus: 'verified',
          createdAt: new Date(),
        };
        this.domainCache.set(normalizedDomain, {
          config,
          expiresAt: Date.now() + this.cacheTTLMs,
        });
        return config.orgId;
      }
    }

    // Not found
    this.domainCache.set(normalizedDomain, {
      config: null,
      expiresAt: Date.now() + this.cacheTTLMs,
    });
    return null;
  }

  /**
   * Get domain config for an organization
   */
  async getDomainByOrgId(orgId: string): Promise<DomainConfig | null> {
    // Check cache
    const cached = this.orgDomainCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.domain) return null;
      return this.domainCache.get(cached.domain)?.config || null;
    }

    // Query database
    const query = `
      SELECT org_id, custom_domain, subdomain, ssl_enabled,
             verification_status, verification_token, created_at, verified_at
      FROM whitelabel_domains
      WHERE org_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [orgId]);

    if (result.rows.length === 0) {
      this.orgDomainCache.set(orgId, {
        domain: null,
        expiresAt: Date.now() + this.cacheTTLMs,
      });
      return null;
    }

    const config = this.mapRowToDomain(result.rows[0]);
    this.domainCache.set(config.customDomain, {
      config,
      expiresAt: Date.now() + this.cacheTTLMs,
    });
    this.orgDomainCache.set(orgId, {
      domain: config.customDomain,
      expiresAt: Date.now() + this.cacheTTLMs,
    });

    return config;
  }

  /**
   * Set up a custom domain for an organization
   */
  async setCustomDomain(orgId: string, domain: string): Promise<DomainConfig> {
    const normalizedDomain = this.normalizeDomain(domain);

    // Validate domain format
    if (!this.isValidDomain(normalizedDomain)) {
      throw new Error('Invalid domain format');
    }

    // Check if domain is already in use
    const existingQuery = `
      SELECT org_id FROM whitelabel_domains
      WHERE custom_domain = $1 AND org_id != $2
    `;
    const existing = await this.pool.query(existingQuery, [normalizedDomain, orgId]);

    if (existing.rows.length > 0) {
      throw new Error('Domain is already in use by another organization');
    }

    // Generate verification token
    const verificationToken = this.generateVerificationToken();

    // Upsert domain config
    const query = `
      INSERT INTO whitelabel_domains (
        org_id, custom_domain, verification_token, verification_status, created_at
      )
      VALUES ($1, $2, $3, 'pending', NOW())
      ON CONFLICT (org_id)
      DO UPDATE SET
        custom_domain = EXCLUDED.custom_domain,
        verification_token = EXCLUDED.verification_token,
        verification_status = 'pending',
        verified_at = NULL
      RETURNING *
    `;
    const result = await this.pool.query(query, [orgId, normalizedDomain, verificationToken]);

    // Clear cache
    this.clearCache(orgId, normalizedDomain);

    return this.mapRowToDomain(result.rows[0]);
  }

  /**
   * Verify a custom domain
   */
  async verifyDomain(orgId: string): Promise<{ verified: boolean; error?: string }> {
    // Get current domain config
    const domainConfig = await this.getDomainByOrgId(orgId);

    if (!domainConfig) {
      return { verified: false, error: 'No domain configured' };
    }

    if (domainConfig.verificationStatus === 'verified') {
      return { verified: true };
    }

    try {
      // Check TXT record for verification
      const txtVerified = await this.verifyTxtRecord(
        domainConfig.customDomain,
        domainConfig.verificationToken!
      );

      if (!txtVerified) {
        return {
          verified: false,
          error: 'TXT verification record not found. Add a TXT record with: ' +
            `${VERIFICATION_TOKEN_PREFIX}${domainConfig.verificationToken}`,
        };
      }

      // Check CNAME record
      const cnameVerified = await this.verifyCnameRecord(domainConfig.customDomain);

      if (!cnameVerified) {
        return {
          verified: false,
          error: `CNAME record not found. Point your domain to: ${BASE_DOMAIN}`,
        };
      }

      // Update verification status
      await this.pool.query(
        `
        UPDATE whitelabel_domains
        SET verification_status = 'verified', verified_at = NOW()
        WHERE org_id = $1
        `,
        [orgId]
      );

      // Clear cache
      this.clearCache(orgId, domainConfig.customDomain);

      console.log(`[DomainService] Domain verified: ${domainConfig.customDomain} for org ${orgId}`);

      return { verified: true };
    } catch (error) {
      console.error('[DomainService] Verification error:', error);
      return { verified: false, error: 'DNS lookup failed. Please check your DNS configuration.' };
    }
  }

  /**
   * Get verification instructions for a domain
   */
  getVerificationInstructions(config: DomainConfig): {
    txtRecord: { name: string; value: string };
    cnameRecord: { name: string; value: string };
  } {
    return {
      txtRecord: {
        name: `_campotech.${config.customDomain}`,
        value: `${VERIFICATION_TOKEN_PREFIX}${config.verificationToken}`,
      },
      cnameRecord: {
        name: config.customDomain,
        value: BASE_DOMAIN,
      },
    };
  }

  /**
   * Remove custom domain for an organization
   */
  async removeCustomDomain(orgId: string): Promise<void> {
    const config = await this.getDomainByOrgId(orgId);

    await this.pool.query(
      'DELETE FROM whitelabel_domains WHERE org_id = $1',
      [orgId]
    );

    if (config) {
      this.clearCache(orgId, config.customDomain);
    }
  }

  /**
   * Clear cache for domain
   */
  clearCache(orgId: string, domain?: string): void {
    this.orgDomainCache.delete(orgId);
    if (domain) {
      this.domainCache.delete(domain);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  private generateVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async verifyTxtRecord(domain: string, expectedToken: string): Promise<boolean> {
    try {
      const records = await resolveTxt(`_campotech.${domain}`);
      const expectedValue = `${VERIFICATION_TOKEN_PREFIX}${expectedToken}`;

      for (const record of records) {
        const value = record.join('');
        if (value === expectedValue) {
          return true;
        }
      }
      return false;
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return false;
      }
      throw error;
    }
  }

  private async verifyCnameRecord(domain: string): Promise<boolean> {
    try {
      const records = await resolveCname(domain);
      return records.some((record) =>
        record.toLowerCase() === BASE_DOMAIN.toLowerCase()
      );
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return false;
      }
      throw error;
    }
  }

  private mapRowToDomain(row: any): DomainConfig {
    return {
      orgId: row.org_id,
      customDomain: row.custom_domain,
      subdomain: row.subdomain,
      sslEnabled: row.ssl_enabled ?? true,
      sslCertificateId: row.ssl_certificate_id,
      verificationStatus: row.verification_status,
      verificationToken: row.verification_token,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let domainServiceInstance: DomainService | null = null;

export function getDomainService(): DomainService {
  if (!domainServiceInstance) {
    throw new Error('DomainService not initialized');
  }
  return domainServiceInstance;
}

export function initializeDomainService(
  pool: Pool,
  options?: { cacheTTLMs?: number }
): DomainService {
  domainServiceInstance = new DomainService(pool, options);
  return domainServiceInstance;
}

export function resetDomainService(): void {
  domainServiceInstance = null;
}
