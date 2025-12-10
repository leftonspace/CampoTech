/**
 * Verification Service
 * ====================
 *
 * Business verification and trust score management.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VerificationType =
  | 'cuit'
  | 'license'
  | 'insurance'
  | 'background_check'
  | 'address'
  | 'bank_account'
  | 'identity';

export type VerificationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface VerificationRequest {
  id: string;
  businessProfileId: string;
  verificationType: VerificationType;
  status: VerificationStatus;
  documentUrl?: string;
  documentNumber?: string;
  expirationDate?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerificationInput {
  businessProfileId: string;
  verificationType: VerificationType;
  documentUrl?: string;
  documentNumber?: string;
  expirationDate?: Date;
  metadata?: Record<string, any>;
}

export interface TrustScore {
  overall: number;
  components: {
    verifications: number;
    reviews: number;
    activity: number;
    tenure: number;
    compliance: number;
  };
  level: 'new' | 'basic' | 'verified' | 'trusted' | 'premium';
  badges: string[];
}

export interface TrustSignal {
  type: 'positive' | 'negative' | 'neutral';
  category: string;
  description: string;
  weight: number;
  date: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const VERIFICATION_REQUIREMENTS: Record<
  VerificationType,
  {
    name: string;
    nameEs: string;
    description: string;
    required: boolean;
    documents: string[];
    validityMonths?: number;
    trustPoints: number;
  }
> = {
  cuit: {
    name: 'Tax ID (CUIT)',
    nameEs: 'CUIT',
    description: 'Clave Única de Identificación Tributaria',
    required: true,
    documents: ['constancia_cuit'],
    trustPoints: 20,
  },
  license: {
    name: 'Professional License',
    nameEs: 'Habilitación Profesional',
    description: 'Habilitación o matrícula profesional',
    required: false,
    documents: ['matricula', 'habilitacion'],
    trustPoints: 25,
  },
  insurance: {
    name: 'Liability Insurance',
    nameEs: 'Seguro de Responsabilidad Civil',
    description: 'Póliza de seguro vigente',
    required: false,
    documents: ['poliza_seguro'],
    validityMonths: 12,
    trustPoints: 20,
  },
  background_check: {
    name: 'Background Check',
    nameEs: 'Certificado de Antecedentes',
    description: 'Certificado de antecedentes penales',
    required: false,
    documents: ['certificado_antecedentes'],
    validityMonths: 6,
    trustPoints: 15,
  },
  address: {
    name: 'Address Verification',
    nameEs: 'Verificación de Domicilio',
    description: 'Comprobante de domicilio comercial',
    required: false,
    documents: ['factura_servicio', 'contrato_alquiler'],
    trustPoints: 10,
  },
  bank_account: {
    name: 'Bank Account',
    nameEs: 'Cuenta Bancaria',
    description: 'CBU o cuenta bancaria verificada',
    required: false,
    documents: ['comprobante_cbu'],
    trustPoints: 10,
  },
  identity: {
    name: 'Identity Verification',
    nameEs: 'Verificación de Identidad',
    description: 'DNI del titular del negocio',
    required: true,
    documents: ['dni_frente', 'dni_dorso', 'selfie'],
    trustPoints: 15,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class VerificationService {
  constructor(private pool: Pool) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit verification request
   */
  async submitVerification(input: CreateVerificationInput): Promise<VerificationRequest> {
    // Check for existing pending verification
    const existing = await this.pool.query(
      `SELECT id FROM business_verifications
       WHERE business_profile_id = $1
         AND verification_type = $2
         AND status IN ('pending', 'in_review')
       LIMIT 1`,
      [input.businessProfileId, input.verificationType]
    );

    if (existing.rowCount > 0) {
      throw new Error('Ya hay una solicitud de verificación pendiente');
    }

    const result = await this.pool.query<VerificationRequest>(
      `INSERT INTO business_verifications (
         business_profile_id,
         verification_type,
         document_url,
         document_number,
         expiration_date,
         metadata,
         status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        input.businessProfileId,
        input.verificationType,
        input.documentUrl,
        input.documentNumber,
        input.expirationDate,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return this.mapVerificationRow(result.rows[0]);
  }

  /**
   * Get verification requests for business
   */
  async getVerifications(businessProfileId: string): Promise<VerificationRequest[]> {
    const result = await this.pool.query(
      `SELECT * FROM business_verifications
       WHERE business_profile_id = $1
       ORDER BY created_at DESC`,
      [businessProfileId]
    );
    return result.rows.map(row => this.mapVerificationRow(row));
  }

  /**
   * Get verification status summary
   */
  async getVerificationSummary(businessProfileId: string): Promise<{
    verified: VerificationType[];
    pending: VerificationType[];
    missing: VerificationType[];
    expired: VerificationType[];
  }> {
    const result = await this.pool.query<{
      verification_type: VerificationType;
      status: VerificationStatus;
      expiration_date: Date | null;
    }>(
      `SELECT DISTINCT ON (verification_type)
         verification_type,
         status,
         expiration_date
       FROM business_verifications
       WHERE business_profile_id = $1
       ORDER BY verification_type, created_at DESC`,
      [businessProfileId]
    );

    const allTypes = Object.keys(VERIFICATION_REQUIREMENTS) as VerificationType[];
    const statusMap = new Map(
      result.rows.map(row => [
        row.verification_type,
        {
          status: row.status,
          expired:
            row.expiration_date && row.expiration_date < new Date(),
        },
      ])
    );

    const verified: VerificationType[] = [];
    const pending: VerificationType[] = [];
    const missing: VerificationType[] = [];
    const expired: VerificationType[] = [];

    for (const type of allTypes) {
      const info = statusMap.get(type);
      if (!info) {
        missing.push(type);
      } else if (info.expired) {
        expired.push(type);
      } else if (info.status === 'approved') {
        verified.push(type);
      } else if (['pending', 'in_review'].includes(info.status)) {
        pending.push(type);
      } else {
        missing.push(type);
      }
    }

    return { verified, pending, missing, expired };
  }

  /**
   * Approve verification
   */
  async approveVerification(
    verificationId: string,
    verifiedBy: string,
    notes?: string
  ): Promise<VerificationRequest> {
    const result = await this.pool.query<VerificationRequest>(
      `UPDATE business_verifications
       SET status = 'approved',
           verified_at = NOW(),
           verified_by = $2,
           notes = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [verificationId, verifiedBy, notes]
    );

    if (result.rowCount === 0) {
      throw new Error('Verificación no encontrada');
    }

    const verification = this.mapVerificationRow(result.rows[0]);

    // Update business profile verification flags
    await this.updateBusinessVerificationFlags(verification.businessProfileId);

    // Recalculate trust score
    await this.calculateTrustScore(verification.businessProfileId);

    return verification;
  }

  /**
   * Reject verification
   */
  async rejectVerification(
    verificationId: string,
    verifiedBy: string,
    reason: string
  ): Promise<VerificationRequest> {
    const result = await this.pool.query<VerificationRequest>(
      `UPDATE business_verifications
       SET status = 'rejected',
           verified_at = NOW(),
           verified_by = $2,
           rejection_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [verificationId, verifiedBy, reason]
    );

    if (result.rowCount === 0) {
      throw new Error('Verificación no encontrada');
    }

    return this.mapVerificationRow(result.rows[0]);
  }

  /**
   * Get pending verifications for review
   */
  async getPendingVerifications(limit: number = 50): Promise<VerificationRequest[]> {
    const result = await this.pool.query(
      `SELECT * FROM business_verifications
       WHERE status IN ('pending', 'in_review')
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapVerificationRow(row));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRUST SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate trust score for business
   */
  async calculateTrustScore(businessProfileId: string): Promise<TrustScore> {
    // Get business data
    const businessResult = await this.pool.query(
      `SELECT
         bp.*,
         EXTRACT(YEAR FROM AGE(NOW(), bp.created_at)) as years_on_platform
       FROM business_public_profiles bp
       WHERE bp.id = $1`,
      [businessProfileId]
    );

    if (businessResult.rowCount === 0) {
      throw new Error('Negocio no encontrado');
    }

    const business = businessResult.rows[0];

    // Get verification summary
    const verifications = await this.getVerificationSummary(businessProfileId);

    // Calculate components
    const components = {
      verifications: this.calculateVerificationScore(verifications.verified),
      reviews: this.calculateReviewScore(
        business.overall_rating,
        business.rating_count
      ),
      activity: this.calculateActivityScore(
        business.total_jobs_completed,
        business.avg_response_time_hours
      ),
      tenure: this.calculateTenureScore(business.years_on_platform),
      compliance: this.calculateComplianceScore(businessProfileId),
    };

    // Calculate overall score (weighted average)
    const weights = {
      verifications: 0.25,
      reviews: 0.30,
      activity: 0.25,
      tenure: 0.10,
      compliance: 0.10,
    };

    const overall =
      components.verifications * weights.verifications +
      components.reviews * weights.reviews +
      components.activity * weights.activity +
      components.tenure * weights.tenure +
      components.compliance * weights.compliance;

    // Determine level and badges
    const level = this.determineTrustLevel(overall, verifications.verified);
    const badges = this.determineBadges(business, verifications, components);

    // Store trust score
    await this.storeTrustScore(businessProfileId, {
      overall,
      components,
      level,
      badges,
    });

    return { overall, components, level, badges };
  }

  /**
   * Get trust score
   */
  async getTrustScore(businessProfileId: string): Promise<TrustScore | null> {
    const result = await this.pool.query(
      `SELECT trust_score FROM business_public_profiles WHERE id = $1`,
      [businessProfileId]
    );

    if (result.rowCount === 0 || !result.rows[0].trust_score) {
      return null;
    }

    return result.rows[0].trust_score;
  }

  /**
   * Get trust signals for business
   */
  async getTrustSignals(businessProfileId: string): Promise<TrustSignal[]> {
    const signals: TrustSignal[] = [];

    // Get verifications
    const verifications = await this.getVerifications(businessProfileId);
    for (const v of verifications) {
      if (v.status === 'approved') {
        signals.push({
          type: 'positive',
          category: 'verification',
          description: `${VERIFICATION_REQUIREMENTS[v.verificationType].nameEs} verificado`,
          weight: VERIFICATION_REQUIREMENTS[v.verificationType].trustPoints,
          date: v.verifiedAt!,
        });
      }
    }

    // Get recent reviews
    const reviewsResult = await this.pool.query(
      `SELECT overall_rating, created_at FROM consumer_reviews
       WHERE business_profile_id = $1 AND status = 'published'
       ORDER BY created_at DESC
       LIMIT 10`,
      [businessProfileId]
    );

    for (const review of reviewsResult.rows) {
      signals.push({
        type: review.overall_rating >= 4 ? 'positive' : review.overall_rating <= 2 ? 'negative' : 'neutral',
        category: 'review',
        description: `Reseña ${review.overall_rating}/5`,
        weight: review.overall_rating >= 4 ? 5 : review.overall_rating <= 2 ? -10 : 0,
        date: review.created_at,
      });
    }

    // Get completed jobs
    const jobsResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM jobs
       WHERE business_profile_id = $1 AND status = 'completed'
         AND completed_at > NOW() - INTERVAL '30 days'`,
      [businessProfileId]
    );

    if (parseInt(jobsResult.rows[0].count) > 0) {
      signals.push({
        type: 'positive',
        category: 'activity',
        description: `${jobsResult.rows[0].count} trabajos completados en últimos 30 días`,
        weight: Math.min(parseInt(jobsResult.rows[0].count) * 2, 20),
        date: new Date(),
      });
    }

    return signals.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateVerificationScore(verifiedTypes: VerificationType[]): number {
    const maxPoints = Object.values(VERIFICATION_REQUIREMENTS).reduce(
      (sum, r) => sum + r.trustPoints,
      0
    );
    const earnedPoints = verifiedTypes.reduce(
      (sum, type) => sum + VERIFICATION_REQUIREMENTS[type].trustPoints,
      0
    );
    return (earnedPoints / maxPoints) * 100;
  }

  private calculateReviewScore(rating: number, count: number): number {
    if (count === 0) return 50;
    const ratingScore = (rating / 5) * 70;
    const volumeScore = Math.min(count / 50, 1) * 30;
    return ratingScore + volumeScore;
  }

  private calculateActivityScore(
    jobsCompleted: number,
    avgResponseTime: number
  ): number {
    const jobScore = Math.min(jobsCompleted / 100, 1) * 50;
    const responseScore =
      avgResponseTime <= 2 ? 50 : avgResponseTime <= 6 ? 35 : avgResponseTime <= 24 ? 20 : 10;
    return jobScore + responseScore;
  }

  private calculateTenureScore(years: number): number {
    if (years >= 3) return 100;
    if (years >= 2) return 80;
    if (years >= 1) return 60;
    if (years >= 0.5) return 40;
    return 20;
  }

  private async calculateComplianceScore(businessProfileId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'resolved') as resolved_issues,
         COUNT(*) as total_issues
       FROM business_compliance_issues
       WHERE business_profile_id = $1`,
      [businessProfileId]
    );

    const { resolved_issues, total_issues } = result.rows[0];
    if (parseInt(total_issues) === 0) return 100;

    return (parseInt(resolved_issues) / parseInt(total_issues)) * 100;
  }

  private determineTrustLevel(
    score: number,
    verifiedTypes: VerificationType[]
  ): TrustScore['level'] {
    const hasCuit = verifiedTypes.includes('cuit');
    const hasIdentity = verifiedTypes.includes('identity');

    if (score >= 85 && verifiedTypes.length >= 5) return 'premium';
    if (score >= 70 && hasCuit && hasIdentity) return 'trusted';
    if (score >= 50 && hasCuit) return 'verified';
    if (hasCuit || hasIdentity) return 'basic';
    return 'new';
  }

  private determineBadges(
    business: any,
    verifications: { verified: VerificationType[] },
    components: TrustScore['components']
  ): string[] {
    const badges: string[] = [];

    if (verifications.verified.includes('cuit')) badges.push('verified');
    if (business.overall_rating >= 4.5 && business.rating_count >= 10) badges.push('top_rated');
    if (business.avg_response_time_hours <= 2) badges.push('fast_responder');
    if (business.total_jobs_completed >= 50 && business.years_on_platform >= 2)
      badges.push('experienced');
    if (business.accepts_emergency) badges.push('emergency_available');
    if (verifications.verified.includes('insurance')) badges.push('insured');
    if (verifications.verified.includes('license')) badges.push('licensed');
    if (verifications.verified.includes('background_check'))
      badges.push('background_checked');

    return badges;
  }

  private async updateBusinessVerificationFlags(
    businessProfileId: string
  ): Promise<void> {
    const verifications = await this.getVerificationSummary(businessProfileId);

    await this.pool.query(
      `UPDATE business_public_profiles
       SET
         cuit_verified = $2,
         license_verified = $3,
         insurance_verified = $4,
         background_check_verified = $5,
         updated_at = NOW()
       WHERE id = $1`,
      [
        businessProfileId,
        verifications.verified.includes('cuit'),
        verifications.verified.includes('license'),
        verifications.verified.includes('insurance'),
        verifications.verified.includes('background_check'),
      ]
    );
  }

  private async storeTrustScore(
    businessProfileId: string,
    score: TrustScore
  ): Promise<void> {
    await this.pool.query(
      `UPDATE business_public_profiles
       SET trust_score = $2, updated_at = NOW()
       WHERE id = $1`,
      [businessProfileId, JSON.stringify(score)]
    );
  }

  private mapVerificationRow(row: any): VerificationRequest {
    return {
      id: row.id,
      businessProfileId: row.business_profile_id,
      verificationType: row.verification_type,
      status: row.status,
      documentUrl: row.document_url,
      documentNumber: row.document_number,
      expirationDate: row.expiration_date,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      rejectionReason: row.rejection_reason,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
