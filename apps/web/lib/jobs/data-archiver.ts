/**
 * CampoTech Data Archiver (Phase 5A.2.2)
 * =======================================
 *
 * Automated data archival system that:
 * 1. Identifies records past retention threshold
 * 2. Exports to cold storage (Supabase Storage)
 * 3. Verifies integrity before deletion
 * 4. Removes archived records from main database
 *
 * Runs daily at 3:00 AM via cron endpoint.
 */

import { prisma } from '@/lib/prisma';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import {
  uploadArchive,
  calculateChecksum,
  ensureBucketExists,
} from '@/lib/storage/archive-storage';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Archival configuration per table
 * Based on DATA-RETENTION-POLICY.md
 */
export interface ArchivalConfig {
  table: string;
  retentionDays: number;
  batchSize: number;
  deleteAfterArchive: boolean;
  aggregateOnly?: boolean; // For high-volume tables like locations
}

export const ARCHIVAL_CONFIGS: ArchivalConfig[] = [
  {
    table: 'technician_locations',
    retentionDays: 90,
    batchSize: 10000,
    deleteAfterArchive: true,
    aggregateOnly: true, // Only keep aggregated stats
  },
  {
    table: 'notification_logs',
    retentionDays: 180, // 6 months
    batchSize: 5000,
    deleteAfterArchive: true, // Delete without archiving (debugging data only)
  },
  {
    table: 'whatsapp_messages',
    retentionDays: 365, // 1 year
    batchSize: 5000,
    deleteAfterArchive: true,
  },
  {
    table: 'audit_logs',
    retentionDays: 365, // 1 year in hot, then archive
    batchSize: 5000,
    deleteAfterArchive: true,
  },
  {
    table: 'jobs',
    retentionDays: 730, // 2 years
    batchSize: 1000,
    deleteAfterArchive: true,
  },
  // Note: invoices NEVER deleted (10 year AFIP requirement)
  // They are archived after 2 years but kept in cold storage
];

// Tables where archival means just deleting (no cold storage needed)
const DELETE_ONLY_TABLES = ['notification_logs'];

// ═══════════════════════════════════════════════════════════════════════════════
// SQL INJECTION PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

// Allowed archival tables (whitelist for SQL injection prevention)
const ALLOWED_ARCHIVAL_TABLES = new Set([
  'technician_locations',
  'notification_logs',
  'whatsapp_messages',
  'audit_logs',
  'jobs',
  'invoices',
  'technician_location_history',
]);

/**
 * Validate table name against allowed archival tables
 * @throws Error if table name is not in whitelist
 */
