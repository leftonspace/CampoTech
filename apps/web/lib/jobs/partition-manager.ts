/**
 * CampoTech Partition Manager (Phase 5A.1.5)
 * ==========================================
 *
 * Automatically manages PostgreSQL table partitions.
 * - Creates future partitions ahead of time
 * - Alerts if partitions are missing
 * - Tracks partition health metrics
 *
 * Schedule: Weekly (Sunday at 2am Argentina time)
 * Endpoint: /api/cron/manage-partitions
 */

import { prisma } from '@/lib/prisma';
import {
  addDays,
  addWeeks,
  addMonths,
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  differenceInDays,
} from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export type PartitionInterval = 'day' | 'week' | 'month';

export interface PartitionedTableConfig {
  /** Base table name (without partitions) */
  tableName: string;
  /** Partition interval */
  interval: PartitionInterval;
  /** How many intervals ahead to create partitions */
  aheadCount: number;
  /** Partition naming pattern */
  partitionPrefix: string;
  /** Column used for partitioning */
  partitionColumn: string;
}

export interface PartitionInfo {
  partitionName: string;
  startDate: Date;
  endDate: Date;
  exists: boolean;
  sizeBytes?: number;
  rowCount?: number;
}

export interface PartitionManagerResult {
  success: boolean;
  tablesProcessed: number;
  partitionsCreated: number;
  partitionsMissing: number;
  errors: string[];
  details: {
    tableName: string;
    created: string[];
    missing: string[];
    existing: number;
  }[];
}

