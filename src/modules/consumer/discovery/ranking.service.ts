/**
 * Ranking Service
 * ===============
 *
 * Business ranking algorithm for search results.
 * Phase 15: Consumer Marketplace
 */

import {
  BusinessPublicProfile,
  BusinessRankingFactors,
  ServiceCategory,
} from '../consumer.types';
import {
  RankingWeights,
  DEFAULT_RANKING_WEIGHTS,
  RankedBusiness,
} from './discovery.types';

// ═══════════════════════════════════════════════════════════════════════════════
// RANKING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class RankingService {
  private weights: RankingWeights;

  constructor(weights: RankingWeights = DEFAULT_RANKING_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate ranking score for a business
   */
  calculateScore(
    business: BusinessPublicProfile,
    context: {
      consumerLat?: number;
      consumerLng?: number;
      requestedCategory?: ServiceCategory;
      requestedUrgency?: string;
    } = {}
  ): RankedBusiness {
    const factors = this.extractFactors(business, context);
    const breakdown = this.calculateBreakdown(factors);

    const score =
      breakdown.ratingScore * this.weights.rating +
      breakdown.activityScore * this.weights.activity +
      breakdown.qualityScore * this.weights.quality +
      breakdown.relevanceScore * this.weights.relevance;

    return {
      business,
      score,
      factors,
      breakdown,
    };
  }

  /**
   * Rank multiple businesses
   */
  rankBusinesses(
    businesses: BusinessPublicProfile[],
    context: {
      consumerLat?: number;
      consumerLng?: number;
      requestedCategory?: ServiceCategory;
      requestedUrgency?: string;
    } = {}
  ): RankedBusiness[] {
    return businesses
      .map(business => this.calculateScore(business, context))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Extract ranking factors from business profile
   */
  private extractFactors(
    business: BusinessPublicProfile,
    context: {
      consumerLat?: number;
      consumerLng?: number;
      requestedCategory?: ServiceCategory;
      requestedUrgency?: string;
    }
  ): BusinessRankingFactors {
    // Calculate distance if coordinates provided
    let distance = 0;
    if (
      context.consumerLat !== undefined &&
      context.consumerLng !== undefined &&
      business.serviceAreas.length > 0
    ) {
      // Use first service area as business location (simplified)
      // In production, you'd use the business's actual location
      const businessLat = business.serviceAreas[0]?.neighborhood ? -34.6037 : -34.6037; // Default BA
      const businessLng = business.serviceAreas[0]?.neighborhood ? -58.3816 : -58.3816;
      distance = this.calculateDistance(
        context.consumerLat,
        context.consumerLng,
        businessLat,
        businessLng
      );
    }

    // Calculate service match
    let serviceMatch = 0.5; // Default
    if (context.requestedCategory && business.categories.includes(context.requestedCategory)) {
      serviceMatch = 1.0;
    } else if (context.requestedCategory) {
      serviceMatch = 0.2;
    }

    // Calculate availability match based on urgency
    let availabilityMatch = 0.5;
    if (context.requestedUrgency === 'emergency' && business.acceptsEmergency) {
      availabilityMatch = 1.0;
    } else if (business.acceptingNewClients) {
      availabilityMatch = 0.8;
    }

    // Calculate verified review percentage (simplified)
    const verifiedReviewPercentage = business.ratingCount > 0 ? 0.7 : 0; // Assume 70% verified

    return {
      averageRating: business.overallRating,
      totalReviews: business.ratingCount,
      recentReviewTrend: 0, // Would need historical data
      verifiedReviewPercentage,
      responseTime: business.avgResponseTimeHours || 24,
      acceptanceRate: business.quoteAcceptanceRate || 0.5,
      completionRate: 0.95, // Would need job completion data
      lastActiveAt: business.lastActiveAt,
      profileCompleteness: business.profileCompleteness / 100,
      licenseVerified: business.licenseVerified,
      insuranceVerified: business.insuranceVerified,
      yearsInBusiness: business.yearsOnPlatform,
      distanceToConsumer: distance,
      serviceMatch,
      availabilityMatch,
    };
  }

  /**
   * Calculate score breakdown
   */
  private calculateBreakdown(factors: BusinessRankingFactors): {
    ratingScore: number;
    activityScore: number;
    qualityScore: number;
    relevanceScore: number;
  } {
    // Rating score (0-1)
    const ratingScore = this.calculateRatingScore(factors);

    // Activity score (0-1)
    const activityScore = this.calculateActivityScore(factors);

    // Quality score (0-1)
    const qualityScore = this.calculateQualityScore(factors);

    // Relevance score (0-1)
    const relevanceScore = this.calculateRelevanceScore(factors);

    return {
      ratingScore,
      activityScore,
      qualityScore,
      relevanceScore,
    };
  }

  /**
   * Calculate rating component score
   * 40% weight typically
   */
  private calculateRatingScore(factors: BusinessRankingFactors): number {
    // Rating normalized (1-5 → 0-1)
    const ratingNormalized = (factors.averageRating - 1) / 4;

    // Review count factor (more reviews = more trust, diminishing returns)
    // Max out at 50 reviews
    const reviewCountFactor = Math.min(factors.totalReviews / 50, 1);

    // Verified review bonus
    const verifiedBonus = factors.verifiedReviewPercentage;

    // Combine: 50% rating, 30% review count, 20% verified
    return ratingNormalized * 0.5 + reviewCountFactor * 0.3 + verifiedBonus * 0.2;
  }

  /**
   * Calculate activity component score
   * 25% weight typically
   */
  private calculateActivityScore(factors: BusinessRankingFactors): number {
    // Response time factor (faster = better, max penalty at 24+ hours)
    const responseTimeFactor = Math.max(0, 1 - factors.responseTime / 24);

    // Acceptance rate
    const acceptanceRate = factors.acceptanceRate;

    // Completion rate
    const completionRate = factors.completionRate;

    // Last active recency (within 7 days = 1.0, decays after)
    const daysSinceActive = Math.max(
      0,
      (Date.now() - new Date(factors.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyFactor = Math.max(0, 1 - daysSinceActive / 30);

    // Combine: 40% response time, 30% acceptance, 20% completion, 10% recency
    return (
      responseTimeFactor * 0.4 +
      acceptanceRate * 0.3 +
      completionRate * 0.2 +
      recencyFactor * 0.1
    );
  }

  /**
   * Calculate quality component score
   * 20% weight typically
   */
  private calculateQualityScore(factors: BusinessRankingFactors): number {
    // Profile completeness
    const completeness = factors.profileCompleteness;

    // Verification bonuses
    const licenseBonus = factors.licenseVerified ? 0.3 : 0;
    const insuranceBonus = factors.insuranceVerified ? 0.3 : 0;

    // Experience factor (years on platform, max at 5 years)
    const experienceFactor = Math.min(factors.yearsInBusiness / 5, 1);

    // Combine: 40% completeness, 30% license, 20% insurance, 10% experience
    return completeness * 0.4 + licenseBonus + insuranceBonus + experienceFactor * 0.1;
  }

  /**
   * Calculate relevance component score
   * 15% weight typically
   */
  private calculateRelevanceScore(factors: BusinessRankingFactors): number {
    // Distance factor (closer = better, max at 20km)
    const maxDistance = 20; // km
    const distanceFactor = Math.max(0, 1 - factors.distanceToConsumer / maxDistance);

    // Service match (exact category match = 1.0)
    const serviceMatch = factors.serviceMatch;

    // Availability match
    const availabilityMatch = factors.availabilityMatch;

    // Combine: 50% distance, 30% service match, 20% availability
    return distanceFactor * 0.5 + serviceMatch * 0.3 + availabilityMatch * 0.2;
  }

  /**
   * Calculate Haversine distance between two points
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Apply boost factors for featured or promoted businesses
   */
  applyBoosts(
    rankedBusinesses: RankedBusiness[],
    boosts: { businessId: string; boostFactor: number }[]
  ): RankedBusiness[] {
    const boostMap = new Map(boosts.map(b => [b.businessId, b.boostFactor]));

    return rankedBusinesses
      .map(ranked => {
        const boost = boostMap.get(ranked.business.id);
        if (boost) {
          return {
            ...ranked,
            score: ranked.score * boost,
          };
        }
        return ranked;
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get ranking explanation for transparency
   */
  explainRanking(rankedBusiness: RankedBusiness): string[] {
    const explanations: string[] = [];
    const { factors, breakdown } = rankedBusiness;

    // Rating explanation
    if (factors.averageRating >= 4.5) {
      explanations.push(`Excelente valoración (${factors.averageRating.toFixed(1)} estrellas)`);
    } else if (factors.averageRating >= 4.0) {
      explanations.push(`Muy buena valoración (${factors.averageRating.toFixed(1)} estrellas)`);
    }

    // Review count
    if (factors.totalReviews >= 50) {
      explanations.push(`Más de ${factors.totalReviews} opiniones verificadas`);
    } else if (factors.totalReviews >= 20) {
      explanations.push(`${factors.totalReviews} opiniones`);
    }

    // Response time
    if (factors.responseTime <= 1) {
      explanations.push('Responde en menos de 1 hora');
    } else if (factors.responseTime <= 4) {
      explanations.push('Responde rápidamente');
    }

    // Verifications
    if (factors.licenseVerified) {
      explanations.push('Matrícula verificada');
    }
    if (factors.insuranceVerified) {
      explanations.push('Seguro verificado');
    }

    // Distance
    if (factors.distanceToConsumer > 0 && factors.distanceToConsumer <= 5) {
      explanations.push(`A ${factors.distanceToConsumer.toFixed(1)} km de distancia`);
    }

    return explanations;
  }
}
