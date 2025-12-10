/**
 * Fraud Detection Service
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Advanced fraud detection for consumer reviews.
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReviewInput {
  id: string;
  consumerId: string;
  businessProfileId: string;
  overallRating: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  comment?: string;
  photos?: string[];
  jobId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface FraudSignal {
  type: FraudSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  description: string;
  details?: Record<string, unknown>;
}

export type FraudSignalType =
  | 'velocity_consumer'
  | 'velocity_business'
  | 'velocity_ip'
  | 'text_similarity'
  | 'template_review'
  | 'device_fingerprint'
  | 'ip_cluster'
  | 'behavioral_anomaly'
  | 'rating_inconsistency'
  | 'rating_spike'
  | 'new_account_extreme'
  | 'spam_content'
  | 'unverified_transaction'
  | 'suspicious_timing';

export interface FraudAnalysis {
  reviewId: string;
  overallScore: number; // 0-100 (higher = more likely fraud)
  signals: FraudSignal[];
  recommendation: 'auto_approve' | 'manual_review' | 'auto_reject';
  confidenceLevel: 'high' | 'medium' | 'low';
  reasons: string[];
}

interface ConsumerStats {
  totalReviews: number;
  averageRating: number;
  accountAgeDays: number;
  recentReviewCount24h: number;
  recentReviewCount1h: number;
  uniqueBusinessesReviewed: number;
}

interface BusinessRatingStats {
  totalReviews: number;
  overallRating: number;
  recentReviewCount24h: number;
  recent5StarCount24h: number;
  recent1StarCount24h: number;
  ratingTrend: 'up' | 'down' | 'stable';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class FraudDetectionService {
  constructor(private pool: Pool) {}

  /**
   * Analyze a review for potential fraud
   */
  async analyzeReview(review: ReviewInput): Promise<FraudAnalysis> {
    const signals: FraudSignal[] = [];

    // Get consumer and business stats for analysis
    const [consumerStats, businessStats, recentTexts] = await Promise.all([
      this.getConsumerStats(review.consumerId),
      this.getBusinessRatingStats(review.businessProfileId),
      this.getRecentReviewTexts(review.businessProfileId),
    ]);

    // 1. Velocity checks
    const velocitySignals = await this.checkVelocity(review, consumerStats);
    signals.push(...velocitySignals);

    // 2. Text similarity check
    if (review.comment) {
      const textSignal = await this.checkTextSimilarity(review.comment, recentTexts);
      if (textSignal) signals.push(textSignal);
    }

    // 3. Device fingerprint check
    if (review.deviceFingerprint) {
      const deviceSignal = await this.checkDeviceFingerprint(
        review.deviceFingerprint,
        review.consumerId
      );
      if (deviceSignal) signals.push(deviceSignal);
    }

    // 4. IP cluster check
    if (review.ipAddress) {
      const ipSignal = await this.checkIPCluster(
        review.ipAddress,
        review.businessProfileId
      );
      if (ipSignal) signals.push(ipSignal);
    }

    // 5. Behavioral pattern check
    const behaviorSignal = this.checkBehavioralPattern(review, consumerStats);
    if (behaviorSignal) signals.push(behaviorSignal);

    // 6. Rating pattern check
    const ratingSignals = await this.checkRatingPatterns(
      review,
      consumerStats,
      businessStats
    );
    signals.push(...ratingSignals);

    // 7. Spam content check
    if (review.comment) {
      const spamSignal = this.checkSpamContent(review.comment);
      if (spamSignal) signals.push(spamSignal);
    }

    // 8. Timing anomaly check
    const timingSignal = await this.checkTimingAnomaly(review);
    if (timingSignal) signals.push(timingSignal);

    // Calculate overall score and recommendation
    const analysis = this.calculateAnalysis(review.id, signals);

    // Store fraud signals in database
    await this.storeFraudSignals(review.id, signals);

    return analysis;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VELOCITY CHECKS
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkVelocity(
    review: ReviewInput,
    stats: ConsumerStats
  ): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Consumer velocity - reviews in last hour
    if (stats.recentReviewCount1h >= 2) {
      signals.push({
        type: 'velocity_consumer',
        severity: stats.recentReviewCount1h >= 4 ? 'critical' : 'high',
        score: Math.min(stats.recentReviewCount1h * 20, 80),
        description: `${stats.recentReviewCount1h} reseñas en la última hora`,
        details: { reviewsInHour: stats.recentReviewCount1h },
      });
    }

    // Consumer velocity - reviews in last 24 hours
    if (stats.recentReviewCount24h >= 5) {
      signals.push({
        type: 'velocity_consumer',
        severity: 'medium',
        score: Math.min((stats.recentReviewCount24h - 4) * 10, 40),
        description: `${stats.recentReviewCount24h} reseñas en las últimas 24 horas`,
        details: { reviewsIn24h: stats.recentReviewCount24h },
      });
    }

    // Business velocity - check for review bombing
    const businessRecent = await this.getBusinessRecentReviewCount(
      review.businessProfileId,
      1
    );
    if (businessRecent >= 10) {
      const sameRatingCount = await this.getSameRatingCount(
        review.businessProfileId,
        review.overallRating,
        1
      );
      if (sameRatingCount >= 8) {
        signals.push({
          type: 'velocity_business',
          severity: 'high',
          score: 60,
          description: `Posible manipulación: ${sameRatingCount} reseñas con misma calificación en 1 hora`,
          details: { reviewCount: businessRecent, sameRatingCount },
        });
      }
    }

    // IP velocity check
    if (review.ipAddress) {
      const ipReviewCount = await this.getIPReviewCount(review.ipAddress, 24);
      if (ipReviewCount >= 3) {
        signals.push({
          type: 'velocity_ip',
          severity: ipReviewCount >= 5 ? 'high' : 'medium',
          score: Math.min(ipReviewCount * 15, 60),
          description: `${ipReviewCount} reseñas desde la misma IP en 24 horas`,
          details: { ipReviewCount },
        });
      }
    }

    return signals;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT SIMILARITY CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkTextSimilarity(
    comment: string,
    recentTexts: string[]
  ): Promise<FraudSignal | null> {
    if (!comment || comment.length < 20) return null;

    const normalizedComment = this.normalizeText(comment);

    for (const existing of recentTexts) {
      const normalizedExisting = this.normalizeText(existing);
      const similarity = this.calculateSimilarity(
        normalizedComment,
        normalizedExisting
      );

      if (similarity >= 0.85) {
        return {
          type: 'text_similarity',
          severity: 'high',
          score: Math.round(similarity * 70),
          description: `Texto muy similar a otra reseña reciente (${Math.round(similarity * 100)}% similitud)`,
          details: { similarity, matchedTextPreview: existing.slice(0, 100) },
        };
      }

      if (similarity >= 0.7) {
        return {
          type: 'text_similarity',
          severity: 'medium',
          score: Math.round(similarity * 50),
          description: `Texto similar a otra reseña (${Math.round(similarity * 100)}% similitud)`,
          details: { similarity },
        };
      }
    }

    // Check for template patterns
    const templatePatterns = [
      /excelente servicio.{0,20}recomiendo/i,
      /muy.{0,10}profesional.{0,20}puntual/i,
      /todo.{0,10}perfecto.{0,20}gracias/i,
      /pesimo.{0,10}servicio.{0,20}no recomiendo/i,
      /estafa.{0,10}no contraten/i,
    ];

    for (const pattern of templatePatterns) {
      if (pattern.test(comment)) {
        return {
          type: 'template_review',
          severity: 'low',
          score: 20,
          description: 'El texto parece seguir un patrón de plantilla',
          details: { pattern: pattern.source },
        };
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICE FINGERPRINT CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkDeviceFingerprint(
    fingerprint: string,
    consumerId: string
  ): Promise<FraudSignal | null> {
    // Check if this device has been used by multiple accounts
    const result = await this.pool.query<{ consumer_count: string; review_count: string }>(
      `SELECT
         COUNT(DISTINCT consumer_id) as consumer_count,
         COUNT(*) as review_count
       FROM consumer_reviews
       WHERE device_fingerprint = $1
         AND consumer_id != $2
         AND created_at > NOW() - INTERVAL '30 days'`,
      [fingerprint, consumerId]
    );

    const { consumer_count, review_count } = result.rows[0];
    const consumerCount = parseInt(consumer_count, 10);
    const reviewCount = parseInt(review_count, 10);

    if (consumerCount >= 2) {
      return {
        type: 'device_fingerprint',
        severity: consumerCount >= 5 ? 'critical' : 'high',
        score: Math.min(consumerCount * 20, 80),
        description: `Dispositivo usado por ${consumerCount} cuentas diferentes`,
        details: { consumerCount, reviewCount },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IP CLUSTER CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkIPCluster(
    ipAddress: string,
    businessProfileId: string
  ): Promise<FraudSignal | null> {
    // Check for multiple reviews from same IP/subnet for same business
    const ipPrefix = ipAddress.split('.').slice(0, 3).join('.');

    const result = await this.pool.query<{ review_count: string; consumer_count: string }>(
      `SELECT
         COUNT(*) as review_count,
         COUNT(DISTINCT consumer_id) as consumer_count
       FROM consumer_reviews
       WHERE business_profile_id = $1
         AND ip_address LIKE $2
         AND created_at > NOW() - INTERVAL '7 days'`,
      [businessProfileId, `${ipPrefix}.%`]
    );

    const { review_count, consumer_count } = result.rows[0];
    const reviewCount = parseInt(review_count, 10);
    const consumerCount = parseInt(consumer_count, 10);

    if (reviewCount >= 3 && consumerCount >= 2) {
      return {
        type: 'ip_cluster',
        severity: reviewCount >= 5 ? 'high' : 'medium',
        score: Math.min(reviewCount * 15, 60),
        description: `${reviewCount} reseñas de ${consumerCount} cuentas desde la misma red`,
        details: { ipPrefix, reviewCount, consumerCount },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIORAL PATTERN CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private checkBehavioralPattern(
    review: ReviewInput,
    stats: ConsumerStats
  ): FraudSignal | null {
    // New account with extreme rating
    if (stats.accountAgeDays < 7 && stats.totalReviews < 3) {
      if (review.overallRating === 1 || review.overallRating === 5) {
        return {
          type: 'new_account_extreme',
          severity: 'medium',
          score: 25,
          description: `Cuenta nueva (${stats.accountAgeDays} días) con calificación extrema`,
          details: {
            accountAgeDays: stats.accountAgeDays,
            totalReviews: stats.totalReviews,
            rating: review.overallRating,
          },
        };
      }
    }

    // Review without verified transaction
    if (!review.jobId) {
      // Check if consumer has had any interaction with business
      return {
        type: 'unverified_transaction',
        severity: 'low',
        score: 15,
        description: 'Reseña sin trabajo verificado asociado',
        details: { hasJob: false },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATING PATTERN CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkRatingPatterns(
    review: ReviewInput,
    consumerStats: ConsumerStats,
    businessStats: BusinessRatingStats
  ): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check for rating inconsistency within the review
    if (
      review.punctualityRating &&
      review.qualityRating &&
      review.priceRating &&
      review.communicationRating
    ) {
      const ratings = [
        review.punctualityRating,
        review.qualityRating,
        review.priceRating,
        review.communicationRating,
      ];
      const avg =
        ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const maxDiff = Math.max(...ratings.map((r) => Math.abs(r - avg)));

      if (Math.abs(review.overallRating - avg) > 2) {
        signals.push({
          type: 'rating_inconsistency',
          severity: 'medium',
          score: 30,
          description: 'Calificación general inconsistente con calificaciones detalladas',
          details: {
            overallRating: review.overallRating,
            averageDetail: avg.toFixed(1),
          },
        });
      }
    }

    // Check for rating spike on business
    if (
      businessStats.totalReviews >= 10 &&
      businessStats.recentReviewCount24h >= 5
    ) {
      const recentRate =
        businessStats.recent5StarCount24h / businessStats.recentReviewCount24h;
      if (recentRate >= 0.9 && review.overallRating === 5) {
        signals.push({
          type: 'rating_spike',
          severity: 'high',
          score: 50,
          description: `${Math.round(recentRate * 100)}% de reseñas recientes son 5 estrellas`,
          details: {
            recent24h: businessStats.recentReviewCount24h,
            recent5Star: businessStats.recent5StarCount24h,
          },
        });
      }

      // Check for attack pattern (all 1-star)
      const recentLowRate =
        businessStats.recent1StarCount24h / businessStats.recentReviewCount24h;
      if (recentLowRate >= 0.8 && review.overallRating === 1) {
        signals.push({
          type: 'rating_spike',
          severity: 'critical',
          score: 70,
          description: `Posible ataque: ${Math.round(recentLowRate * 100)}% de reseñas recientes son 1 estrella`,
          details: {
            recent24h: businessStats.recentReviewCount24h,
            recent1Star: businessStats.recent1StarCount24h,
          },
        });
      }
    }

    return signals;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPAM CONTENT CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private checkSpamContent(comment: string): FraudSignal | null {
    const spamIndicators: Array<{ pattern: RegExp; score: number; desc: string }> = [
      { pattern: /https?:\/\//i, score: 40, desc: 'Contiene URL' },
      { pattern: /\b(whatsapp|telegram|contactar?me)\b/i, score: 30, desc: 'Solicita contacto externo' },
      { pattern: /\b(gratis|regalo|sorteo|promo|descuento\s+\d+%)\b/i, score: 35, desc: 'Contenido promocional' },
      { pattern: /(.)\1{5,}/i, score: 25, desc: 'Caracteres repetidos excesivamente' },
      { pattern: /[A-Z]{10,}/i, score: 20, desc: 'Exceso de mayúsculas' },
      { pattern: /[!?]{3,}/i, score: 15, desc: 'Exceso de signos de exclamación/interrogación' },
      { pattern: /\b(mejor|peor)\s+(que|de)\s+todos?\b/i, score: 10, desc: 'Comparación extrema genérica' },
    ];

    let totalScore = 0;
    const matchedPatterns: string[] = [];

    for (const { pattern, score, desc } of spamIndicators) {
      if (pattern.test(comment)) {
        totalScore += score;
        matchedPatterns.push(desc);
      }
    }

    if (totalScore >= 30) {
      return {
        type: 'spam_content',
        severity: totalScore >= 60 ? 'high' : 'medium',
        score: Math.min(totalScore, 80),
        description: 'Posible contenido spam detectado',
        details: { indicators: matchedPatterns, totalScore },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING ANOMALY CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkTimingAnomaly(review: ReviewInput): Promise<FraudSignal | null> {
    if (!review.jobId) return null;

    // Check time between job completion and review
    const result = await this.pool.query<{ completed_at: string }>(
      `SELECT completed_at FROM jobs WHERE id = $1`,
      [review.jobId]
    );

    if (!result.rows[0]?.completed_at) return null;

    const completedAt = new Date(result.rows[0].completed_at);
    const now = new Date();
    const hoursSinceCompletion =
      (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

    // Review immediately after job (< 5 minutes)
    if (hoursSinceCompletion < 0.083) {
      return {
        type: 'suspicious_timing',
        severity: 'medium',
        score: 25,
        description: 'Reseña enviada muy rápido después del trabajo',
        details: { minutesAfterJob: Math.round(hoursSinceCompletion * 60) },
      };
    }

    // Review way after job (> 90 days)
    if (hoursSinceCompletion > 2160) {
      return {
        type: 'suspicious_timing',
        severity: 'low',
        score: 15,
        description: 'Reseña enviada mucho tiempo después del trabajo',
        details: { daysAfterJob: Math.round(hoursSinceCompletion / 24) },
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSIS CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateAnalysis(reviewId: string, signals: FraudSignal[]): FraudAnalysis {
    // Calculate weighted overall score
    const severityWeights: Record<string, number> = {
      critical: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.7,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = severityWeights[signal.severity];
      weightedSum += signal.score * weight;
      totalWeight += weight;
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Determine recommendation
    let recommendation: FraudAnalysis['recommendation'];
    let confidenceLevel: FraudAnalysis['confidenceLevel'];
    const reasons: string[] = [];

    const hasCritical = signals.some((s) => s.severity === 'critical');
    const hasMultipleHigh = signals.filter((s) => s.severity === 'high').length >= 2;

    if (overallScore >= 70 || hasCritical) {
      recommendation = 'auto_reject';
      confidenceLevel = 'high';
      reasons.push('Alto riesgo de fraude detectado');
    } else if (overallScore >= 40 || hasMultipleHigh) {
      recommendation = 'manual_review';
      confidenceLevel = 'medium';
      reasons.push('Señales de riesgo moderado requieren revisión');
    } else if (overallScore >= 20) {
      recommendation = 'manual_review';
      confidenceLevel = 'low';
      reasons.push('Algunas señales menores detectadas');
    } else {
      recommendation = 'auto_approve';
      confidenceLevel = 'high';
      reasons.push('Sin señales significativas de fraude');
    }

    // Add signal descriptions to reasons
    for (const signal of signals) {
      if (signal.severity !== 'low') {
        reasons.push(signal.description);
      }
    }

    return {
      reviewId,
      overallScore,
      signals,
      recommendation,
      confidenceLevel,
      reasons,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getConsumerStats(consumerId: string): Promise<ConsumerStats> {
    const result = await this.pool.query<{
      total_reviews: string;
      avg_rating: number;
      account_age_days: number;
      recent_24h: string;
      recent_1h: string;
      unique_businesses: string;
    }>(
      `SELECT
         COUNT(cr.*) as total_reviews,
         AVG(cr.overall_rating) as avg_rating,
         EXTRACT(DAY FROM NOW() - cp.created_at) as account_age_days,
         COUNT(*) FILTER (WHERE cr.created_at > NOW() - INTERVAL '24 hours') as recent_24h,
         COUNT(*) FILTER (WHERE cr.created_at > NOW() - INTERVAL '1 hour') as recent_1h,
         COUNT(DISTINCT cr.business_profile_id) as unique_businesses
       FROM consumer_profiles cp
       LEFT JOIN consumer_reviews cr ON cp.id = cr.consumer_id
       WHERE cp.id = $1
       GROUP BY cp.id, cp.created_at`,
      [consumerId]
    );

    if (result.rows.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        accountAgeDays: 0,
        recentReviewCount24h: 0,
        recentReviewCount1h: 0,
        uniqueBusinessesReviewed: 0,
      };
    }

    const row = result.rows[0];
    return {
      totalReviews: parseInt(row.total_reviews, 10),
      averageRating: row.avg_rating || 0,
      accountAgeDays: Math.floor(row.account_age_days || 0),
      recentReviewCount24h: parseInt(row.recent_24h, 10),
      recentReviewCount1h: parseInt(row.recent_1h, 10),
      uniqueBusinessesReviewed: parseInt(row.unique_businesses, 10),
    };
  }

  private async getBusinessRatingStats(
    businessProfileId: string
  ): Promise<BusinessRatingStats> {
    const result = await this.pool.query<{
      total_reviews: string;
      overall_rating: number;
      recent_24h: string;
      recent_5star: string;
      recent_1star: string;
      recent_avg: number;
      prev_avg: number;
    }>(
      `SELECT
         COUNT(*) as total_reviews,
         AVG(overall_rating) as overall_rating,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND overall_rating = 5) as recent_5star,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND overall_rating = 1) as recent_1star,
         AVG(overall_rating) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as recent_avg,
         AVG(overall_rating) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days') as prev_avg
       FROM consumer_reviews
       WHERE business_profile_id = $1 AND status = 'published'`,
      [businessProfileId]
    );

    const row = result.rows[0];
    const recentAvg = row.recent_avg || 0;
    const prevAvg = row.prev_avg || recentAvg;

    let ratingTrend: 'up' | 'down' | 'stable' = 'stable';
    if (recentAvg > prevAvg + 0.3) ratingTrend = 'up';
    else if (recentAvg < prevAvg - 0.3) ratingTrend = 'down';

    return {
      totalReviews: parseInt(row.total_reviews, 10),
      overallRating: row.overall_rating || 0,
      recentReviewCount24h: parseInt(row.recent_24h, 10),
      recent5StarCount24h: parseInt(row.recent_5star, 10),
      recent1StarCount24h: parseInt(row.recent_1star, 10),
      ratingTrend,
    };
  }

  private async getRecentReviewTexts(businessProfileId: string): Promise<string[]> {
    const result = await this.pool.query<{ comment: string }>(
      `SELECT comment FROM consumer_reviews
       WHERE business_profile_id = $1
         AND comment IS NOT NULL
         AND LENGTH(comment) > 20
         AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 50`,
      [businessProfileId]
    );
    return result.rows.map((r) => r.comment);
  }

  private async getBusinessRecentReviewCount(
    businessProfileId: string,
    hours: number
  ): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM consumer_reviews
       WHERE business_profile_id = $1
         AND created_at > NOW() - INTERVAL '${hours} hours'`,
      [businessProfileId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private async getSameRatingCount(
    businessProfileId: string,
    rating: number,
    hours: number
  ): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM consumer_reviews
       WHERE business_profile_id = $1
         AND overall_rating = $2
         AND created_at > NOW() - INTERVAL '${hours} hours'`,
      [businessProfileId, rating]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private async getIPReviewCount(ipAddress: string, hours: number): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM consumer_reviews
       WHERE ip_address = $1
         AND created_at > NOW() - INTERVAL '${hours} hours'`,
      [ipAddress]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Jaccard similarity based on word trigrams
    const trigrams1 = this.getTrigrams(text1);
    const trigrams2 = this.getTrigrams(text2);

    if (trigrams1.size === 0 || trigrams2.size === 0) return 0;

    const intersection = new Set([...trigrams1].filter((x) => trigrams2.has(x)));
    const union = new Set([...trigrams1, ...trigrams2]);

    return intersection.size / union.size;
  }

  private getTrigrams(text: string): Set<string> {
    const words = text.split(' ');
    const trigrams = new Set<string>();

    for (let i = 0; i < words.length - 2; i++) {
      trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return trigrams;
  }

  private async storeFraudSignals(
    reviewId: string,
    signals: FraudSignal[]
  ): Promise<void> {
    if (signals.length === 0) return;

    const values = signals.map((signal, index) => {
      const offset = index * 4;
      return `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    });

    const params: unknown[] = [reviewId];
    for (const signal of signals) {
      params.push(
        signal.type,
        signal.score / 100,
        JSON.stringify({ severity: signal.severity, description: signal.description, ...signal.details }),
        'automated'
      );
    }

    await this.pool.query(
      `INSERT INTO review_fraud_signals (review_id, signal_type, signal_score, signal_details, detected_by)
       VALUES ${values.join(', ')}`,
      params
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION QUEUE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get moderation queue items with fraud analysis
   */
  async getModerationQueue(options?: {
    limit?: number;
    offset?: number;
    minFraudScore?: number;
    status?: string;
  }): Promise<{
    items: Array<{
      id: string;
      reviewId: string;
      fraudScore: number;
      fraudSignals: FraudSignal[];
      priority: number;
      queueReason: string;
      queuedAt: string;
      review: {
        consumerId: string;
        consumerName: string;
        businessProfileId: string;
        businessName: string;
        overallRating: number;
        comment?: string;
        photos: string[];
        createdAt: string;
      };
    }>;
    total: number;
  }> {
    const { limit = 20, offset = 0, minFraudScore, status = 'pending' } = options || {};

    let whereClause = 'WHERE rmq.is_processed = false';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status !== 'all') {
      whereClause = 'WHERE rmq.is_processed = $1';
      params.push(status === 'pending' ? false : true);
      paramIndex++;
    }

    if (minFraudScore !== undefined) {
      whereClause += ` AND rmq.fraud_score >= $${paramIndex++}`;
      params.push(minFraudScore / 100);
    }

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM review_moderation_queue rmq ${whereClause}`,
      params
    );

    const result = await this.pool.query(
      `SELECT
         rmq.*,
         cr.consumer_id,
         cr.business_profile_id,
         cr.overall_rating,
         cr.comment,
         cr.photo_urls,
         cr.created_at as review_created_at,
         cp.display_name as consumer_name,
         bp.display_name as business_name
       FROM review_moderation_queue rmq
       JOIN consumer_reviews cr ON rmq.review_id = cr.id
       JOIN consumer_profiles cp ON cr.consumer_id = cp.id
       JOIN business_public_profiles bp ON cr.business_profile_id = bp.id
       ${whereClause}
       ORDER BY rmq.priority DESC, rmq.fraud_score DESC, rmq.queued_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        reviewId: row.review_id,
        fraudScore: Math.round((row.fraud_score || 0) * 100),
        fraudSignals: row.fraud_signals || [],
        priority: row.priority,
        queueReason: row.queue_reason,
        queuedAt: row.queued_at,
        review: {
          consumerId: row.consumer_id,
          consumerName: row.consumer_name,
          businessProfileId: row.business_profile_id,
          businessName: row.business_name,
          overallRating: row.overall_rating,
          comment: row.comment,
          photos: row.photo_urls || [],
          createdAt: row.review_created_at,
        },
      })),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processed: number;
    highRisk: number;
    approvedToday: number;
    rejectedToday: number;
  }> {
    const result = await this.pool.query<{
      pending: string;
      processed: string;
      high_risk: string;
      approved_today: string;
      rejected_today: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE is_processed = false) as pending,
         COUNT(*) FILTER (WHERE is_processed = true) as processed,
         COUNT(*) FILTER (WHERE is_processed = false AND fraud_score >= 0.6) as high_risk,
         COUNT(*) FILTER (WHERE is_processed = true AND decision = 'approved' AND processed_at > CURRENT_DATE) as approved_today,
         COUNT(*) FILTER (WHERE is_processed = true AND decision = 'rejected' AND processed_at > CURRENT_DATE) as rejected_today
       FROM review_moderation_queue`
    );

    const row = result.rows[0];
    return {
      pending: parseInt(row.pending, 10),
      processed: parseInt(row.processed, 10),
      highRisk: parseInt(row.high_risk, 10),
      approvedToday: parseInt(row.approved_today, 10),
      rejectedToday: parseInt(row.rejected_today, 10),
    };
  }
}
