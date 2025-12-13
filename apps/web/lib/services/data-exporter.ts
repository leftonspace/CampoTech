/**
 * CampoTech Data Exporter Service
 * =================================
 *
 * Handles user data export requests per Ley 25.326 (Right of Access).
 * Generates comprehensive export of all personal data.
 */

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExportRequest {
  id: string;
  userId: string;
  orgId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  errorMessage?: string;
}

export interface UserDataExport {
  exportedAt: string;
  exportVersion: string;
  user: UserPersonalData;
  employment?: EmploymentData;
  activity: ActivityData;
  jobs: JobData[];
  customers: CustomerData[];
  documents: DocumentData[];
  loginHistory: LoginEntry[];
}

interface UserPersonalData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  specialty: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EmploymentData {
  organizationName: string;
  position: string | null;
  startDate: string | null;
  isActive: boolean;
}

interface ActivityData {
  totalActions: number;
  periodStart: string;
  periodEnd: string;
  actionSummary: Record<string, number>;
}

interface JobData {
  id: string;
  jobNumber: string;
  role: 'assigned' | 'created';
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface CustomerData {
  id: string;
  name: string;
  createdAt: string;
}

interface DocumentData {
  id: string;
  type: string;
  filename: string;
  uploadedAt: string;
  entityType: string;
  entityId: string;
}

interface LoginEntry {
  timestamp: string;
  ipAddress: string | null;
  userAgent: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORTER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class DataExporter {
  private readonly EXPORT_VERSION = '1.0';
  private readonly ACTIVITY_MONTHS = 12; // Last 12 months
  private readonly EXPORT_EXPIRY_DAYS = 7;

  /**
   * Create a new export request
   */
  async createExportRequest(userId: string, orgId: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      // Check rate limit (1 per 24 hours)
      const recentRequest = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM data_export_requests
        WHERE user_id = ${userId}::uuid
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status != 'expired'
        LIMIT 1
      `;

      if (recentRequest.length > 0) {
        return {
          success: false,
          error: 'Solo puedes solicitar una exportación cada 24 horas.',
        };
      }

      // Create new request
      const requestId = randomBytes(16).toString('hex');

      await prisma.$executeRaw`
        INSERT INTO data_export_requests (
          id, user_id, org_id, status, requested_at
        ) VALUES (
          ${requestId}::uuid,
          ${userId}::uuid,
          ${orgId}::uuid,
          'pending',
          NOW()
        )
      `;

      return { success: true, requestId };
    } catch (error) {
      console.error('Error creating export request:', error);
      return { success: false, error: 'Error al crear la solicitud de exportación.' };
    }
  }

  /**
   * Process an export request (called by background job)
   */
  async processExportRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get request details
      const request = await prisma.$queryRaw<Array<{ user_id: string; org_id: string }>>`
        SELECT user_id, org_id FROM data_export_requests
        WHERE id = ${requestId}::uuid AND status = 'pending'
        LIMIT 1
      `;

      if (request.length === 0) {
        return { success: false, error: 'Request not found or already processed' };
      }

      const { user_id: userId, org_id: orgId } = request[0];

      // Mark as processing
      await prisma.$executeRaw`
        UPDATE data_export_requests
        SET status = 'processing', started_at = NOW()
        WHERE id = ${requestId}::uuid
      `;

      const startTime = Date.now();

      // Generate export data
      const exportData = await this.generateExportData(userId, orgId);

      // Convert to JSON
      const jsonData = JSON.stringify(exportData, null, 2);
      const dataSize = Buffer.byteLength(jsonData, 'utf8');

      // In a real implementation, you would:
      // 1. Upload to storage (S3/Supabase)
      // 2. Generate a signed URL
      // For now, we'll store a placeholder

      const downloadToken = randomBytes(32).toString('hex');
      const downloadUrl = `/api/users/me/export/download?token=${downloadToken}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.EXPORT_EXPIRY_DAYS);

      const processingTime = Date.now() - startTime;

      // Mark as completed
      await prisma.$executeRaw`
        UPDATE data_export_requests
        SET
          status = 'completed',
          completed_at = NOW(),
          processing_time_ms = ${processingTime},
          download_url = ${downloadUrl},
          file_size_bytes = ${dataSize},
          expires_at = ${expiresAt}
        WHERE id = ${requestId}::uuid
      `;

      // Store the actual data (in a real implementation, this would be in storage)
      // For MVP, we'll regenerate on download

      return { success: true };
    } catch (error) {
      console.error('Error processing export request:', error);

      // Mark as failed
      await prisma.$executeRaw`
        UPDATE data_export_requests
        SET
          status = 'failed',
          error_message = ${String(error)},
          retry_count = retry_count + 1
        WHERE id = ${requestId}::uuid
      `;

      return { success: false, error: String(error) };
    }
  }

