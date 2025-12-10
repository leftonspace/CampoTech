/**
 * Review Repository
 * =================
 *
 * Data access for consumer reviews.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import {
  ConsumerReview,
  ReviewStatus,
} from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateReviewInput {
  consumerId: string;
  businessProfileId: string;
  jobId?: string;
  overallRating: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  comment?: string;
  wouldRecommend: boolean;
  photos?: string[];
}

export interface UpdateReviewInput {
  overallRating?: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  comment?: string;
  wouldRecommend?: boolean;
  photos?: string[];
}

export interface ReviewWithConsumer extends ConsumerReview {
  consumerName: string;
  consumerPhoto?: string;
}

export interface ReviewSearchParams {
  businessProfileId?: string;
  consumerId?: string;
  status?: ReviewStatus | ReviewStatus[];
  minRating?: number;
  maxRating?: number;
  hasComment?: boolean;
  verified?: boolean;
}

export interface RatingSummary {
  businessProfileId: string;
  totalReviews: number;
  overallRating: number;
  punctualityRating: number;
  qualityRating: number;
  priceRating: number;
  communicationRating: number;
  recommendPercentage: number;
  ratingDistribution: Record<number, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class ReviewRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new review
   */
  async create(input: CreateReviewInput): Promise<ConsumerReview> {
    const result = await this.pool.query<ConsumerReview>(
      `INSERT INTO consumer_reviews (
         consumer_id,
         business_profile_id,
         job_id,
         overall_rating,
         punctuality_rating,
         quality_rating,
         price_rating,
         communication_rating,
         comment,
         would_recommend,
         photos,
         status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING *`,
      [
        input.consumerId,
        input.businessProfileId,
        input.jobId,
        input.overallRating,
        input.punctualityRating,
        input.qualityRating,
        input.priceRating,
        input.communicationRating,
        input.comment,
        input.wouldRecommend,
        input.photos || [],
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find review by ID
   */
  async findById(id: string): Promise<ConsumerReview | null> {
    const result = await this.pool.query<ConsumerReview>(
      `SELECT * FROM consumer_reviews WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find reviews by business
   */
  async findByBusiness(
    businessProfileId: string,
    options?: {
      status?: ReviewStatus | ReviewStatus[];
      limit?: number;
      offset?: number;
      sortBy?: 'recent' | 'rating_high' | 'rating_low' | 'helpful';
    }
  ): Promise<{ reviews: ReviewWithConsumer[]; total: number }> {
    const { status, limit = 10, offset = 0, sortBy = 'recent' } = options || {};

    let whereClause = 'WHERE cr.business_profile_id = $1';
    const params: any[] = [businessProfileId];
    let paramIndex = 2;

    if (status) {
      if (Array.isArray(status)) {
        whereClause += ` AND cr.status = ANY($${paramIndex++})`;
        params.push(status);
      } else {
        whereClause += ` AND cr.status = $${paramIndex++}`;
        params.push(status);
      }
    } else {
      whereClause += ` AND cr.status = 'published'`;
    }

    let orderClause: string;
    switch (sortBy) {
      case 'rating_high':
        orderClause = 'ORDER BY cr.overall_rating DESC, cr.created_at DESC';
        break;
      case 'rating_low':
        orderClause = 'ORDER BY cr.overall_rating ASC, cr.created_at DESC';
        break;
      case 'helpful':
        orderClause = 'ORDER BY cr.helpful_count DESC, cr.created_at DESC';
        break;
      default:
        orderClause = 'ORDER BY cr.created_at DESC';
    }

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM consumer_reviews cr ${whereClause}`,
      params
    );

    const result = await this.pool.query(
      `SELECT
         cr.*,
         cp.display_name as consumer_name,
         cp.profile_photo_url as consumer_photo
       FROM consumer_reviews cr
       JOIN consumer_profiles cp ON cr.consumer_id = cp.id
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      reviews: result.rows.map(row => this.mapRowWithConsumer(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find reviews by consumer
   */
  async findByConsumer(consumerId: string): Promise<ConsumerReview[]> {
    const result = await this.pool.query<ConsumerReview>(
      `SELECT * FROM consumer_reviews
       WHERE consumer_id = $1
       ORDER BY created_at DESC`,
      [consumerId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Check if consumer already reviewed business
   */
  async hasReviewed(consumerId: string, businessProfileId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM consumer_reviews
       WHERE consumer_id = $1 AND business_profile_id = $2
       LIMIT 1`,
      [consumerId, businessProfileId]
    );
    return result.rowCount > 0;
  }

  /**
   * Update review
   */
  async update(id: string, input: UpdateReviewInput): Promise<ConsumerReview | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.overallRating !== undefined) {
      fields.push(`overall_rating = $${paramIndex++}`);
      values.push(input.overallRating);
    }
    if (input.punctualityRating !== undefined) {
      fields.push(`punctuality_rating = $${paramIndex++}`);
      values.push(input.punctualityRating);
    }
    if (input.qualityRating !== undefined) {
      fields.push(`quality_rating = $${paramIndex++}`);
      values.push(input.qualityRating);
    }
    if (input.priceRating !== undefined) {
      fields.push(`price_rating = $${paramIndex++}`);
      values.push(input.priceRating);
    }
    if (input.communicationRating !== undefined) {
      fields.push(`communication_rating = $${paramIndex++}`);
      values.push(input.communicationRating);
    }
    if (input.comment !== undefined) {
      fields.push(`comment = $${paramIndex++}`);
      values.push(input.comment);
    }
    if (input.wouldRecommend !== undefined) {
      fields.push(`would_recommend = $${paramIndex++}`);
      values.push(input.wouldRecommend);
    }
    if (input.photos !== undefined) {
      fields.push(`photos = $${paramIndex++}`);
      values.push(input.photos);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query<ConsumerReview>(
      `UPDATE consumer_reviews
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update review status
   */
  async updateStatus(
    id: string,
    status: ReviewStatus,
    moderatorNotes?: string
  ): Promise<ConsumerReview | null> {
    const additionalFields: string[] = [];
    const params: any[] = [status, id];

    if (status === 'published') {
      additionalFields.push('published_at = NOW()');
    }

    if (moderatorNotes) {
      additionalFields.push('moderation_notes = $3');
      params.push(moderatorNotes);
    }

    const setClause = [
      'status = $1',
      'updated_at = NOW()',
      ...additionalFields,
    ].join(', ');

    const result = await this.pool.query<ConsumerReview>(
      `UPDATE consumer_reviews
       SET ${setClause}
       WHERE id = $2
       RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Add business response
   */
  async addBusinessResponse(
    id: string,
    response: string
  ): Promise<ConsumerReview | null> {
    const result = await this.pool.query<ConsumerReview>(
      `UPDATE consumer_reviews
       SET business_response = $2,
           business_response_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, response]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete review
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM consumer_reviews WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Mark review as helpful
   */
  async markHelpful(reviewId: string, consumerId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_helpfulness_votes (review_id, consumer_id, is_helpful)
       VALUES ($1, $2, true)
       ON CONFLICT (review_id, consumer_id) DO UPDATE SET is_helpful = true`,
      [reviewId, consumerId]
    );
  }

  /**
   * Mark review as not helpful
   */
  async markNotHelpful(reviewId: string, consumerId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_helpfulness_votes (review_id, consumer_id, is_helpful)
       VALUES ($1, $2, false)
       ON CONFLICT (review_id, consumer_id) DO UPDATE SET is_helpful = false`,
      [reviewId, consumerId]
    );
  }

  /**
   * Flag review
   */
  async flagReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    details?: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_flags (review_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4)`,
      [reviewId, reporterId, reason, details]
    );
  }

  /**
   * Get rating summary for business
   */
  async getRatingSummary(businessProfileId: string): Promise<RatingSummary | null> {
    const result = await this.pool.query<{
      total_reviews: string;
      overall_rating: number;
      punctuality_rating: number;
      quality_rating: number;
      price_rating: number;
      communication_rating: number;
      recommend_percentage: number;
      rating_1: string;
      rating_2: string;
      rating_3: string;
      rating_4: string;
      rating_5: string;
    }>(
      `SELECT
         COUNT(*) as total_reviews,
         AVG(overall_rating) as overall_rating,
         AVG(punctuality_rating) as punctuality_rating,
         AVG(quality_rating) as quality_rating,
         AVG(price_rating) as price_rating,
         AVG(communication_rating) as communication_rating,
         AVG(CASE WHEN would_recommend THEN 100.0 ELSE 0.0 END) as recommend_percentage,
         COUNT(*) FILTER (WHERE overall_rating = 1) as rating_1,
         COUNT(*) FILTER (WHERE overall_rating = 2) as rating_2,
         COUNT(*) FILTER (WHERE overall_rating = 3) as rating_3,
         COUNT(*) FILTER (WHERE overall_rating = 4) as rating_4,
         COUNT(*) FILTER (WHERE overall_rating = 5) as rating_5
       FROM consumer_reviews
       WHERE business_profile_id = $1 AND status = 'published'`,
      [businessProfileId]
    );

    if (result.rows.length === 0 || result.rows[0].total_reviews === '0') {
      return null;
    }

    const row = result.rows[0];
    return {
      businessProfileId,
      totalReviews: parseInt(row.total_reviews, 10),
      overallRating: row.overall_rating || 0,
      punctualityRating: row.punctuality_rating || 0,
      qualityRating: row.quality_rating || 0,
      priceRating: row.price_rating || 0,
      communicationRating: row.communication_rating || 0,
      recommendPercentage: row.recommend_percentage || 0,
      ratingDistribution: {
        1: parseInt(row.rating_1, 10),
        2: parseInt(row.rating_2, 10),
        3: parseInt(row.rating_3, 10),
        4: parseInt(row.rating_4, 10),
        5: parseInt(row.rating_5, 10),
      },
    };
  }

  /**
   * Refresh materialized rating summaries
   */
  async refreshRatingSummaries(): Promise<void> {
    await this.pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY business_rating_summaries`);
  }

  /**
   * Get pending reviews for moderation
   */
  async getPendingModeration(limit: number = 50): Promise<ReviewWithConsumer[]> {
    const result = await this.pool.query(
      `SELECT
         cr.*,
         cp.display_name as consumer_name,
         cp.profile_photo_url as consumer_photo
       FROM consumer_reviews cr
       JOIN consumer_profiles cp ON cr.consumer_id = cp.id
       WHERE cr.status = 'pending'
       ORDER BY cr.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRowWithConsumer(row));
  }

  /**
   * Get flagged reviews
   */
  async getFlaggedReviews(limit: number = 50): Promise<ReviewWithConsumer[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT
         cr.*,
         cp.display_name as consumer_name,
         cp.profile_photo_url as consumer_photo,
         COUNT(rf.id) as flag_count
       FROM consumer_reviews cr
       JOIN consumer_profiles cp ON cr.consumer_id = cp.id
       JOIN review_flags rf ON cr.id = rf.review_id
       WHERE rf.status = 'pending'
       GROUP BY cr.id, cp.display_name, cp.profile_photo_url
       ORDER BY flag_count DESC, cr.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRowWithConsumer(row));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private mapRow(row: any): ConsumerReview {
    return {
      id: row.id,
      consumerId: row.consumer_id,
      businessProfileId: row.business_profile_id,
      jobId: row.job_id,
      overallRating: row.overall_rating,
      punctualityRating: row.punctuality_rating,
      qualityRating: row.quality_rating,
      priceRating: row.price_rating,
      communicationRating: row.communication_rating,
      comment: row.comment,
      photos: row.photos || [],
      wouldRecommend: row.would_recommend,
      status: row.status,
      isVerified: row.is_verified,
      verifiedAt: row.verified_at,
      helpfulCount: row.helpful_count || 0,
      notHelpfulCount: row.not_helpful_count || 0,
      businessResponse: row.business_response,
      businessResponseAt: row.business_response_at,
      moderationNotes: row.moderation_notes,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowWithConsumer(row: any): ReviewWithConsumer {
    return {
      ...this.mapRow(row),
      consumerName: row.consumer_name,
      consumerPhoto: row.consumer_photo,
    };
  }
}
