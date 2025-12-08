/**
 * Capability Override Repository
 * ===============================
 *
 * Database adapter implementation for capability overrides.
 * Implements the CapabilityDatabaseAdapter interface.
 *
 * This implementation uses raw SQL queries compatible with Supabase/PostgreSQL.
 * Adapt the query methods to your ORM (Prisma, Drizzle, etc.) as needed.
 */

import type {
  CapabilityDatabaseAdapter,
  CapabilityOverride,
  CapabilityOverrideInput,
  CapabilityPath,
} from '../config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CLIENT TYPE
// Replace with your actual database client type
// ═══════════════════════════════════════════════════════════════════════════════

interface DatabaseClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY OVERRIDE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class CapabilityOverrideRepository implements CapabilityDatabaseAdapter {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Get all active (non-expired) overrides
   */
  async getAllActiveOverrides(): Promise<CapabilityOverride[]> {
    const result = await this.db.query<CapabilityOverride>(`
      SELECT
        id,
        org_id,
        capability_path,
        enabled,
        reason,
        disabled_by,
        expires_at,
        created_at,
        updated_at
      FROM capability_overrides
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY
        org_id NULLS LAST,  -- Global overrides first
        capability_path
    `);

    return result.rows;
  }

  /**
   * Get overrides for a specific organization (including global overrides)
   */
  async getOverridesForOrg(orgId: string): Promise<CapabilityOverride[]> {
    const result = await this.db.query<CapabilityOverride>(`
      SELECT
        id,
        org_id,
        capability_path,
        enabled,
        reason,
        disabled_by,
        expires_at,
        created_at,
        updated_at
      FROM capability_overrides
      WHERE (org_id = $1 OR org_id IS NULL)
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY
        org_id NULLS LAST,  -- Per-org overrides first (higher priority)
        capability_path
    `, [orgId]);

    return result.rows;
  }

  /**
   * Create or update an override
   */
  async upsertOverride(
    input: CapabilityOverrideInput,
    userId?: string
  ): Promise<CapabilityOverride> {
    const result = await this.db.query<CapabilityOverride>(`
      INSERT INTO capability_overrides (
        org_id,
        capability_path,
        enabled,
        reason,
        disabled_by,
        expires_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      ON CONFLICT (org_id, capability_path)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        reason = EXCLUDED.reason,
        disabled_by = EXCLUDED.disabled_by,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
      RETURNING
        id,
        org_id,
        capability_path,
        enabled,
        reason,
        disabled_by,
        expires_at,
        created_at,
        updated_at
    `, [
      input.org_id ?? null,
      input.capability_path,
      input.enabled,
      input.reason ?? null,
      userId ?? null,
      input.expires_at ?? null,
    ]);

    return result.rows[0];
  }

  /**
   * Delete an override
   */
  async deleteOverride(path: CapabilityPath, orgId?: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(`
      DELETE FROM capability_overrides
      WHERE capability_path = $1
        AND ${orgId ? 'org_id = $2' : 'org_id IS NULL'}
      RETURNING id
    `, orgId ? [path, orgId] : [path]);

    return result.rows.length > 0;
  }

  /**
   * Clean up expired overrides (call periodically via cron job)
   */
  async cleanupExpiredOverrides(): Promise<number> {
    const result = await this.db.query<{ id: string }>(`
      DELETE FROM capability_overrides
      WHERE expires_at IS NOT NULL AND expires_at <= NOW()
      RETURNING id
    `);

    return result.rows.length;
  }

  /**
   * Get override history for audit purposes
   * Note: Requires audit_log table to be configured
   */
  async getOverrideHistory(
    path: CapabilityPath,
    orgId?: string,
    limit = 50
  ): Promise<Array<{
    action: string;
    old_value: unknown;
    new_value: unknown;
    changed_by: string | null;
    changed_at: Date;
  }>> {
    // This assumes you have an audit_log table that captures changes
    const result = await this.db.query<{
      action: string;
      old_value: unknown;
      new_value: unknown;
      changed_by: string | null;
      changed_at: Date;
    }>(`
      SELECT
        action,
        old_value,
        new_value,
        changed_by,
        changed_at
      FROM audit_log
      WHERE table_name = 'capability_overrides'
        AND record_data->>'capability_path' = $1
        AND ($2::uuid IS NULL OR record_data->>'org_id' = $2::text OR record_data->>'org_id' IS NULL)
      ORDER BY changed_at DESC
      LIMIT $3
    `, [path, orgId ?? null, limit]);

    return result.rows;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRISMA ADAPTER (Alternative implementation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prisma-based adapter for capability overrides
 * Uncomment and adapt if using Prisma
 */
/*
import { PrismaClient } from '@prisma/client';

export class PrismaCapabilityOverrideRepository implements CapabilityDatabaseAdapter {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAllActiveOverrides(): Promise<CapabilityOverride[]> {
    return this.prisma.capabilityOverride.findMany({
      where: {
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
      orderBy: [
        { org_id: 'asc' },
        { capability_path: 'asc' },
      ],
    });
  }

  async getOverridesForOrg(orgId: string): Promise<CapabilityOverride[]> {
    return this.prisma.capabilityOverride.findMany({
      where: {
        AND: [
          {
            OR: [
              { org_id: orgId },
              { org_id: null },
            ],
          },
          {
            OR: [
              { expires_at: null },
              { expires_at: { gt: new Date() } },
            ],
          },
        ],
      },
      orderBy: [
        { org_id: 'desc' }, // Per-org first (not null)
        { capability_path: 'asc' },
      ],
    });
  }

  async upsertOverride(
    input: CapabilityOverrideInput,
    userId?: string
  ): Promise<CapabilityOverride> {
    return this.prisma.capabilityOverride.upsert({
      where: {
        org_id_capability_path: {
          org_id: input.org_id ?? null,
          capability_path: input.capability_path,
        },
      },
      update: {
        enabled: input.enabled,
        reason: input.reason ?? null,
        disabled_by: userId ?? null,
        expires_at: input.expires_at ?? null,
      },
      create: {
        org_id: input.org_id ?? null,
        capability_path: input.capability_path,
        enabled: input.enabled,
        reason: input.reason ?? null,
        disabled_by: userId ?? null,
        expires_at: input.expires_at ?? null,
      },
    });
  }

  async deleteOverride(path: CapabilityPath, orgId?: string): Promise<boolean> {
    try {
      await this.prisma.capabilityOverride.delete({
        where: {
          org_id_capability_path: {
            org_id: orgId ?? null,
            capability_path: path,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default CapabilityOverrideRepository;
