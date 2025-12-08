/**
 * Organization Service
 * ====================
 *
 * Business logic for organization management.
 */

import { Pool, PoolClient } from 'pg';
import { Organization, OrganizationSettings, IVACondition } from '../../shared/types/domain.types';
import { validateCUIT } from '../../shared/utils/validation';
import { OrganizationRepository, getOrganizationRepository } from './organization.repository';
import {
  CreateOrganizationDTO,
  UpdateOrganizationDTO,
  UpdateOrganizationSettingsDTO,
  OnboardingDTO,
  OnboardingResponse,
  AFIPConfigDTO,
  AFIPConfigStatus,
  toOrganizationResponse,
} from './organization.types';
import { getEncryptionService } from '../../lib/security/encryption.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class OrganizationError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'OrganizationError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class OrganizationService {
  private repo: OrganizationRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = getOrganizationRepository(pool);
  }

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization> {
    const org = await this.repo.findById(id);
    if (!org) {
      throw new OrganizationError('ORG_NOT_FOUND', 'Organization not found', 404);
    }
    return org;
  }

  /**
   * Get organization by CUIT
   */
  async getByCUIT(cuit: string): Promise<Organization | null> {
    return this.repo.findByCUIT(cuit);
  }

  /**
   * Create new organization
   */
  async create(data: CreateOrganizationDTO): Promise<Organization> {
    // Validate CUIT
    const cuitValidation = validateCUIT(data.cuit);
    if (!cuitValidation.valid) {
      throw new OrganizationError('INVALID_CUIT', cuitValidation.error!);
    }

    // Check for duplicate CUIT
    const existing = await this.repo.findByCUIT(cuitValidation.formatted!);
    if (existing) {
      throw new OrganizationError('DUPLICATE_CUIT', 'An organization with this CUIT already exists');
    }

    // Default settings
    const defaultSettings: OrganizationSettings = {
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      dateFormat: 'DD/MM/YYYY',
      defaultPuntoVenta: 1,
      autoInvoice: true,
      sendInvoiceByWhatsapp: true,
      requireSignature: true,
      requirePhotos: true,
    };

    // Create organization
    return this.repo.create({
      name: data.name,
      cuit: cuitValidation.formatted!,
      ivaCondition: data.ivaCondition,
      legalName: data.legalName,
      address: data.address,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      phone: data.phone,
      email: data.email,
      settings: defaultSettings,
      afipConfigured: false,
      mercadopagoConfigured: false,
      whatsappConfigured: false,
      isActive: true,
    });
  }

  /**
   * Onboarding flow - creates org and owner user in transaction
   */
  async onboard(data: OnboardingDTO, createUser: (client: PoolClient, orgId: string, phone: string, name: string) => Promise<{ id: string }>): Promise<{ organization: Organization; userId: string }> {
    // Validate CUIT
    const cuitValidation = validateCUIT(data.cuit);
    if (!cuitValidation.valid) {
      throw new OrganizationError('INVALID_CUIT', cuitValidation.error!);
    }

    // Check for duplicate CUIT
    const existing = await this.repo.findByCUIT(cuitValidation.formatted!);
    if (existing) {
      throw new OrganizationError('DUPLICATE_CUIT', 'An organization with this CUIT already exists');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Default settings
      const defaultSettings: OrganizationSettings = {
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        dateFormat: 'DD/MM/YYYY',
        defaultPuntoVenta: 1,
        autoInvoice: true,
        sendInvoiceByWhatsapp: true,
        requireSignature: true,
        requirePhotos: true,
      };

      // Create organization
      const orgId = crypto.randomUUID();
      const now = new Date();

      await client.query(
        `INSERT INTO organizations (id, name, cuit, iva_condition, settings, afip_configured, mercadopago_configured, whatsapp_configured, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, false, false, true, $6, $6)`,
        [orgId, data.name, cuitValidation.formatted, 'responsable_inscripto', JSON.stringify(defaultSettings), now]
      );

      // Create owner user via callback
      const user = await createUser(client, orgId, data.ownerPhone, data.ownerName);

      await client.query('COMMIT');

      const organization = await this.repo.findById(orgId);

      return {
        organization: organization!,
        userId: user.id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update organization
   */
  async update(id: string, data: UpdateOrganizationDTO): Promise<Organization> {
    const org = await this.getById(id);

    const updated = await this.repo.update(id, data);
    if (!updated) {
      throw new OrganizationError('UPDATE_FAILED', 'Failed to update organization');
    }

    return updated;
  }

  /**
   * Update organization settings
   */
  async updateSettings(id: string, settings: UpdateOrganizationSettingsDTO): Promise<Organization> {
    await this.getById(id); // Verify exists

    const updated = await this.repo.updateSettings(id, settings);
    if (!updated) {
      throw new OrganizationError('UPDATE_FAILED', 'Failed to update settings');
    }

    return updated;
  }

  /**
   * Configure AFIP
   */
  async configureAFIP(id: string, config: AFIPConfigDTO): Promise<AFIPConfigStatus> {
    const org = await this.getById(id);

    try {
      // Get encryption service
      const encryption = getEncryptionService();

      // Encrypt certificate with AAD
      const encryptedCert = encryption.encrypt(config.certificate, {
        orgId: id,
        purpose: 'afip-certificate',
      });

      // Encrypt password with AAD
      const encryptedPassword = encryption.encrypt(config.certificatePassword, {
        orgId: id,
        purpose: 'afip-certificate-password',
      });

      // Store encrypted credentials
      // TODO: Store in afip_credentials table
      await this.pool.query(
        `INSERT INTO afip_credentials (org_id, certificate_encrypted, password_encrypted, punto_venta, is_homologation, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (org_id) DO UPDATE SET
           certificate_encrypted = $2,
           password_encrypted = $3,
           punto_venta = $4,
           is_homologation = $5,
           updated_at = NOW()`,
        [id, JSON.stringify(encryptedCert), JSON.stringify(encryptedPassword), config.puntoVenta, config.isHomologation]
      );

      // Mark as configured
      await this.repo.setAFIPConfigured(id, true);

      // Update default punto de venta in settings
      await this.repo.updateSettings(id, { defaultPuntoVenta: config.puntoVenta });

      return {
        configured: true,
        puntoVenta: config.puntoVenta,
        isHomologation: config.isHomologation,
      };
    } catch (error) {
      throw new OrganizationError('AFIP_CONFIG_FAILED', 'Failed to configure AFIP: ' + (error as Error).message);
    }
  }

  /**
   * Get AFIP configuration status
   */
  async getAFIPStatus(id: string): Promise<AFIPConfigStatus> {
    const org = await this.getById(id);

    if (!org.afipConfigured) {
      return { configured: false };
    }

    const result = await this.pool.query(
      `SELECT punto_venta, is_homologation, last_auth_success FROM afip_credentials WHERE org_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return { configured: false };
    }

    const row = result.rows[0];
    return {
      configured: true,
      puntoVenta: row.punto_venta,
      isHomologation: row.is_homologation,
      lastAuthSuccess: row.last_auth_success,
    };
  }

  /**
   * Deactivate organization
   */
  async deactivate(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.softDelete(id);
  }

  /**
   * Reactivate organization
   */
  async reactivate(id: string): Promise<Organization> {
    const updated = await this.repo.update(id, { isActive: true } as any);
    if (!updated) {
      throw new OrganizationError('ORG_NOT_FOUND', 'Organization not found', 404);
    }
    return updated;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let service: OrganizationService | null = null;

export function getOrganizationService(pool?: Pool): OrganizationService {
  if (!service && pool) {
    service = new OrganizationService(pool);
  }
  if (!service) {
    throw new Error('OrganizationService not initialized');
  }
  return service;
}
