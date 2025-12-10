/**
 * Customer Portal Auth Database Adapters
 * =======================================
 *
 * PostgreSQL implementations of the auth database interfaces.
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import {
  MagicLink,
  CustomerOTP,
  CustomerSession,
  ImpersonationSession,
  AuthenticatedCustomer,
  CreateCustomerFromAuth,
  MagicLinkDatabaseAdapter,
  CustomerOTPDatabaseAdapter,
  CustomerSessionDatabaseAdapter,
  ImpersonationDatabaseAdapter,
  CustomerAuthRepository,
} from '../customer-auth.types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function objectToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

function objectToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAGIC LINK ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

export class PostgresMagicLinkAdapter implements MagicLinkDatabaseAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createMagicLink(link: Omit<MagicLink, 'id' | 'createdAt'>): Promise<MagicLink> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO customer_magic_links
       (id, org_id, customer_id, email, token_hash, used, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        link.orgId,
        link.customerId || null,
        link.email,
        link.tokenHash,
        link.used,
        link.expiresAt,
        link.metadata ? JSON.stringify(link.metadata) : null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_magic_links WHERE token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markMagicLinkUsed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_magic_links SET used = true, used_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async cleanupExpiredMagicLinks(): Promise<void> {
    await this.pool.query(
      `DELETE FROM customer_magic_links WHERE expires_at < NOW()`
    );
  }

  async countRecentMagicLinks(email: string, windowMinutes: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM customer_magic_links
       WHERE email = $1 AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
      [email]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): MagicLink {
    return {
      id: row.id,
      orgId: row.org_id,
      customerId: row.customer_id,
      email: row.email,
      tokenHash: row.token_hash,
      used: row.used,
      usedAt: row.used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      metadata: row.metadata,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER OTP ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

export class PostgresCustomerOTPAdapter implements CustomerOTPDatabaseAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createOTP(otp: Omit<CustomerOTP, 'id' | 'createdAt'>): Promise<CustomerOTP> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO customer_otp_codes
       (id, org_id, customer_id, phone, code_hash, attempts, verified, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        otp.orgId,
        otp.customerId || null,
        otp.phone,
        otp.codeHash,
        otp.attempts,
        otp.verified,
        otp.expiresAt,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async getLatestOTP(orgId: string, phone: string): Promise<CustomerOTP | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_otp_codes
       WHERE org_id = $1 AND phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, phone]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_otp_codes SET attempts = attempts + 1 WHERE id = $1`,
      [id]
    );
  }

  async markVerified(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_otp_codes SET verified = true, verified_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async cleanupExpiredOTPs(): Promise<void> {
    await this.pool.query(
      `DELETE FROM customer_otp_codes WHERE expires_at < NOW()`
    );
  }

  async countRecentOTPs(phone: string, windowMinutes: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM customer_otp_codes
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
      [phone]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): CustomerOTP {
    return {
      id: row.id,
      orgId: row.org_id,
      customerId: row.customer_id,
      phone: row.phone,
      codeHash: row.code_hash,
      attempts: row.attempts,
      verified: row.verified,
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER SESSION ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

export class PostgresCustomerSessionAdapter implements CustomerSessionDatabaseAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createSession(session: Omit<CustomerSession, 'id' | 'createdAt'>): Promise<CustomerSession> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO customer_sessions
       (id, customer_id, org_id, device_info, ip_address, user_agent,
        refresh_token_hash, is_active, last_used_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        session.customerId,
        session.orgId,
        session.deviceInfo ? JSON.stringify(session.deviceInfo) : null,
        session.ipAddress,
        session.userAgent,
        session.refreshTokenHash,
        session.isActive,
        session.lastUsedAt,
        session.expiresAt,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async getSessionById(id: string): Promise<CustomerSession | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_sessions WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getSessionByRefreshTokenHash(hash: string): Promise<CustomerSession | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_sessions WHERE refresh_token_hash = $1`,
      [hash]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateSessionLastUsed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_sessions SET last_used_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async revokeSession(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_sessions
       SET is_active = false, revoked_at = NOW(), revocation_reason = $2
       WHERE id = $1`,
      [id, reason]
    );
  }

  async revokeAllCustomerSessions(customerId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_sessions
       SET is_active = false, revoked_at = NOW(), revocation_reason = $2
       WHERE customer_id = $1 AND is_active = true`,
      [customerId, reason]
    );
  }

  async getActiveSessionsForCustomer(customerId: string): Promise<CustomerSession[]> {
    const result = await this.pool.query(
      `SELECT * FROM customer_sessions
       WHERE customer_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY last_used_at DESC`,
      [customerId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.pool.query(
      `DELETE FROM customer_sessions WHERE expires_at < NOW()`
    );
  }

  private mapRow(row: any): CustomerSession {
    return {
      id: row.id,
      customerId: row.customer_id,
      orgId: row.org_id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      refreshTokenHash: row.refresh_token_hash,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPERSONATION ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

export class PostgresImpersonationAdapter implements ImpersonationDatabaseAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createImpersonationSession(
    session: Omit<ImpersonationSession, 'id'>
  ): Promise<ImpersonationSession> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO customer_impersonation_sessions
       (id, support_user_id, customer_id, org_id, reason, started_at, expires_at, actions_performed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        session.supportUserId,
        session.customerId,
        session.orgId,
        session.reason,
        session.startedAt,
        session.expiresAt,
        JSON.stringify(session.actionsPerformed),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async getActiveImpersonationSession(supportUserId: string): Promise<ImpersonationSession | null> {
    const result = await this.pool.query(
      `SELECT * FROM customer_impersonation_sessions
       WHERE support_user_id = $1 AND ended_at IS NULL AND expires_at > NOW()
       ORDER BY started_at DESC
       LIMIT 1`,
      [supportUserId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async endImpersonationSession(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_impersonation_sessions SET ended_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async logImpersonationAction(sessionId: string, action: string): Promise<void> {
    await this.pool.query(
      `UPDATE customer_impersonation_sessions
       SET actions_performed = actions_performed || $2::jsonb
       WHERE id = $1`,
      [sessionId, JSON.stringify([action])]
    );
  }

  private mapRow(row: any): ImpersonationSession {
    return {
      id: row.id,
      supportUserId: row.support_user_id,
      customerId: row.customer_id,
      orgId: row.org_id,
      reason: row.reason,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      endedAt: row.ended_at,
      actionsPerformed: row.actions_performed || [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER AUTH REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class PostgresCustomerAuthRepository implements CustomerAuthRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getCustomerById(orgId: string, id: string): Promise<AuthenticatedCustomer | null> {
    const result = await this.pool.query(
      `SELECT id, org_id, full_name, phone, email
       FROM customers
       WHERE id = $1 AND org_id = $2 AND is_active = true`,
      [id, orgId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getCustomerByEmail(orgId: string, email: string): Promise<AuthenticatedCustomer | null> {
    const result = await this.pool.query(
      `SELECT id, org_id, full_name, phone, email
       FROM customers
       WHERE LOWER(email) = LOWER($1) AND org_id = $2 AND is_active = true`,
      [email, orgId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getCustomerByPhone(orgId: string, phone: string): Promise<AuthenticatedCustomer | null> {
    // Normalize phone for lookup
    const normalizedPhone = this.normalizePhone(phone);
    const result = await this.pool.query(
      `SELECT id, org_id, full_name, phone, email
       FROM customers
       WHERE phone = $1 AND org_id = $2 AND is_active = true`,
      [normalizedPhone, orgId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async createCustomer(orgId: string, data: CreateCustomerFromAuth): Promise<AuthenticatedCustomer> {
    const id = crypto.randomUUID();
    const fullName = data.fullName || data.email?.split('@')[0] || 'Customer';
    const phone = data.phone ? this.normalizePhone(data.phone) : null;

    const result = await this.pool.query(
      `INSERT INTO customers
       (id, org_id, full_name, phone, email, iva_condition, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'consumidor_final', true, NOW(), NOW())
       RETURNING id, org_id, full_name, phone, email`,
      [id, orgId, fullName, phone, data.email?.toLowerCase()]
    );
    return this.mapRow(result.rows[0]);
  }

  async updateCustomerEmail(customerId: string, email: string): Promise<void> {
    await this.pool.query(
      `UPDATE customers SET email = LOWER($2), updated_at = NOW() WHERE id = $1`,
      [customerId, email]
    );
  }

  async updateCustomerPhone(customerId: string, phone: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);
    await this.pool.query(
      `UPDATE customers SET phone = $2, updated_at = NOW() WHERE id = $1`,
      [customerId, normalizedPhone]
    );
  }

  async updateLastLoginAt(customerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE customers SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [customerId]
    );
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('54')) {
      // Already has country code
    } else if (cleaned.startsWith('9')) {
      cleaned = '54' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '549' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('15')) {
      cleaned = '549' + cleaned.slice(2);
    }
    return '+' + cleaned;
  }

  private mapRow(row: any): AuthenticatedCustomer {
    return {
      id: row.id,
      orgId: row.org_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function createMagicLinkAdapter(pool: Pool): MagicLinkDatabaseAdapter {
  return new PostgresMagicLinkAdapter(pool);
}

export function createCustomerOTPAdapter(pool: Pool): CustomerOTPDatabaseAdapter {
  return new PostgresCustomerOTPAdapter(pool);
}

export function createCustomerSessionAdapter(pool: Pool): CustomerSessionDatabaseAdapter {
  return new PostgresCustomerSessionAdapter(pool);
}

export function createImpersonationAdapter(pool: Pool): ImpersonationDatabaseAdapter {
  return new PostgresImpersonationAdapter(pool);
}

export function createCustomerAuthRepository(pool: Pool): CustomerAuthRepository {
  return new PostgresCustomerAuthRepository(pool);
}
