/**
 * Organization Repository
 * =======================
 */

import { Pool } from 'pg';
import { BaseRepository, objectToCamel, objectToSnake } from '../../shared/repositories/base.repository';
import { Organization, OrganizationSettings } from '../../shared/types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor(pool: Pool) {
    super(pool, 'organizations');
  }

  /**
   * Find by CUIT
   */
  async findByCUIT(cuit: string): Promise<Organization | null> {
    const result = await this.pool.query(
      `SELECT * FROM organizations WHERE cuit = $1`,
      [cuit]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update organization settings
   */
  async updateSettings(id: string, settings: Partial<OrganizationSettings>): Promise<Organization | null> {
    const result = await this.pool.query(
      `UPDATE organizations
       SET settings = settings || $2::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(settings)]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Mark AFIP as configured
   */
  async setAFIPConfigured(id: string, configured: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE organizations SET afip_configured = $2, updated_at = NOW() WHERE id = $1`,
      [id, configured]
    );
  }

  /**
   * Mark MercadoPago as configured
   */
  async setMercadoPagoConfigured(id: string, configured: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE organizations SET mercadopago_configured = $2, updated_at = NOW() WHERE id = $1`,
      [id, configured]
    );
  }

  /**
   * Mark WhatsApp as configured
   */
  async setWhatsAppConfigured(id: string, configured: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE organizations SET whatsapp_configured = $2, updated_at = NOW() WHERE id = $1`,
      [id, configured]
    );
  }

  /**
   * Get active organizations count
   */
  async getActiveCount(): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM organizations WHERE is_active = true`
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Override mapRow to handle JSONB settings
   */
  protected mapRow(row: Record<string, any>): Organization {
    const mapped = objectToCamel<Organization>(row);
    // Settings is already JSON, ensure it's parsed
    if (typeof mapped.settings === 'string') {
      mapped.settings = JSON.parse(mapped.settings);
    }
    return mapped;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let repository: OrganizationRepository | null = null;

export function getOrganizationRepository(pool?: Pool): OrganizationRepository {
  if (!repository && pool) {
    repository = new OrganizationRepository(pool);
  }
  if (!repository) {
    throw new Error('OrganizationRepository not initialized');
  }
  return repository;
}