// Table configurations
const PARTITIONED_TABLES: PartitionedTableConfig[] = [
  {
    tableName: 'jobs_partitioned',
    interval: 'month',
    aheadCount: 3, // 3 months ahead
    partitionPrefix: 'jobs_y',
    partitionColumn: 'createdAt',
  },
  {
    tableName: 'wa_messages_partitioned',
    interval: 'week',
    aheadCount: 12, // 12 weeks ahead
    partitionPrefix: 'wa_msgs_',
    partitionColumn: 'createdAt',
  },
  {
    tableName: 'tech_location_history_partitioned',
    interval: 'day',
    aheadCount: 90, // 90 days ahead
    partitionPrefix: 'tech_loc_',
    partitionColumn: 'recordedAt',
  },
  {
    tableName: 'audit_logs_partitioned',
    interval: 'month',
    aheadCount: 3, // 3 months ahead
    partitionPrefix: 'audit_logs_y',
    partitionColumn: 'createdAt',
  },
  {
    tableName: 'notification_logs_partitioned',
    interval: 'week',
    aheadCount: 12, // 12 weeks ahead
    partitionPrefix: 'notif_logs_',
    partitionColumn: 'createdAt',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PARTITION NAME GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate partition name for a given date and interval
 */
function generatePartitionName(
  prefix: string,
  date: Date,
  interval: PartitionInterval
): string {
  switch (interval) {
    case 'day':
      return `${prefix}${format(date, 'yyyyMMdd')}`;
    case 'week':
      const weekNumber = getISOWeek(date);
      return `${prefix}${format(date, 'yyyy')}w${String(weekNumber).padStart(2, '0')}`;
    case 'month':
      return `${prefix}${format(date, 'yyyy')}m${format(date, 'MM')}`;
  }
}

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get start of interval for a date
 */
function getIntervalStart(date: Date, interval: PartitionInterval): Date {
  switch (interval) {
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfWeek(date, { weekStartsOn: 1 }); // Monday
    case 'month':
      return startOfMonth(date);
  }
}

/**
 * Get end of interval for a date (exclusive)
 */
function getIntervalEnd(date: Date, interval: PartitionInterval): Date {
  switch (interval) {
    case 'day':
      return addDays(startOfDay(date), 1);
    case 'week':
      return addWeeks(startOfWeek(date, { weekStartsOn: 1 }), 1);
    case 'month':
      return addMonths(startOfMonth(date), 1);
  }
}

/**
 * Advance date by one interval
 */
function advanceByInterval(date: Date, interval: PartitionInterval): Date {
  switch (interval) {
    case 'day':
      return addDays(date, 1);
    case 'week':
      return addWeeks(date, 1);
    case 'month':
      return addMonths(date, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTITION MANAGEMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of existing partitions for a table
 */
async function getExistingPartitions(tableName: string): Promise<Set<string>> {
  try {
    const result = await prisma.$queryRaw<{ partition_name: string }[]>`
      SELECT inhrelid::regclass::text AS partition_name
      FROM pg_inherits
      WHERE inhparent = ${tableName}::regclass
    `;

    return new Set(result.map((r) => r.partition_name));
  } catch (error) {
    // Table might not exist yet or not be partitioned
    console.warn(`Could not get partitions for ${tableName}:`, error);
    return new Set();
  }
}

/**
 * Check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE tablename = ${tableName}
      ) as exists
    `;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

/**
 * Create a single partition
 */
async function createPartition(
  tableName: string,
  partitionName: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionName}
      PARTITION OF ${tableName}
      FOR VALUES FROM ('${startStr}') TO ('${endStr}')
    `);
    return true;
  } catch (error) {
    console.error(`Failed to create partition ${partitionName}:`, error);
    return false;
  }
}

/**
 * Ensure all required partitions exist for a table
 */
async function ensurePartitionsForTable(
  config: PartitionedTableConfig
): Promise<{
  created: string[];
  missing: string[];
  existing: number;
  errors: string[];
}> {
  const result = {
    created: [] as string[],
    missing: [] as string[],
    existing: 0,
    errors: [] as string[],
  };

  // Check if base table exists
  const baseTableExists = await tableExists(config.tableName);
  if (!baseTableExists) {
    result.errors.push(`Base table ${config.tableName} does not exist`);
    return result;
  }

  // Get existing partitions
  const existingPartitions = await getExistingPartitions(config.tableName);
  result.existing = existingPartitions.size;

  // Generate required partitions
  const now = new Date();
  let currentDate = getIntervalStart(now, config.interval);

  for (let i = 0; i < config.aheadCount; i++) {
    const partitionName = generatePartitionName(
      config.partitionPrefix,
      currentDate,
      config.interval
    );
    const startDate = currentDate;
    const endDate = getIntervalEnd(currentDate, config.interval);

    if (!existingPartitions.has(partitionName)) {
      // Try to create the partition
      const created = await createPartition(
        config.tableName,
        partitionName,
        startDate,
        endDate
      );

      if (created) {
        result.created.push(partitionName);
      } else {
        result.missing.push(partitionName);
      }
    }

    currentDate = advanceByInterval(currentDate, config.interval);
  }

  return result;
}

/**
 * Get partition statistics for monitoring
 */
async function getPartitionStats(
  tableName: string
): Promise<{ name: string; size: string; rows: number }[]> {
  try {
    const result = await prisma.$queryRaw<
      { partition_name: string; size: string; row_count: number }[]
    >`
      SELECT
        inhrelid::regclass::text AS partition_name,
        pg_size_pretty(pg_relation_size(inhrelid)) AS size,
        (SELECT reltuples::bigint FROM pg_class WHERE oid = inhrelid) AS row_count
      FROM pg_inherits
      WHERE inhparent = ${tableName}::regclass
      ORDER BY inhrelid::regclass::text
    `;

    return result.map((r) => ({
      name: r.partition_name,
      size: r.size,
      rows: Number(r.row_count) || 0,
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MANAGEMENT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main function to manage all partitioned tables
 * Should be called by cron job weekly
 */
export async function managePartitions(): Promise<PartitionManagerResult> {
  const result: PartitionManagerResult = {
    success: true,
    tablesProcessed: 0,
    partitionsCreated: 0,
    partitionsMissing: 0,
    errors: [],
    details: [],
  };

  console.log('[PartitionManager] Starting partition management...');
  const startTime = Date.now();

  for (const config of PARTITIONED_TABLES) {
    console.log(`[PartitionManager] Processing ${config.tableName}...`);

    try {
      const tableResult = await ensurePartitionsForTable(config);

      result.tablesProcessed++;
      result.partitionsCreated += tableResult.created.length;
      result.partitionsMissing += tableResult.missing.length;
      result.errors.push(...tableResult.errors);

      result.details.push({
        tableName: config.tableName,
        created: tableResult.created,
        missing: tableResult.missing,
        existing: tableResult.existing,
      });

      if (tableResult.created.length > 0) {
        console.log(
          `[PartitionManager] ${config.tableName}: Created ${tableResult.created.length} partitions`
        );
      }

      if (tableResult.missing.length > 0) {
        console.warn(
          `[PartitionManager] ${config.tableName}: ${tableResult.missing.length} partitions could not be created`
        );
      }
    } catch (error) {
      const errorMsg = `Failed to process ${config.tableName}: ${error}`;
      console.error(`[PartitionManager] ${errorMsg}`);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[PartitionManager] Completed in ${duration}ms. ` +
      `Tables: ${result.tablesProcessed}, ` +
      `Created: ${result.partitionsCreated}, ` +
      `Missing: ${result.partitionsMissing}, ` +
      `Errors: ${result.errors.length}`
  );

  // Mark as failed if there are critical issues
  if (result.partitionsMissing > 0 || result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * Check partition health and return warnings
 */
export async function checkPartitionHealth(): Promise<{
  healthy: boolean;
  warnings: string[];
  stats: Record<string, { name: string; size: string; rows: number }[]>;
}> {
  const warnings: string[] = [];
  const stats: Record<string, { name: string; size: string; rows: number }[]> = {};

  const now = new Date();

  for (const config of PARTITIONED_TABLES) {
    // Get partition stats
    const tableStats = await getPartitionStats(config.tableName);
    stats[config.tableName] = tableStats;

    // Check if partitions exist for upcoming period
    const existingPartitions = await getExistingPartitions(config.tableName);

    // Check next 7 days/periods
    let checkDate = getIntervalStart(now, config.interval);
    const checkCount = config.interval === 'day' ? 7 : 4;

    for (let i = 0; i < checkCount; i++) {
      const partitionName = generatePartitionName(
        config.partitionPrefix,
        checkDate,
        config.interval
      );

      if (!existingPartitions.has(partitionName)) {
        const daysUntil = differenceInDays(checkDate, now);
        const severity = daysUntil <= 3 ? 'CRITICAL' : 'WARNING';
        warnings.push(
          `[${severity}] ${config.tableName}: Missing partition ${partitionName} ` +
            `(needed in ${daysUntil} days)`
        );
      }

      checkDate = advanceByInterval(checkDate, config.interval);
    }

    // Check for oversized partitions (> 10GB warning)
    for (const stat of tableStats) {
      const sizeStr = stat.size.toLowerCase();
      if (sizeStr.includes('gb')) {
        const sizeGb = parseFloat(sizeStr);
        if (sizeGb > 10) {
          warnings.push(
            `[WARNING] ${stat.name}: Partition size ${stat.size} exceeds 10GB threshold`
          );
        }
      }
    }
  }

  return {
    healthy: warnings.filter((w) => w.includes('CRITICAL')).length === 0,
    warnings,
    stats,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { PARTITIONED_TABLES, getExistingPartitions, getPartitionStats };
