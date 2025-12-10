/**
 * Badge Service
 * =============
 *
 * Business badge calculation and management.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import { BusinessBadge } from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BadgeCriteria {
  badge: BusinessBadge;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string;
  check: (metrics: BusinessMetrics) => boolean;
}

export interface BusinessMetrics {
  overallRating: number;
  ratingCount: number;
  totalJobsCompleted: number;
  avgResponseTimeHours: number;
  yearsOnPlatform: number;
  cuitVerified: boolean;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  backgroundCheckVerified: boolean;
  profileCompleteness: number;
  acceptsEmergency: boolean;
  monthlyActiveQuotes: number;
  responseRate: number;
  completionRate: number;
  lastActiveAt: Date | null;
}

export interface BadgeInfo {
  badge: BusinessBadge;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string;
  earnedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE CRITERIA
// ═══════════════════════════════════════════════════════════════════════════════

export const BADGE_CRITERIA: BadgeCriteria[] = [
  {
    badge: 'verified',
    name: 'Verified Business',
    nameEs: 'Negocio Verificado',
    description: 'Business identity and credentials have been verified',
    descriptionEs: 'Identidad y credenciales del negocio verificadas',
    icon: '✓',
    check: (m) => m.cuitVerified,
  },
  {
    badge: 'top_rated',
    name: 'Top Rated',
    nameEs: 'Mejor Calificado',
    description: 'Maintains excellent ratings from customers',
    descriptionEs: 'Mantiene calificaciones excelentes de clientes',
    icon: '★',
    check: (m) => m.overallRating >= 4.5 && m.ratingCount >= 10,
  },
  {
    badge: 'fast_responder',
    name: 'Fast Responder',
    nameEs: 'Respuesta Rápida',
    description: 'Consistently responds to quotes quickly',
    descriptionEs: 'Responde consistentemente rápido a cotizaciones',
    icon: '⚡',
    check: (m) => m.avgResponseTimeHours <= 2 && m.responseRate >= 0.8,
  },
  {
    badge: 'highly_reviewed',
    name: 'Highly Reviewed',
    nameEs: 'Muy Reseñado',
    description: 'Has received many positive reviews',
    descriptionEs: 'Ha recibido muchas reseñas positivas',
    icon: '💬',
    check: (m) => m.ratingCount >= 50 && m.overallRating >= 4.0,
  },
  {
    badge: 'experienced',
    name: 'Experienced Pro',
    nameEs: 'Profesional Experimentado',
    description: 'Long track record on the platform',
    descriptionEs: 'Larga trayectoria en la plataforma',
    icon: '🏆',
    check: (m) => m.yearsOnPlatform >= 2 && m.totalJobsCompleted >= 50,
  },
  {
    badge: 'emergency_available',
    name: 'Emergency Available',
    nameEs: 'Disponible Emergencias',
    description: 'Available for urgent service requests',
    descriptionEs: 'Disponible para solicitudes urgentes',
    icon: '🚨',
    check: (m) => m.acceptsEmergency,
  },
  {
    badge: 'insured',
    name: 'Insured',
    nameEs: 'Asegurado',
    description: 'Has verified insurance coverage',
    descriptionEs: 'Cuenta con seguro verificado',
    icon: '🛡️',
    check: (m) => m.insuranceVerified,
  },
  {
    badge: 'licensed',
    name: 'Licensed',
    nameEs: 'Habilitado',
    description: 'Has verified professional license',
    descriptionEs: 'Cuenta con habilitación profesional verificada',
    icon: '📜',
    check: (m) => m.licenseVerified,
  },
  {
    badge: 'background_checked',
    name: 'Background Checked',
    nameEs: 'Antecedentes Verificados',
    description: 'Has passed background verification',
    descriptionEs: 'Pasó verificación de antecedentes',
    icon: '🔍',
    check: (m) => m.backgroundCheckVerified,
  },
  {
    badge: 'new_on_platform',
    name: 'New on Platform',
    nameEs: 'Nuevo en la Plataforma',
    description: 'Recently joined the marketplace',
    descriptionEs: 'Se unió recientemente al marketplace',
    icon: '🆕',
    check: (m) => m.yearsOnPlatform < 0.5 && m.profileCompleteness >= 80,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class BadgeService {
  constructor(private pool: Pool) {}

  /**
   * Calculate badges for a business based on metrics
   */
  calculateBadges(metrics: BusinessMetrics): BusinessBadge[] {
    return BADGE_CRITERIA
      .filter(criteria => criteria.check(metrics))
      .map(criteria => criteria.badge);
  }

  /**
   * Get badge information
   */
  getBadgeInfo(badge: BusinessBadge): BadgeInfo | null {
    const criteria = BADGE_CRITERIA.find(c => c.badge === badge);
    if (!criteria) return null;

    return {
      badge: criteria.badge,
      name: criteria.name,
      nameEs: criteria.nameEs,
      description: criteria.description,
      descriptionEs: criteria.descriptionEs,
      icon: criteria.icon,
    };
  }

  /**
   * Get all badge information
   */
  getAllBadgeInfo(): BadgeInfo[] {
    return BADGE_CRITERIA.map(criteria => ({
      badge: criteria.badge,
      name: criteria.name,
      nameEs: criteria.nameEs,
      description: criteria.description,
      descriptionEs: criteria.descriptionEs,
      icon: criteria.icon,
    }));
  }

  /**
   * Update badges for a business profile
   */
  async updateBusinessBadges(profileId: string): Promise<BusinessBadge[]> {
    // Get business metrics
    const metrics = await this.getBusinessMetrics(profileId);

    // Calculate new badges
    const badges = this.calculateBadges(metrics);

    // Update in database
    await this.pool.query(
      `UPDATE business_public_profiles
       SET badges = $2, updated_at = NOW()
       WHERE id = $1`,
      [profileId, badges]
    );

    return badges;
  }

  /**
   * Get business metrics for badge calculation
   */
  async getBusinessMetrics(profileId: string): Promise<BusinessMetrics> {
    const result = await this.pool.query<{
      overall_rating: number;
      rating_count: number;
      total_jobs_completed: number;
      avg_response_time_hours: number;
      years_on_platform: number;
      cuit_verified: boolean;
      license_verified: boolean;
      insurance_verified: boolean;
      background_check_verified: boolean;
      profile_completeness: number;
      accepts_emergency: boolean;
      monthly_active_quotes: number;
      response_rate: number;
      completion_rate: number;
      last_active_at: Date | null;
    }>(
      `SELECT
         bp.overall_rating,
         bp.rating_count,
         bp.total_jobs_completed,
         bp.avg_response_time_hours,
         EXTRACT(YEAR FROM AGE(NOW(), bp.created_at))::int as years_on_platform,
         bp.cuit_verified,
         bp.license_verified,
         bp.insurance_verified,
         bp.background_check_verified,
         bp.profile_completeness,
         bp.accepts_emergency,
         COALESCE(quote_stats.monthly_quotes, 0) as monthly_active_quotes,
         COALESCE(quote_stats.response_rate, 0) as response_rate,
         COALESCE(quote_stats.completion_rate, 0) as completion_rate,
         bp.updated_at as last_active_at
       FROM business_public_profiles bp
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as monthly_quotes,
           AVG(CASE WHEN status != 'pending' THEN 1.0 ELSE 0.0 END) as response_rate,
           AVG(CASE WHEN status = 'accepted' THEN 1.0 ELSE 0.0 END) as completion_rate
         FROM business_quotes
         WHERE business_profile_id = bp.id
       ) quote_stats ON true
       WHERE bp.id = $1`,
      [profileId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Business profile not found: ${profileId}`);
    }

    const row = result.rows[0];
    return {
      overallRating: row.overall_rating || 0,
      ratingCount: row.rating_count || 0,
      totalJobsCompleted: row.total_jobs_completed || 0,
      avgResponseTimeHours: row.avg_response_time_hours || 24,
      yearsOnPlatform: row.years_on_platform || 0,
      cuitVerified: row.cuit_verified || false,
      licenseVerified: row.license_verified || false,
      insuranceVerified: row.insurance_verified || false,
      backgroundCheckVerified: row.background_check_verified || false,
      profileCompleteness: row.profile_completeness || 0,
      acceptsEmergency: row.accepts_emergency || false,
      monthlyActiveQuotes: row.monthly_active_quotes || 0,
      responseRate: row.response_rate || 0,
      completionRate: row.completion_rate || 0,
      lastActiveAt: row.last_active_at,
    };
  }

  /**
   * Batch update badges for all businesses
   */
  async updateAllBusinessBadges(): Promise<{ updated: number; errors: number }> {
    const profiles = await this.pool.query<{ id: string }>(
      `SELECT id FROM business_public_profiles WHERE is_active = true`
    );

    let updated = 0;
    let errors = 0;

    for (const profile of profiles.rows) {
      try {
        await this.updateBusinessBadges(profile.id);
        updated++;
      } catch (error) {
        console.error(`Failed to update badges for ${profile.id}:`, error);
        errors++;
      }
    }

    return { updated, errors };
  }
}
