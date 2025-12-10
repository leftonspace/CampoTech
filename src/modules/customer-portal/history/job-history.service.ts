/**
 * Job History Service
 * ===================
 *
 * Provides customer access to their job history.
 */

import { Pool } from 'pg';
import { JobStatus } from '../../../shared/types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerJob {
  id: string;
  description: string;
  address: string;
  city?: string;
  scheduledAt?: Date;
  completedAt?: Date;
  status: JobStatus;
  technicianName?: string;
  technicianPhoto?: string;
  lineItems: CustomerJobLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  photos: string[];
  signature?: string;
  completionNotes?: string;
  rating?: number;
  feedback?: string;
  createdAt: Date;
}

export interface CustomerJobLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface JobHistoryParams {
  customerId: string;
  orgId: string;
  status?: JobStatus[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface JobHistorySummary {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  totalSpent: number;
  averageRating?: number;
  lastJobDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class JobHistoryService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get job history for customer
   */
  async getJobHistory(params: JobHistoryParams): Promise<{
    jobs: CustomerJob[];
    total: number;
  }> {
    const { customerId, orgId, status, startDate, endDate, limit = 20, offset = 0 } = params;

    let whereClause = 'WHERE j.customer_id = $1 AND j.org_id = $2';
    const queryParams: any[] = [customerId, orgId];
    let paramIndex = 3;

    if (status && status.length > 0) {
      whereClause += ` AND j.status = ANY($${paramIndex})`;
      queryParams.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND j.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND j.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    // Get count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      queryParams.slice(0, paramIndex - 1)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get jobs with technician info
    queryParams.push(limit, offset);
    const result = await this.pool.query(
      `SELECT
        j.*,
        u.full_name as technician_name,
        f.rating,
        f.comment as feedback
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       LEFT JOIN job_feedback f ON f.job_id = j.id
       ${whereClause}
       ORDER BY COALESCE(j.scheduled_at, j.created_at) DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return {
      jobs: result.rows.map(row => this.mapRowToJob(row)),
      total,
    };
  }

  /**
   * Get single job details
   */
  async getJobById(
    jobId: string,
    customerId: string,
    orgId: string
  ): Promise<CustomerJob | null> {
    const result = await this.pool.query(
      `SELECT
        j.*,
        u.full_name as technician_name,
        f.rating,
        f.comment as feedback
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       LEFT JOIN job_feedback f ON f.job_id = j.id
       WHERE j.id = $1 AND j.customer_id = $2 AND j.org_id = $3`,
      [jobId, customerId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToJob(result.rows[0]);
  }

  /**
   * Get job history summary
   */
  async getHistorySummary(customerId: string, orgId: string): Promise<JobHistorySummary> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status IN ('pending', 'scheduled', 'en_camino', 'working')) as pending_jobs,
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) as total_spent,
        MAX(COALESCE(scheduled_at, created_at)) as last_job_date
       FROM jobs
       WHERE customer_id = $1 AND org_id = $2`,
      [customerId, orgId]
    );

    // Get average rating
    const ratingResult = await this.pool.query(
      `SELECT AVG(f.rating) as avg_rating
       FROM job_feedback f
       JOIN jobs j ON j.id = f.job_id
       WHERE j.customer_id = $1 AND j.org_id = $2`,
      [customerId, orgId]
    );

    const row = result.rows[0];

    return {
      totalJobs: parseInt(row.total_jobs, 10),
      completedJobs: parseInt(row.completed_jobs, 10),
      pendingJobs: parseInt(row.pending_jobs, 10),
      totalSpent: parseFloat(row.total_spent),
      averageRating: ratingResult.rows[0]?.avg_rating
        ? parseFloat(ratingResult.rows[0].avg_rating)
        : undefined,
      lastJobDate: row.last_job_date ? new Date(row.last_job_date) : undefined,
    };
  }

  /**
   * Get upcoming jobs
   */
  async getUpcomingJobs(customerId: string, orgId: string): Promise<CustomerJob[]> {
    const result = await this.pool.query(
      `SELECT
        j.*,
        u.full_name as technician_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       WHERE j.customer_id = $1
         AND j.org_id = $2
         AND j.status IN ('pending', 'scheduled', 'en_camino', 'working')
         AND (j.scheduled_at IS NULL OR j.scheduled_at >= NOW())
       ORDER BY j.scheduled_at ASC
       LIMIT 10`,
      [customerId, orgId]
    );

    return result.rows.map(row => this.mapRowToJob(row));
  }

  /**
   * Get recent completed jobs (for rating prompts)
   */
  async getUnratedCompletedJobs(customerId: string, orgId: string): Promise<CustomerJob[]> {
    const result = await this.pool.query(
      `SELECT j.*, u.full_name as technician_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       LEFT JOIN job_feedback f ON f.job_id = j.id
       WHERE j.customer_id = $1
         AND j.org_id = $2
         AND j.status = 'completed'
         AND f.id IS NULL
         AND j.completed_at > NOW() - INTERVAL '7 days'
       ORDER BY j.completed_at DESC
       LIMIT 5`,
      [customerId, orgId]
    );

    return result.rows.map(row => this.mapRowToJob(row));
  }

  /**
   * Map database row to CustomerJob
   */
  private mapRowToJob(row: any): CustomerJob {
    return {
      id: row.id,
      description: row.description,
      address: row.address,
      city: row.city,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      status: row.status,
      technicianName: row.technician_name,
      lineItems: (row.line_items || []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: parseFloat(row.subtotal || 0),
      taxAmount: parseFloat(row.tax_amount || 0),
      total: parseFloat(row.total || 0),
      photos: row.photos || [],
      signature: row.signature,
      completionNotes: row.completion_notes,
      rating: row.rating ? parseInt(row.rating, 10) : undefined,
      feedback: row.feedback,
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: JobHistoryService | null = null;

export function getJobHistoryService(pool?: Pool): JobHistoryService {
  if (!instance && pool) {
    instance = new JobHistoryService(pool);
  }
  if (!instance) {
    throw new Error('JobHistoryService not initialized');
  }
  return instance;
}