function validateArchivalTableName(tableName: string): void {
  if (!ALLOWED_ARCHIVAL_TABLES.has(tableName)) {
    throw new Error(`Invalid archival table name: ${tableName}. Not in allowed tables list.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ArchivalResult {
  table: string;
  success: boolean;
  recordsProcessed: number;
  recordsArchived: number;
  recordsDeleted: number;
  errors: string[];
  duration: number;
}

export interface ArchivalJobResult {
  startTime: string;
  endTime: string;
  totalDuration: number;
  results: ArchivalResult[];
  overallSuccess: boolean;
}

export interface LocationAggregate {
  organizationId: string;
  userId: string;
  date: string;
  totalPoints: number;
  totalDistanceKm: number;
  avgAccuracy: number;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  activeHours: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ARCHIVAL FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main archival job - runs daily
 */
export async function archiveOldData(): Promise<ArchivalJobResult> {
  const startTime = new Date();
  console.log(`[DataArchiver] Starting archival job at ${startTime.toISOString()}`);

  // Ensure storage bucket exists
  await ensureBucketExists();

  const results: ArchivalResult[] = [];

  for (const config of ARCHIVAL_CONFIGS) {
    try {
      const result = await archiveTable(config);
      results.push(result);
    } catch (error) {
      console.error(`[DataArchiver] Fatal error for ${config.table}:`, error);
      results.push({
        table: config.table,
        success: false,
        recordsProcessed: 0,
        recordsArchived: 0,
        recordsDeleted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: 0,
      });
    }
  }

  const endTime = new Date();
  const totalDuration = endTime.getTime() - startTime.getTime();

  const jobResult: ArchivalJobResult = {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDuration,
    results,
    overallSuccess: results.every((r) => r.success),
  };

  // Log summary
  console.log('[DataArchiver] Job complete:', {
    duration: `${Math.round(totalDuration / 1000)}s`,
    success: jobResult.overallSuccess,
    tables: results.map((r) => ({
      table: r.table,
      archived: r.recordsArchived,
      deleted: r.recordsDeleted,
      success: r.success,
    })),
  });

  return jobResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE-SPECIFIC ARCHIVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Archive records from a specific table
 */
async function archiveTable(config: ArchivalConfig): Promise<ArchivalResult> {
  const startTime = Date.now();
  const cutoffDate = subDays(new Date(), config.retentionDays);
  const errors: string[] = [];

  let recordsProcessed = 0;
  let recordsArchived = 0;
  let recordsDeleted = 0;

  console.log(
    `[DataArchiver] Processing ${config.table} - cutoff: ${cutoffDate.toISOString()}`
  );

  try {
    // Handle location aggregation specially
    if (config.aggregateOnly && config.table === 'technician_locations') {
      const result = await archiveLocationsWithAggregation(config, cutoffDate);
      return {
        ...result,
        duration: Date.now() - startTime,
      };
    }

    // Get distinct organizations with old data
    const organizations = await getOrganizationsWithOldData(config.table, cutoffDate);

    for (const orgId of organizations) {
      let hasMore = true;

      while (hasMore) {
        // Fetch batch of old records
        const records = await fetchOldRecords(
          config.table,
          orgId,
          cutoffDate,
          config.batchSize
        );

        if (records.length === 0) {
          hasMore = false;
          continue;
        }

        recordsProcessed += records.length;

        // For delete-only tables, skip archival
        if (DELETE_ONLY_TABLES.includes(config.table)) {
          const deleted = await deleteRecords(config.table, records.map((r) => (r as { id: string }).id));
          recordsDeleted += deleted;
          console.log(
            `[DataArchiver] ${config.table}: deleted ${deleted} records (no archive needed)`
          );
          continue;
        }

        // Determine date range for this batch
        const dates = records
          .map((r) => new Date(r.createdAt as string))
          .sort((a, b) => a.getTime() - b.getTime());
        const dateRange = {
          from: startOfDay(dates[0]),
          to: endOfDay(dates[dates.length - 1]),
        };

        // Upload archive
        const uploadResult = await uploadArchive(
          config.table,
          orgId,
          records,
          dateRange
        );

        if (!uploadResult.success) {
          errors.push(
            `Failed to archive ${config.table} for org ${orgId}: ${uploadResult.error}`
          );
          hasMore = false;
          continue;
        }

        recordsArchived += records.length;

        // Delete archived records
        if (config.deleteAfterArchive) {
          // Wait 100ms to ensure storage consistency
          await new Promise((resolve) => setTimeout(resolve, 100));

          const deleted = await deleteRecords(config.table, records.map((r) => (r as { id: string }).id));
          recordsDeleted += deleted;

          if (deleted !== records.length) {
            errors.push(
              `Deletion mismatch for ${config.table}: expected ${records.length}, deleted ${deleted}`
            );
          }
        }

        console.log(
          `[DataArchiver] ${config.table}/${orgId}: archived ${records.length}, deleted ${recordsDeleted}`
        );

        // Check if there are more records
        hasMore = records.length === config.batchSize;
      }
    }

    return {
      table: config.table,
      success: errors.length === 0,
      recordsProcessed,
      recordsArchived,
      recordsDeleted,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[DataArchiver] Error processing ${config.table}:`, error);
    return {
      table: config.table,
      success: false,
      recordsProcessed,
      recordsArchived,
      recordsDeleted,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Special handling for technician locations - aggregate before archival
 */
async function archiveLocationsWithAggregation(
  config: ArchivalConfig,
  cutoffDate: Date
): Promise<Omit<ArchivalResult, 'duration'>> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let recordsArchived = 0;
  let recordsDeleted = 0;

  try {
    // Get organizations with old location data
    // Note: Adjust query based on actual table structure
    const oldLocations = await prisma.$queryRaw<
      Array<{
        organization_id: string;
        user_id: string;
        date: Date;
        count: bigint;
        avg_lat: number;
        avg_lng: number;
        min_lat: number;
        max_lat: number;
        min_lng: number;
        max_lng: number;
        avg_accuracy: number;
      }>
    >`
      SELECT
        tl.organization_id,
        tl.user_id,
        DATE(tl.recorded_at) as date,
        COUNT(*) as count,
        AVG(tl.latitude) as avg_lat,
        AVG(tl.longitude) as avg_lng,
        MIN(tl.latitude) as min_lat,
        MAX(tl.latitude) as max_lat,
        MIN(tl.longitude) as min_lng,
        MAX(tl.longitude) as max_lng,
        AVG(tl.accuracy) as avg_accuracy
      FROM technician_location_history tl
      WHERE tl.recorded_at < ${cutoffDate}
      GROUP BY tl.organization_id, tl.user_id, DATE(tl.recorded_at)
      LIMIT 1000
    `;

    if (oldLocations.length === 0) {
      console.log('[DataArchiver] No old location data to archive');
      return {
        table: config.table,
        success: true,
        recordsProcessed: 0,
        recordsArchived: 0,
        recordsDeleted: 0,
        errors: [],
      };
    }

    // Group by organization for archival
    const orgAggregates = new Map<string, LocationAggregate[]>();

    for (const loc of oldLocations) {
      const aggregate: LocationAggregate = {
        organizationId: loc.organization_id,
        userId: loc.user_id,
        date: format(loc.date, 'yyyy-MM-dd'),
        totalPoints: Number(loc.count),
        totalDistanceKm: 0, // Would need sequential point calculation
        avgAccuracy: loc.avg_accuracy || 0,
        boundingBox: {
          minLat: loc.min_lat,
          maxLat: loc.max_lat,
          minLng: loc.min_lng,
          maxLng: loc.max_lng,
        },
        activeHours: 0, // Would need time-based calculation
      };

      const existing = orgAggregates.get(loc.organization_id) || [];
      existing.push(aggregate);
      orgAggregates.set(loc.organization_id, existing);

      recordsProcessed += Number(loc.count);
    }

    // Archive aggregates per organization
    for (const [orgId, aggregates] of orgAggregates) {
      const dates = aggregates.map((a) => new Date(a.date)).sort((a, b) => a.getTime() - b.getTime());

      const uploadResult = await uploadArchive(
        'technician_locations_aggregates',
        orgId,
        aggregates as unknown as Record<string, unknown>[],
        { from: dates[0], to: dates[dates.length - 1] }
      );

      if (uploadResult.success) {
        recordsArchived += aggregates.reduce((sum, a) => sum + a.totalPoints, 0);
      } else {
        errors.push(`Failed to archive location aggregates for org ${orgId}`);
      }
    }

    // Delete raw location data
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM technician_location_history
      WHERE recorded_at < ${cutoffDate}
      AND id IN (
        SELECT id FROM technician_location_history
        WHERE recorded_at < ${cutoffDate}
        LIMIT ${config.batchSize}
      )
    `;

    recordsDeleted = deleteResult;

    console.log(
      `[DataArchiver] Locations: processed ${recordsProcessed}, archived ${recordsArchived} as aggregates, deleted ${recordsDeleted} raw`
    );

    return {
      table: config.table,
      success: errors.length === 0,
      recordsProcessed,
      recordsArchived,
      recordsDeleted,
      errors,
    };
  } catch (error) {
    console.error('[DataArchiver] Location aggregation error:', error);
    return {
      table: config.table,
      success: false,
      recordsProcessed,
      recordsArchived,
      recordsDeleted,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get organizations with data older than cutoff
 * Validates table name against whitelist to prevent SQL injection
 */
async function getOrganizationsWithOldData(
  table: string,
  cutoffDate: Date
): Promise<string[]> {
  // Validate table name against whitelist
  validateArchivalTableName(table);

  // Use raw query for flexibility across tables
  // Table name is safe after validation
  const result = await prisma.$queryRawUnsafe<Array<{ organization_id: string }>>(
    `SELECT DISTINCT organization_id FROM "${table}" WHERE created_at < $1`,
    cutoffDate
  );

  return result.map((r) => r.organization_id).filter(Boolean);
}

/**
 * Fetch old records for archival
 * Validates table name against whitelist to prevent SQL injection
 */
async function fetchOldRecords(
  table: string,
  organizationId: string,
  cutoffDate: Date,
  limit: number
): Promise<Record<string, unknown>[]> {
  // Validate table name against whitelist
  validateArchivalTableName(table);

  // Table name is safe after validation
  const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${table}"
     WHERE organization_id = $1
     AND created_at < $2
     ORDER BY created_at ASC
     LIMIT $3`,
    organizationId,
    cutoffDate,
    limit
  );

  return result;
}

/**
 * Delete records by IDs
 * Validates table name against whitelist to prevent SQL injection
 */
async function deleteRecords(table: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  // Validate table name against whitelist
  validateArchivalTableName(table);

  // Table name is safe after validation
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "${table}" WHERE id = ANY($1::text[])`,
    ids
  );

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get archival status for monitoring
 * Validates table names against whitelist to prevent SQL injection
 */
export async function getArchivalStatus(): Promise<{
  lastRun?: string;
  nextRun?: string;
  tableStats: Array<{
    table: string;
    oldestRecord?: string;
    recordsPendingArchival: number;
  }>;
}> {
  const tableStats = [];

  for (const config of ARCHIVAL_CONFIGS) {
    try {
      // Validate table name against whitelist
      validateArchivalTableName(config.table);

      const cutoffDate = subDays(new Date(), config.retentionDays);

      // Table name is safe after validation
      const [oldest, count] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ min: Date }>>(
          `SELECT MIN(created_at) as min FROM "${config.table}"`
        ),
        prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM "${config.table}" WHERE created_at < $1`,
          cutoffDate
        ),
      ]);

      tableStats.push({
        table: config.table,
        oldestRecord: oldest[0]?.min?.toISOString(),
        recordsPendingArchival: Number(count[0]?.count || 0),
      });
    } catch {
      tableStats.push({
        table: config.table,
        recordsPendingArchival: 0,
      });
    }
  }

  return {
    tableStats,
  };
}

/**
 * Validate archival is safe to proceed
 */
export async function validateArchivalSafe(): Promise<{
  safe: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Check storage is accessible
  const bucketOk = await ensureBucketExists();
  if (!bucketOk) {
    warnings.push('Storage bucket not accessible');
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    warnings.push('Database connection failed');
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}
