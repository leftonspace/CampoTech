/**
 * Feedback Service
 * ================
 *
 * Handles customer feedback and ratings for completed jobs.
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobFeedback {
  id: string;
  jobId: string;
  customerId: string;
  orgId: string;
  rating: number;           // 1-5 stars
  comment?: string;
  serviceQuality?: number;  // 1-5
  punctuality?: number;     // 1-5
  professionalism?: number; // 1-5
  valueForMoney?: number;   // 1-5
  wouldRecommend: boolean;
  technicianId?: string;
  technicianName?: string;
  isPublic: boolean;        // Can be shown on portal
  createdAt: Date;
}

export interface SubmitFeedbackRequest {
  customerId: string;
  orgId: string;
  jobId: string;
  rating: number;
  comment?: string;
  serviceQuality?: number;
  punctuality?: number;
  professionalism?: number;
  valueForMoney?: number;
  wouldRecommend?: boolean;
  isPublic?: boolean;
}

export interface FeedbackStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  averageServiceQuality?: number;
  averagePunctuality?: number;
  averageProfessionalism?: number;
  averageValueForMoney?: number;
  recommendationRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class FeedbackService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Submit feedback for a job
   */
  async submitFeedback(request: SubmitFeedbackRequest): Promise<JobFeedback> {
    // Verify job exists and belongs to customer
    const jobResult = await this.pool.query(
      `SELECT j.id, j.assigned_to, u.full_name as technician_name
       FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_to
       WHERE j.id = $1 AND j.customer_id = $2 AND j.org_id = $3
         AND j.status = 'completed'`,
      [request.jobId, request.customerId, request.orgId]
    );

    if (!jobResult.rows[0]) {
      throw new Error('Job not found or not completed');
    }

    // Check if feedback already exists
    const existingResult = await this.pool.query(
      `SELECT id FROM job_feedback WHERE job_id = $1`,
      [request.jobId]
    );

    if (existingResult.rows[0]) {
      throw new Error('Feedback already submitted for this job');
    }

    // Validate rating
    if (request.rating < 1 || request.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const job = jobResult.rows[0];
    const feedbackId = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO job_feedback (
        id, job_id, customer_id, org_id, rating, comment,
        service_quality, punctuality, professionalism, value_for_money,
        would_recommend, technician_id, is_public, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        feedbackId,
        request.jobId,
        request.customerId,
        request.orgId,
        request.rating,
        request.comment,
        request.serviceQuality,
        request.punctuality,
        request.professionalism,
        request.valueForMoney,
        request.wouldRecommend ?? true,
        job.assigned_to,
        request.isPublic ?? true,
      ]
    );

    console.log(`[Feedback] Customer ${request.customerId.slice(0, 8)}... rated job ${request.jobId.slice(0, 8)}... ${request.rating}/5`);

    return {
      id: feedbackId,
      jobId: request.jobId,
      customerId: request.customerId,
      orgId: request.orgId,
      rating: request.rating,
      comment: request.comment,
      serviceQuality: request.serviceQuality,
      punctuality: request.punctuality,
      professionalism: request.professionalism,
      valueForMoney: request.valueForMoney,
      wouldRecommend: request.wouldRecommend ?? true,
      technicianId: job.assigned_to,
      technicianName: job.technician_name,
      isPublic: request.isPublic ?? true,
      createdAt: new Date(),
    };
  }

  /**
   * Get feedback for a job
   */
  async getFeedbackForJob(
    jobId: string,
    customerId: string,
    orgId: string
  ): Promise<JobFeedback | null> {
    const result = await this.pool.query(
      `SELECT f.*, u.full_name as technician_name
       FROM job_feedback f
       LEFT JOIN users u ON u.id = f.technician_id
       WHERE f.job_id = $1 AND f.customer_id = $2 AND f.org_id = $3`,
      [jobId, customerId, orgId]
    );

    if (!result.rows[0]) return null;

    return this.mapRowToFeedback(result.rows[0]);
  }

  /**
   * Get customer's feedback history
   */
  async getCustomerFeedback(
    customerId: string,
    orgId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    feedback: JobFeedback[];
    total: number;
  }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM job_feedback WHERE customer_id = $1 AND org_id = $2`,
      [customerId, orgId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT f.*, u.full_name as technician_name
       FROM job_feedback f
       LEFT JOIN users u ON u.id = f.technician_id
       WHERE f.customer_id = $1 AND f.org_id = $2
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [customerId, orgId, limit, offset]
    );

    return {
      feedback: result.rows.map(row => this.mapRowToFeedback(row)),
      total,
    };
  }

  /**
   * Get public feedback for organization (testimonials)
   */
  async getPublicFeedback(
    orgId: string,
    limit = 10
  ): Promise<JobFeedback[]> {
    const result = await this.pool.query(
      `SELECT f.*, u.full_name as technician_name, c.full_name as customer_name
       FROM job_feedback f
       LEFT JOIN users u ON u.id = f.technician_id
       LEFT JOIN customers c ON c.id = f.customer_id
       WHERE f.org_id = $1 AND f.is_public = true AND f.rating >= 4
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );

    return result.rows.map(row => ({
      ...this.mapRowToFeedback(row),
      // Anonymize customer name for public display
      customerName: row.customer_name?.split(' ')[0] + ' ' +
                   (row.customer_name?.split(' ')[1]?.[0] || '') + '.',
    }));
  }

  /**
   * Get feedback statistics for organization
   */
  async getFeedbackStats(orgId: string): Promise<FeedbackStats> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        AVG(service_quality) as avg_service_quality,
        AVG(punctuality) as avg_punctuality,
        AVG(professionalism) as avg_professionalism,
        AVG(value_for_money) as avg_value_for_money,
        COUNT(*) FILTER (WHERE would_recommend = true) as would_recommend_count,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5
       FROM job_feedback
       WHERE org_id = $1`,
      [orgId]
    );

    const row = result.rows[0];
    const totalReviews = parseInt(row.total_reviews, 10);

    return {
      totalReviews,
      averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
      ratingDistribution: {
        1: parseInt(row.rating_1, 10),
        2: parseInt(row.rating_2, 10),
        3: parseInt(row.rating_3, 10),
        4: parseInt(row.rating_4, 10),
        5: parseInt(row.rating_5, 10),
      },
      averageServiceQuality: row.avg_service_quality ? parseFloat(row.avg_service_quality) : undefined,
      averagePunctuality: row.avg_punctuality ? parseFloat(row.avg_punctuality) : undefined,
      averageProfessionalism: row.avg_professionalism ? parseFloat(row.avg_professionalism) : undefined,
      averageValueForMoney: row.avg_value_for_money ? parseFloat(row.avg_value_for_money) : undefined,
      recommendationRate: totalReviews > 0
        ? (parseInt(row.would_recommend_count, 10) / totalReviews) * 100
        : 0,
    };
  }

  /**
   * Get technician feedback stats
   */
  async getTechnicianFeedbackStats(technicianId: string, orgId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    averagePunctuality?: number;
    averageProfessionalism?: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        AVG(punctuality) as avg_punctuality,
        AVG(professionalism) as avg_professionalism
       FROM job_feedback
       WHERE technician_id = $1 AND org_id = $2`,
      [technicianId, orgId]
    );

    const row = result.rows[0];

    return {
      totalReviews: parseInt(row.total_reviews, 10),
      averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
      averagePunctuality: row.avg_punctuality ? parseFloat(row.avg_punctuality) : undefined,
      averageProfessionalism: row.avg_professionalism ? parseFloat(row.avg_professionalism) : undefined,
    };
  }

  /**
   * Map database row to JobFeedback
   */
  private mapRowToFeedback(row: any): JobFeedback {
    return {
      id: row.id,
      jobId: row.job_id,
      customerId: row.customer_id,
      orgId: row.org_id,
      rating: row.rating,
      comment: row.comment,
      serviceQuality: row.service_quality,
      punctuality: row.punctuality,
      professionalism: row.professionalism,
      valueForMoney: row.value_for_money,
      wouldRecommend: row.would_recommend,
      technicianId: row.technician_id,
      technicianName: row.technician_name,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: FeedbackService | null = null;

export function getFeedbackService(pool?: Pool): FeedbackService {
  if (!instance && pool) {
    instance = new FeedbackService(pool);
  }
  if (!instance) {
    throw new Error('FeedbackService not initialized');
  }
  return instance;
}