  /**
   * Generate complete export data for a user
   */
  async generateExportData(userId: string, orgId: string): Promise<UserDataExport> {
    const now = new Date();
    const activityStart = new Date();
    activityStart.setMonth(activityStart.getMonth() - this.ACTIVITY_MONTHS);

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Fetch assigned jobs
    const assignedJobs = await prisma.job.findMany({
      where: {
        technicianId: userId,
        organizationId: orgId,
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch created jobs
    const createdJobs = await prisma.job.findMany({
      where: {
        createdById: userId,
        organizationId: orgId,
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch customers created/modified by user (from audit logs)
    const createdCustomers = await prisma.$queryRaw<Array<{ entity_id: string; created_at: Date }>>`
      SELECT DISTINCT entity_id, MIN(created_at) as created_at
      FROM audit_logs
      WHERE user_id = ${userId}::uuid
      AND entity_type = 'customer'
      AND action = 'CREATE'
      AND org_id = ${orgId}::uuid
      GROUP BY entity_id
      ORDER BY created_at DESC
    `;

    // Get customer names
    const customerIds = createdCustomers.map((c: typeof createdCustomers[number]) => c.entity_id);
    const customers = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, createdAt: true },
        })
      : [];

    // Fetch uploaded photos
    const uploadedPhotos = await prisma.jobPhoto.findMany({
      where: { uploadedById: userId },
      select: {
        id: true,
        photoType: true,
        photoUrl: true,
        createdAt: true,
        jobId: true,
      },
    });

    // Fetch activity summary from audit logs
    const activitySummary = await prisma.$queryRaw<Array<{ action: string; count: bigint }>>`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE user_id = ${userId}::uuid
      AND created_at >= ${activityStart}
      AND org_id = ${orgId}::uuid
      GROUP BY action
    `;

    const totalActions = activitySummary.reduce(
      (sum: number, a: typeof activitySummary[number]) => sum + Number(a.count),
      0
    );

    // Fetch login history from audit logs
    const loginHistory = await prisma.$queryRaw<Array<{ created_at: Date; metadata: Record<string, unknown> }>>`
      SELECT created_at, metadata
      FROM audit_logs
      WHERE user_id = ${userId}::uuid
      AND action = 'LOGIN'
      AND created_at >= ${activityStart}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // Build export object
    const exportData: UserDataExport = {
      exportedAt: now.toISOString(),
      exportVersion: this.EXPORT_VERSION,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        specialty: user.specialty,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },

      employment: {
        organizationName: user.organization.name,
        position: user.specialty,
        startDate: user.createdAt.toISOString(),
        isActive: user.isActive,
      },

      activity: {
        totalActions,
        periodStart: activityStart.toISOString(),
        periodEnd: now.toISOString(),
        actionSummary: activitySummary.reduce(
          (acc: Record<string, number>, a: typeof activitySummary[number]) => ({ ...acc, [a.action]: Number(a.count) }),
          {} as Record<string, number>
        ),
      },

      jobs: [
        ...assignedJobs.map((j: typeof assignedJobs[number]) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          role: 'assigned' as const,
          status: j.status,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString() || null,
        })),
        ...createdJobs.map((j: typeof createdJobs[number]) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          role: 'created' as const,
          status: j.status,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString() || null,
        })),
      ],

      customers: customers.map((c: typeof customers[number]) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
      })),

      documents: uploadedPhotos.map((p: typeof uploadedPhotos[number]) => ({
        id: p.id,
        type: p.photoType,
        filename: p.photoUrl.split('/').pop() || 'unknown',
        uploadedAt: p.createdAt.toISOString(),
        entityType: 'job',
        entityId: p.jobId,
      })),

      loginHistory: loginHistory.map((l: typeof loginHistory[number]) => ({
        timestamp: l.created_at.toISOString(),
        ipAddress: (l.metadata?.ipAddress as string) || null,
        userAgent: (l.metadata?.userAgent as string) || null,
      })),
    };

    return exportData;
  }

  /**
   * Get export request status
   */
  async getExportStatus(requestId: string, userId: string): Promise<ExportRequest | null> {
    try {
      const result = await prisma.$queryRaw<Array<{
        id: string;
        user_id: string;
        org_id: string;
        status: string;
        requested_at: Date;
        completed_at: Date | null;
        download_url: string | null;
        expires_at: Date | null;
        error_message: string | null;
      }>>`
        SELECT id, user_id, org_id, status, requested_at, completed_at,
               download_url, expires_at, error_message
        FROM data_export_requests
        WHERE id = ${requestId}::uuid AND user_id = ${userId}::uuid
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const r = result[0];
      return {
        id: r.id,
        userId: r.user_id,
        orgId: r.org_id,
        status: r.status as ExportRequest['status'],
        requestedAt: r.requested_at,
        completedAt: r.completed_at || undefined,
        downloadUrl: r.download_url || undefined,
        expiresAt: r.expires_at || undefined,
        errorMessage: r.error_message || undefined,
      };
    } catch (error) {
      console.error('Error getting export status:', error);
      return null;
    }
  }

  /**
   * Get user's most recent export request
   */
  async getLatestExportRequest(userId: string): Promise<ExportRequest | null> {
    try {
      const result = await prisma.$queryRaw<Array<{
        id: string;
        user_id: string;
        org_id: string;
        status: string;
        requested_at: Date;
        completed_at: Date | null;
        download_url: string | null;
        expires_at: Date | null;
        error_message: string | null;
      }>>`
        SELECT id, user_id, org_id, status, requested_at, completed_at,
               download_url, expires_at, error_message
        FROM data_export_requests
        WHERE user_id = ${userId}::uuid
        ORDER BY requested_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const r = result[0];
      return {
        id: r.id,
        userId: r.user_id,
        orgId: r.org_id,
        status: r.status as ExportRequest['status'],
        requestedAt: r.requested_at,
        completedAt: r.completed_at || undefined,
        downloadUrl: r.download_url || undefined,
        expiresAt: r.expires_at || undefined,
        errorMessage: r.error_message || undefined,
      };
    } catch (error) {
      console.error('Error getting latest export request:', error);
      return null;
    }
  }

  /**
   * Record download
   */
  async recordDownload(requestId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE data_export_requests
        SET download_count = download_count + 1,
            last_downloaded_at = NOW()
        WHERE id = ${requestId}::uuid
      `;
    } catch (error) {
      console.error('Error recording download:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let dataExporterInstance: DataExporter | null = null;

export function getDataExporter(): DataExporter {
  if (!dataExporterInstance) {
    dataExporterInstance = new DataExporter();
  }
  return dataExporterInstance;
}

export const dataExporter = getDataExporter();
