/**
 * CampoTech Audit Log Encryption Service
 * ========================================
 *
 * Handles encryption/decryption of sensitive audit log values.
 * Uses AES-256-GCM for field-level encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_KEY_ENV = 'AUDIT_ENCRYPTION_KEY';

// Sensitive fields that require encryption in audit logs
export const SENSITIVE_FIELDS = [
  'remuneracion',
  'cbu',
  'cbuEmpleado',
  'afipCertificate',
  'afipPrivateKey',
  'mpAccessToken',
  'costPrice',
  'password',
  'passwordHash',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EncryptedValue {
  encrypted: true;
  iv: string; // Base64
  data: string; // Base64
  authTag: string; // Base64
}

interface DecryptedValue {
  encrypted: false;
  value: unknown;
}

type EncryptableValue = string | number | boolean | null | undefined | Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════════
// KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env[ENCRYPTION_KEY_ENV];

  if (!keyString) {
    // In development, use a derived key (NOT secure for production)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using derived key for audit encryption. Set AUDIT_ENCRYPTION_KEY in production.');
      const derivedKey = createHash('sha256')
        .update('campotech-dev-key')
        .digest();
      return derivedKey;
    }
    throw new Error(`${ENCRYPTION_KEY_ENV} environment variable not set`);
  }

  // Key should be 32 bytes (64 hex chars) or 44 chars (base64)
  if (keyString.length === 64) {
    // Hex format
    return Buffer.from(keyString, 'hex');
  } else if (keyString.length === 44) {
    // Base64 format
    return Buffer.from(keyString, 'base64');
  } else {
    // Hash the provided key to get 32 bytes
    return createHash('sha256').update(keyString).digest();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION/DECRYPTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypt a value for audit log storage
 */
export function encryptValue(value: EncryptableValue): EncryptedValue {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(value);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encrypted: true,
    iv: iv.toString('base64'),
    data: encrypted,
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt a value from audit log storage
 */
export function decryptValue(encrypted: EncryptedValue): unknown {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return '[DECRYPTION_FAILED]';
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: unknown): value is EncryptedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'encrypted' in value &&
    (value as EncryptedValue).encrypted === true &&
    'iv' in value &&
    'data' in value &&
    'authTag' in value
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a field should be encrypted
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELDS.includes(fieldName);
}

/**
 * Encrypt sensitive fields in an object
 */
export function encryptSensitiveFields(
  data: Record<string, unknown>,
  fieldsToCheck?: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const fields = fieldsToCheck || Object.keys(data);

  for (const key of fields) {
    if (!(key in data)) continue;

    const value = data[key];

    if (isSensitiveField(key) && value !== null && value !== undefined) {
      result[key] = encryptValue(value as EncryptableValue);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Decrypt sensitive fields in an object (for OWNER viewing)
 */
export function decryptSensitiveFields(
  data: Record<string, unknown>,
  userRole: string
): Record<string, unknown> {
  // Only OWNER can see decrypted sensitive data
  if (userRole !== 'OWNER') {
    return maskSensitiveFields(data);
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isEncrypted(value)) {
      result[key] = decryptValue(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Mask sensitive fields for non-OWNER users
 */
export function maskSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key) || isEncrypted(value)) {
      result[key] = '[DATO SENSIBLE]';
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG RETENTION
// ═══════════════════════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma';

/**
 * Audit log retention configuration
 */
export const RETENTION_POLICY = {
  auditLogs: {
    standardRetentionYears: 5,
    deleteAfter: true,
  },
  fiscalRecords: {
    retentionYears: 10,
    archiveAfter: true,
    neverDelete: true,
  },
  employmentRecords: {
    retentionYearsAfterTermination: 10,
    anonymizeAfter: true,
  },
  deletedUserData: {
    deleteAfterDays: 30, // 30-day waiting period
  },
};

/**
 * Archive old audit logs to cold storage
 */
export async function archiveOldAuditLogs(orgId: string, olderThanYears: number = 5): Promise<{
  archived: number;
  archivePath: string | null;
}> {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - olderThanYears);

  const period = cutoffDate.toISOString().substring(0, 7); // YYYY-MM

  try {
    // Count records to archive
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE org_id = ${orgId}::uuid
      AND created_at < ${cutoffDate}
    `;

    const recordCount = Number(countResult[0]?.count ?? 0);

    if (recordCount === 0) {
      return { archived: 0, archivePath: null };
    }

    // In a real implementation, this would:
    // 1. Export records to compressed JSON file
    // 2. Upload to cold storage (S3 Glacier, etc.)
    // 3. Store reference in audit_log_archives table
    // 4. Delete from main table

    // For MVP, just log the intent
    console.log(`Would archive ${recordCount} audit logs for org ${orgId} from before ${cutoffDate.toISOString()}`);

    // Create archive reference
    const archivePath = `/archives/${orgId}/${period}.json.gz`;

    await prisma.$executeRaw`
      INSERT INTO audit_log_archives (
        org_id, archive_period, start_date, end_date, record_count, file_path, status
      ) VALUES (
        ${orgId}::uuid,
        ${period},
        ${cutoffDate}::date,
        ${cutoffDate}::date,
        ${recordCount},
        ${archivePath},
        'active'
      )
    `;

    return { archived: recordCount, archivePath };
  } catch (error) {
    console.error('Error archiving audit logs:', error);
    return { archived: 0, archivePath: null };
  }
}

/**
 * Cleanup expired data (called by cron)
 */
export async function runRetentionCleanup(): Promise<{
  expiredExports: number;
  completedDeletions: number;
  dailyUsageCleanup: number;
}> {
  let expiredExports = 0;
  let completedDeletions = 0;
  let dailyUsageCleanup = 0;

  try {
    // 1. Expire old data exports
    const exportResult = await prisma.$executeRaw`
      UPDATE data_export_requests
      SET status = 'expired', download_url = NULL
      WHERE status = 'completed'
      AND expires_at < NOW()
    `;
    expiredExports = Number(exportResult);

    // 2. Cleanup old daily usage records (older than 7 days)
    const dailyResult = await prisma.$executeRaw`
      DELETE FROM organization_usage_daily
      WHERE date < CURRENT_DATE - INTERVAL '7 days'
    `;
    dailyUsageCleanup = Number(dailyResult);

    // 3. Mark completed deletions (processed elsewhere)
    // This is handled by the account deletion cron job

  } catch (error) {
    console.error('Error in retention cleanup:', error);
  }

  return { expiredExports, completedDeletions, dailyUsageCleanup };
}
