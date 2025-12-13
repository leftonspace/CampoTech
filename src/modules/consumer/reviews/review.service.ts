/**
 * Review Service
 * ==============
 *
 * Business logic for review management.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import {
  ReviewRepository,
  CreateReviewInput,
  UpdateReviewInput,
  ReviewWithConsumer,
  RatingSummary,
} from './review.repository';
import { ConsumerReview, ReviewStatus } from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubmitReviewInput {
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

export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  score: number;
}

export interface ReviewAnalysis {
  fraudSignals: FraudSignal[];
  totalScore: number;
  recommendation: 'auto_publish' | 'manual_review' | 'auto_reject';
  reasons: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class ReviewError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ReviewService {
  private repository: ReviewRepository;

  constructor(private pool: Pool) {
    this.repository = new ReviewRepository(pool);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEW SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a new review
   */
  async submitReview(input: SubmitReviewInput): Promise<ConsumerReview> {
    // Validate rating values
    this.validateRatings(input);

    // Check if already reviewed
    const alreadyReviewed = await this.repository.hasReviewed(
      input.consumerId,
      input.businessProfileId
    );
    if (alreadyReviewed) {
      throw new ReviewError(
        'ALREADY_REVIEWED',
        'Ya dejaste una reseña para este negocio'
      );
    }

    // Verify consumer exists and has completed job with business (if jobId provided)
    if (input.jobId) {
      const jobValid = await this.verifyJob(
        input.consumerId,
        input.businessProfileId,
        input.jobId
      );
      if (!jobValid) {
        throw new ReviewError(
          'INVALID_JOB',
          'No podés reseñar un trabajo que no completaste'
        );
      }
    }

    // Create review
    const review = await this.repository.create({
      consumerId: input.consumerId,
      businessProfileId: input.businessProfileId,
      jobId: input.jobId,
      overallRating: input.overallRating,
      punctualityRating: input.punctualityRating,
      qualityRating: input.qualityRating,
      priceRating: input.priceRating,
      communicationRating: input.communicationRating,
      comment: input.comment,
      wouldRecommend: input.wouldRecommend,
      photos: input.photos,
    });

    // Analyze for fraud
    const analysis = await this.analyzeReview(review, input.consumerId);

    // Auto-process based on analysis
    if (analysis.recommendation === 'auto_publish') {
      await this.repository.updateStatus(review.id, ReviewStatus.PUBLISHED);
      await this.updateBusinessRatings(input.businessProfileId);
      return { ...review, status: ReviewStatus.PUBLISHED };
    } else if (analysis.recommendation === 'auto_reject') {
      await this.repository.updateStatus(
        review.id,
        ReviewStatus.REMOVED,
        analysis.reasons.join('; ')
      );
      return { ...review, status: ReviewStatus.REMOVED };
    }

    // Queue for manual review
    await this.queueForModeration(review.id, analysis);

    return review;
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    consumerId: string,
    input: UpdateReviewInput
  ): Promise<ConsumerReview> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    if (review.consumerId !== consumerId) {
      throw new ReviewError('UNAUTHORIZED', 'No autorizado', 403);
    }

    if (review.status === ReviewStatus.REMOVED) {
      throw new ReviewError('CANNOT_EDIT', 'No podés editar una reseña rechazada');
    }

    // Validate ratings if provided
    if (input.overallRating !== undefined) {
      this.validateRatings({
        overallRating: input.overallRating,
        ...input,
      } as any);
    }

    const updated = await this.repository.update(reviewId, input);

    // Re-analyze if substantial changes
    if (input.comment || input.overallRating) {
      const analysis = await this.analyzeReview(updated!, consumerId);
      if (analysis.recommendation === 'manual_review') {
        await this.repository.updateStatus(updated!.id, ReviewStatus.PENDING);
        await this.queueForModeration(updated!.id, analysis);
      }
    }

    // Update business ratings if published
    if (updated!.status === ReviewStatus.PUBLISHED) {
      await this.updateBusinessRatings(review.businessProfileId);
    }

    return updated!;
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string, consumerId: string): Promise<void> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    if (review.consumerId !== consumerId) {
      throw new ReviewError('UNAUTHORIZED', 'No autorizado', 403);
    }

    const businessProfileId = review.businessProfileId;
    await this.repository.delete(reviewId);
    await this.updateBusinessRatings(businessProfileId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEW RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get reviews for a business
   */
  async getBusinessReviews(
    businessProfileId: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: 'recent' | 'rating_high' | 'rating_low' | 'helpful';
    }
  ): Promise<{
    reviews: ReviewWithConsumer[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, sortBy = 'recent' } = options || {};
    const offset = (page - 1) * limit;

    const { reviews, total } = await this.repository.findByBusiness(
      businessProfileId,
      {
        status: ReviewStatus.PUBLISHED,
        limit,
        offset,
        sortBy,
      }
    );

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get consumer's reviews
   */
  async getConsumerReviews(consumerId: string): Promise<ConsumerReview[]> {
    return this.repository.findByConsumer(consumerId);
  }

  /**
   * Get rating summary for business
   */
  async getRatingSummary(businessProfileId: string): Promise<RatingSummary | null> {
    return this.repository.getRatingSummary(businessProfileId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS RESPONSES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add business response to review
   */
  async addBusinessResponse(
    reviewId: string,
    businessProfileId: string,
    response: string
  ): Promise<ConsumerReview> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    if (review.businessProfileId !== businessProfileId) {
      throw new ReviewError('UNAUTHORIZED', 'No autorizado', 403);
    }

    if (review.businessResponse) {
      throw new ReviewError(
        'ALREADY_RESPONDED',
        'Ya respondiste a esta reseña'
      );
    }

    if (!response.trim() || response.length < 10) {
      throw new ReviewError(
        'INVALID_RESPONSE',
        'La respuesta debe tener al menos 10 caracteres'
      );
    }

    return (await this.repository.addBusinessResponse(reviewId, response.trim()))!;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPFULNESS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mark review as helpful
   */
  async markHelpful(reviewId: string, consumerId: string): Promise<void> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    // Can't vote on own review
    if (review.consumerId === consumerId) {
      throw new ReviewError(
        'CANNOT_VOTE_OWN',
        'No podés votar tu propia reseña'
      );
    }

    await this.repository.markHelpful(reviewId, consumerId);
  }

  /**
   * Mark review as not helpful
   */
  async markNotHelpful(reviewId: string, consumerId: string): Promise<void> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    if (review.consumerId === consumerId) {
      throw new ReviewError(
        'CANNOT_VOTE_OWN',
        'No podés votar tu propia reseña'
      );
    }

    await this.repository.markNotHelpful(reviewId, consumerId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Report a review
   */
  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    details?: string
  ): Promise<void> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    const validReasons = [
      'inappropriate',
      'fake',
      'spam',
      'harassment',
      'wrong_business',
      'other',
    ];
    if (!validReasons.includes(reason)) {
      throw new ReviewError('INVALID_REASON', 'Motivo inválido');
    }

    await this.repository.flagReview(reviewId, reporterId, reason, details);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get pending reviews for moderation
   */
  async getPendingModeration(): Promise<ReviewWithConsumer[]> {
    return this.repository.getPendingModeration();
  }

  /**
   * Get flagged reviews
   */
  async getFlaggedReviews(): Promise<ReviewWithConsumer[]> {
    return this.repository.getFlaggedReviews();
  }

  /**
   * Approve review
   */
  async approveReview(reviewId: string, moderatorNotes?: string): Promise<ConsumerReview> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    const updated = await this.repository.updateStatus(
      reviewId,
      ReviewStatus.PUBLISHED,
      moderatorNotes
    );
    await this.updateBusinessRatings(review.businessProfileId);

    return updated!;
  }

  /**
   * Reject review
   */
  async rejectReview(reviewId: string, reason: string): Promise<ConsumerReview> {
    const review = await this.repository.findById(reviewId);
    if (!review) {
      throw new ReviewError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }

    return (await this.repository.updateStatus(reviewId, ReviewStatus.REMOVED, reason))!;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FRAUD DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze review for fraud signals
   */
  private async analyzeReview(
    review: ConsumerReview,
    consumerId: string
  ): Promise<ReviewAnalysis> {
    const signals: FraudSignal[] = [];
    let totalScore = 0;

    // Get consumer history
    const consumerStats = await this.getConsumerReviewStats(consumerId);
    const recentReviews = await this.getRecentReviewsByConsumer(consumerId);

    // Check 1: New consumer with extreme rating
    if (consumerStats.totalReviews < 3 && (review.overallRating === 1 || review.overallRating === 5)) {
      signals.push({
        type: 'new_consumer_extreme_rating',
        severity: 'low',
        description: 'Usuario nuevo con calificación extrema',
        score: 15,
      });
      totalScore += 15;
    }

    // Check 2: Very short comment with low rating
    if (review.comment && review.comment.length < 20 && review.overallRating <= 2) {
      signals.push({
        type: 'short_negative_comment',
        severity: 'medium',
        description: 'Comentario muy corto con calificación negativa',
        score: 25,
      });
      totalScore += 25;
    }

    // Check 3: Multiple reviews in short time
    const recentCount = recentReviews.filter(
      r => Date.now() - new Date(r.createdAt).getTime() < 3600000
    ).length;
    if (recentCount > 2) {
      signals.push({
        type: 'high_frequency_reviews',
        severity: 'high',
        description: 'Múltiples reseñas en poco tiempo',
        score: 50,
      });
      totalScore += 50;
    }

    // Check 4: No verified job
    if (!review.jobId) {
      signals.push({
        type: 'unverified_transaction',
        severity: 'low',
        description: 'Reseña sin trabajo verificado',
        score: 10,
      });
      totalScore += 10;
    }

    // Check 5: Rating inconsistency
    if (
      review.punctualityRating &&
      review.qualityRating &&
      Math.abs(review.overallRating - review.punctualityRating) > 2 &&
      Math.abs(review.overallRating - review.qualityRating) > 2
    ) {
      signals.push({
        type: 'rating_inconsistency',
        severity: 'medium',
        description: 'Inconsistencia en calificaciones',
        score: 20,
      });
      totalScore += 20;
    }

    // Check 6: Spam patterns in comment
    if (review.comment) {
      const spamPatterns = [
        /https?:\/\//i,
        /\b(gratis|regalo|promo|descuento|oferta)\b/i,
        /(.)\1{4,}/,
        /[A-Z]{10,}/,
      ];
      const hasSpam = spamPatterns.some(p => p.test(review.comment!));
      if (hasSpam) {
        signals.push({
          type: 'spam_content',
          severity: 'high',
          description: 'Posible contenido spam',
          score: 60,
        });
        totalScore += 60;
      }
    }

    // Determine recommendation
    let recommendation: ReviewAnalysis['recommendation'];
    const reasons: string[] = [];

    if (totalScore >= 70) {
      recommendation = 'auto_reject';
      reasons.push('Múltiples señales de fraude detectadas');
    } else if (totalScore >= 30) {
      recommendation = 'manual_review';
      reasons.push('Requiere revisión manual');
    } else {
      // Additional auto-publish check: verified job
      if (review.jobId) {
        recommendation = 'auto_publish';
      } else if (consumerStats.totalReviews >= 5 && consumerStats.averageRating >= 3) {
        recommendation = 'auto_publish';
      } else {
        recommendation = 'manual_review';
        reasons.push('Usuario nuevo sin trabajo verificado');
      }
    }

    signals.forEach(s => reasons.push(s.description));

    return {
      fraudSignals: signals,
      totalScore,
      recommendation,
      reasons,
    };
  }

  /**
   * Queue review for moderation
   */
  private async queueForModeration(
    reviewId: string,
    analysis: ReviewAnalysis
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_moderation_queue (
         review_id,
         fraud_score,
         fraud_signals,
         status
       ) VALUES ($1, $2, $3, 'pending')`,
      [reviewId, analysis.totalScore, JSON.stringify(analysis.fraudSignals)]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private validateRatings(input: SubmitReviewInput): void {
    if (input.overallRating < 1 || input.overallRating > 5) {
      throw new ReviewError('INVALID_RATING', 'La calificación debe ser entre 1 y 5');
    }

    const optionalRatings = [
      input.punctualityRating,
      input.qualityRating,
      input.priceRating,
      input.communicationRating,
    ];

    for (const rating of optionalRatings) {
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new ReviewError('INVALID_RATING', 'Las calificaciones deben ser entre 1 y 5');
      }
    }
  }

  private async verifyJob(
    consumerId: string,
    businessProfileId: string,
    jobId: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM jobs j
       JOIN consumer_service_requests csr ON j.request_id = csr.id
       WHERE j.id = $1
         AND csr.consumer_id = $2
         AND j.business_profile_id = $3
         AND j.status = 'completed'
       LIMIT 1`,
      [jobId, consumerId, businessProfileId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async getConsumerReviewStats(
    consumerId: string
  ): Promise<{ totalReviews: number; averageRating: number }> {
    const result = await this.pool.query<{
      total: string;
      avg_rating: number;
    }>(
      `SELECT
         COUNT(*) as total,
         AVG(overall_rating) as avg_rating
       FROM consumer_reviews
       WHERE consumer_id = $1 AND status = 'published'`,
      [consumerId]
    );

    return {
      totalReviews: parseInt(result.rows[0].total, 10),
      averageRating: result.rows[0].avg_rating || 0,
    };
  }

  private async getRecentReviewsByConsumer(
    consumerId: string
  ): Promise<ConsumerReview[]> {
    const result = await this.pool.query(
      `SELECT * FROM consumer_reviews
       WHERE consumer_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [consumerId]
    );
    return result.rows;
  }

  private async updateBusinessRatings(businessProfileId: string): Promise<void> {
    // Update business_public_profiles with new ratings
    await this.pool.query(
      `UPDATE business_public_profiles bp
       SET
         overall_rating = COALESCE(summary.overall_rating, 0),
         rating_count = COALESCE(summary.total_reviews, 0),
         punctuality_rating = summary.punctuality_rating,
         quality_rating = summary.quality_rating,
         price_rating = summary.price_rating,
         communication_rating = summary.communication_rating,
         updated_at = NOW()
       FROM (
         SELECT
           business_profile_id,
           COUNT(*) as total_reviews,
           AVG(overall_rating) as overall_rating,
           AVG(punctuality_rating) as punctuality_rating,
           AVG(quality_rating) as quality_rating,
           AVG(price_rating) as price_rating,
           AVG(communication_rating) as communication_rating
         FROM consumer_reviews
         WHERE business_profile_id = $1 AND status = 'published'
         GROUP BY business_profile_id
       ) summary
       WHERE bp.id = $1`,
      [businessProfileId]
    );
  }
}
