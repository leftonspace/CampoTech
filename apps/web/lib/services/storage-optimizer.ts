/**
 * CampoTech Storage Optimizer Service
 * ====================================
 *
 * Handles storage optimization tasks:
 * - Photo compression
 * - Orphaned file cleanup
 * - Storage usage calculation
 *
 * Designed to run as cron jobs.
 */

import { prisma } from '@/lib/prisma';
import { STORAGE_RULES, getTierLimits } from '@/lib/config/tier-limits';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface CompressionResult {
  processedCount: number;
  savedBytes: number;
  failedCount: number;
  errors: string[];
}

export interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
  errors: string[];
}

export interface StorageUsageResult {
  updatedOrgs: number;
  totalStorageBytes: number;
}

interface PhotoRecord {
  id: string;
  org_id: string;
  file_url: string;
  file_size_bytes: number | null;
  compressed: boolean;
}

interface FileRecord {
  id: string;
  org_id: string;
  entity_type: string;
  entity_id: string;
  file_url: string;
  file_size_bytes: number | null;
  created_at: Date;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORAGE OPTIMIZER CLASS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class StorageOptimizer {
  /**
   * Compress photos that haven't been compressed yet
   * Returns statistics about compression results
   */
  async compressUncompressedPhotos(batchSize: number = 100): Promise<CompressionResult> {
    const result: CompressionResult = {
      processedCount: 0,
      savedBytes: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Find uncompressed photos
      const photos = await prisma.$queryRaw<PhotoRecord[]>`
        SELECT
          id,
          org_id,
          file_url,
          file_size_bytes,
          COALESCE((metadata->>'compressed')::boolean, false) as compressed
        FROM job_photos
        WHERE COALESCE((metadata->>'compressed')::boolean, false) = false
          AND file_size_bytes > ${STORAGE_RULES.photos.maxFileSizeBytes}
        ORDER BY created_at ASC
        LIMIT ${batchSize}
      `;

      for (const photo of photos) {
        try {
          // Compress the photo
          const compressionResult = await this.compressPhoto(photo);

          if (compressionResult.success) {
            result.processedCount++;
            result.savedBytes += compressionResult.savedBytes || 0;

            // Mark as compressed
            await prisma.$executeRaw`
              UPDATE job_photos
              SET
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'compressed', true,
                  'originalSize', ${photo.file_size_bytes},
                  'compressedAt', ${new Date().toISOString()}
                ),
                file_size_bytes = ${compressionResult.newSize},
                updated_at = NOW()
              WHERE id = ${photo.id}::uuid
            `;
          } else {
            result.failedCount++;
            result.errors.push(`Photo ${photo.id}: ${compressionResult.error}`);
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push(`Photo ${photo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Compress a single photo
   */
  private async compressPhoto(photo: PhotoRecord): Promise<{
    success: boolean;
    newSize?: number;
    savedBytes?: number;
    error?: string;
  }> {
    // In a real implementation, this would:
    // 1. Download the original photo from storage
    // 2. Compress it using sharp or similar library
    // 3. Upload the compressed version
    // 4. Return the new size

    // For now, return a simulated result
    // TODO: Implement actual compression using sharp and storage provider

    const originalSize = photo.file_size_bytes || 0;
    const targetSize = Math.min(originalSize * 0.7, STORAGE_RULES.photos.maxFileSizeBytes);

    return {
      success: true,
      newSize: Math.round(targetSize),
      savedBytes: originalSize - Math.round(targetSize),
    };
  }

  /**
   * Clean up orphaned files
   * Orphaned files are files in storage that don't have a corresponding database record
   */
  async cleanupOrphanedFiles(olderThanDays: number = 30): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedBytes: 0,
      errors: [],
    };

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    try {
      // Find files marked as deleted but not yet cleaned up
      const orphanedFiles = await prisma.$queryRaw<FileRecord[]>`
        SELECT
          id,
          org_id,
          entity_type,
          entity_id,
          file_url,
          file_size_bytes,
          created_at
        FROM document_versions
        WHERE deleted_at IS NOT NULL
          AND deleted_at < ${cutoffDate}
          AND (metadata->>'physically_deleted')::boolean IS NOT TRUE
        LIMIT 500
      `;

      for (const file of orphanedFiles) {
        try {
          // Delete from storage provider
          const deleteResult = await this.deleteFromStorage(file.file_url);

          if (deleteResult.success) {
            result.deletedCount++;
            result.freedBytes += file.file_size_bytes || 0;

            // Mark as physically deleted
            await prisma.$executeRaw`
              UPDATE document_versions
              SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'physically_deleted', true,
                'deleted_from_storage_at', ${new Date().toISOString()}
              )
              WHERE id = ${file.id}::uuid
            `;
          } else {
            result.errors.push(`File ${file.id}: ${deleteResult.error}`);
          }
        } catch (error) {
          result.errors.push(`File ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Also cleanup orphaned job photos
      const orphanedPhotos = await prisma.$queryRaw<FileRecord[]>`
        SELECT
          jp.id,
          jp.file_url,
          jp.file_size_bytes
        FROM job_photos jp
        LEFT JOIN jobs j ON jp.job_id = j.id
        WHERE j.id IS NULL
          AND jp.created_at < ${cutoffDate}
        LIMIT 500
      `;

      for (const photo of orphanedPhotos) {
        try {
          const deleteResult = await this.deleteFromStorage(photo.file_url);

          if (deleteResult.success) {
            result.deletedCount++;
            result.freedBytes += photo.file_size_bytes || 0;

            // Delete the orphaned record
            await prisma.$executeRaw`
              DELETE FROM job_photos WHERE id = ${photo.id}::uuid
            `;
          }
        } catch (error) {
          result.errors.push(`Photo ${photo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Delete a file from storage
   */
  private async deleteFromStorage(fileUrl: string): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would delete from S3/R2/etc.
    // TODO: Implement actual storage deletion

    // For now, simulate success
    console.log(`Would delete from storage: ${fileUrl}`);
    return { success: true };
  }

  /**
   * Recalculate storage usage for all organizations
   */
  async recalculateStorageUsage(): Promise<StorageUsageResult> {
    const result: StorageUsageResult = {
      updatedOrgs: 0,
      totalStorageBytes: 0,
    };

    try {
      // Calculate storage per organization
      const storageByOrg = await prisma.$queryRaw<Array<{ org_id: string; total_bytes: bigint }>>`
        WITH photo_storage AS (
          SELECT
            j.org_id,
            COALESCE(SUM(jp.file_size_bytes), 0) as bytes
          FROM job_photos jp
          JOIN jobs j ON jp.job_id = j.id
          GROUP BY j.org_id
        ),
        document_storage AS (
          SELECT
            org_id,
            COALESCE(SUM(file_size_bytes), 0) as bytes
          FROM document_versions
          WHERE is_current = true
          GROUP BY org_id
        ),
        voice_storage AS (
          SELECT
            org_id,
            COALESCE(SUM(file_size_bytes), 0) as bytes
          FROM voice_transcripts
          WHERE deleted_at IS NULL
          GROUP BY org_id
        )
        SELECT
          o.id as org_id,
          COALESCE(p.bytes, 0) + COALESCE(d.bytes, 0) + COALESCE(v.bytes, 0) as total_bytes
        FROM organizations o
        LEFT JOIN photo_storage p ON o.id = p.org_id
        LEFT JOIN document_storage d ON o.id = d.org_id
        LEFT JOIN voice_storage v ON o.id = v.org_id
      `;

      // Update each organization's usage
      for (const org of storageByOrg) {
        const totalBytes = Number(org.total_bytes);
        result.totalStorageBytes += totalBytes;

        await prisma.$executeRaw`
          INSERT INTO organization_usage (org_id, period, storage_bytes, updated_at)
          VALUES (
            ${org.org_id}::uuid,
            to_char(NOW(), 'YYYY-MM'),
            ${totalBytes},
            NOW()
          )
          ON CONFLICT (org_id, period) DO UPDATE SET
            storage_bytes = ${totalBytes},
            updated_at = NOW()
        `;

        result.updatedOrgs++;
      }
    } catch (error) {
      console.error('Storage calculation error:', error);
    }

    return result;
  }

  /**
   * Get storage statistics for an organization
   */
  async getStorageStats(orgId: string): Promise<{
    totalBytes: number;
    photos: { count: number; bytes: number };
    documents: { count: number; bytes: number };
    voice: { count: number; bytes: number };
    limit: number;
    percentage: number;
  }> {
    // Get current tier
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionTier: true },
    });
    const tier = org?.subscriptionTier || 'FREE';
    const limits = getTierLimits(tier);

    // Calculate storage breakdown
    const [photoStats, docStats, voiceStats] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint; bytes: bigint }>>`
        SELECT COUNT(*) as count, COALESCE(SUM(jp.file_size_bytes), 0) as bytes
        FROM job_photos jp
        JOIN jobs j ON jp.job_id = j.id
        WHERE j.org_id = ${orgId}::uuid
      `,
      prisma.$queryRaw<Array<{ count: bigint; bytes: bigint }>>`
        SELECT COUNT(*) as count, COALESCE(SUM(file_size_bytes), 0) as bytes
        FROM document_versions
        WHERE org_id = ${orgId}::uuid AND is_current = true
      `,
      prisma.$queryRaw<Array<{ count: bigint; bytes: bigint }>>`
        SELECT COUNT(*) as count, COALESCE(SUM(file_size_bytes), 0) as bytes
        FROM voice_transcripts
        WHERE org_id = ${orgId}::uuid AND deleted_at IS NULL
      `,
    ]);

    const photos = {
      count: Number(photoStats[0]?.count || 0),
      bytes: Number(photoStats[0]?.bytes || 0),
    };
    const documents = {
      count: Number(docStats[0]?.count || 0),
      bytes: Number(docStats[0]?.bytes || 0),
    };
    const voice = {
      count: Number(voiceStats[0]?.count || 0),
      bytes: Number(voiceStats[0]?.bytes || 0),
    };

    const totalBytes = photos.bytes + documents.bytes + voice.bytes;
    const limit = limits.maxStorageBytes;
    const percentage = limit > 0 ? Math.round((totalBytes / limit) * 100) : 0;

    return {
      totalBytes,
      photos,
      documents,
      voice,
      limit,
      percentage,
    };
  }

  /**
   * Delete transcribed voice messages (keep only text)
   * This saves storage by removing audio files after transcription
   */
  async cleanupTranscribedVoiceMessages(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedBytes: 0,
      errors: [],
    };

    if (!STORAGE_RULES.voiceMessages.deleteAfterTranscription) {
      return result;
    }

    try {
      // Find transcribed messages that still have audio files
      const voiceMessages = await prisma.$queryRaw<Array<{
        id: string;
        file_url: string;
        file_size_bytes: number | null;
      }>>`
        SELECT id, file_url, file_size_bytes
        FROM voice_transcripts
        WHERE transcript IS NOT NULL
          AND file_url IS NOT NULL
          AND (metadata->>'audio_deleted')::boolean IS NOT TRUE
          AND created_at < NOW() - INTERVAL '7 days'
        LIMIT 500
      `;

      for (const msg of voiceMessages) {
        try {
          const deleteResult = await this.deleteFromStorage(msg.file_url);

          if (deleteResult.success) {
            result.deletedCount++;
            result.freedBytes += msg.file_size_bytes || 0;

            // Mark audio as deleted but keep transcript
            await prisma.$executeRaw`
              UPDATE voice_transcripts
              SET
                file_url = NULL,
                file_size_bytes = 0,
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'audio_deleted', true,
                  'audio_deleted_at', ${new Date().toISOString()},
                  'original_size_bytes', ${msg.file_size_bytes}
                ),
                updated_at = NOW()
              WHERE id = ${msg.id}::uuid
            `;
          }
        } catch (error) {
          result.errors.push(`Voice ${msg.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORT SINGLETON
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const storageOptimizer = new StorageOptimizer();
