/**
 * Employee Verification Status API
 * =================================
 *
 * GET /api/verification/employee/status
 *
 * Returns the current user's (employee) verification status including:
 * - Overall verification status
 * - All tier 3 requirements with their current status
 * - Available optional badges
 * - Items requiring attention
 *
 * Only accessible by the authenticated user for their own status.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verificationManager } from '@/lib/services/verification-manager';
import type { UserVerificationSummary } from '@/lib/services/verification-types';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface EmployeeStatusResponse {
  success: boolean;
  userId: string;
  status: UserVerificationSummary['status'];
  canBeAssignedJobs: boolean;
  identityVerified: boolean;
  verificationCompletedAt: string | null;
  tier3: UserVerificationSummary['tier3'];
  requirements: Array<{
    code: string;
    name: string;
    description: string;
    tier: number;
    isRequired: boolean;
    appliesTo: string;
    status: string;
    submittedAt: string | null;
    verifiedAt: string | null;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    isExpiringSoon: boolean;
    canUpload: boolean;
    canUpdate: boolean;
    rejectionReason: string | null;
    submittedValue?: string;
  }>;
  badges: Array<{
    code: string;
    name: string;
    description: string;
    benefit: string;
    icon: string | null;
    isEarned: boolean;
    earnedAt?: string;
    expiresAt?: string | null;
    isValid?: boolean;
    isExpiringSoon?: boolean;
    daysUntilExpiry?: number | null;
  }>;
  requiresAttention: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
  phoneVerified: boolean;
  phoneNumber?: string;
  error?: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EMPLOYEE BADGES CONFIG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const EMPLOYEE_BADGES = [
  {
    code: 'background_check',
    name: 'Antecedentes Verificados',
    description: 'Certificado de antecedentes penales validado',
    benefit: 'Destaca en el marketplace y accede a más trabajos',
    icon: 'shield',
  },
  {
    code: 'professional_cert',
    name: 'Certificación Profesional',
    description: 'Certificación técnica o profesional validada',
    benefit: 'Aumenta la confianza de los clientes',
    icon: 'award',
  },
];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET - Get Employee Verification Status
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function GET(): Promise<NextResponse<EmployeeStatusResponse | ErrorResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = session.id;
    const organizationId = session.organizationId;

    console.log('[Employee Status] Request:', {
      userId,
      organizationId,
      role: session.role,
    });

    // Get summary from verification manager
    const summary = await verificationManager.getUserVerificationSummary(userId, organizationId);

    // Get all requirements with status
    const requirements = await verificationManager.getRequirementsForUser(userId, organizationId);

    // Format requirements for response
    const formattedRequirements = requirements.map((r) => ({
      code: r.requirement.code,
      name: r.requirement.name,
      description: r.requirement.description || '',
      tier: r.requirement.tier,
      isRequired: r.requirement.isRequired,
      appliesTo: r.requirement.appliesTo,
      status: r.status,
      submittedAt: r.submission?.submittedAt?.toISOString() || null,
      verifiedAt: r.submission?.verifiedAt?.toISOString() || null,
      expiresAt: r.expiresAt?.toISOString() || null,
      daysUntilExpiry: r.daysUntilExpiry,
      isExpiringSoon: r.isExpiringSoon,
      canUpload: r.canUpload,
      canUpdate: r.canUpdate,
      rejectionReason: r.submission?.rejectionReason || null,
      submittedValue: r.submission?.submittedValue || undefined,
    }));

    // Get employee badges status
    const earnedBadges = await getEmployeeBadges(userId, organizationId);

    // Format items requiring attention
    const requiresAttention = summary.requiresAttention.map((r) => {
      let reason = '';
      if (r.status === 'rejected') {
        reason = r.submission?.rejectionReason || 'Documento rechazado';
      } else if (r.status === 'expired') {
        reason = 'Documento vencido';
      } else if (r.isExpiringSoon) {
        reason = `Vence en ${r.daysUntilExpiry} días`;
      } else if (r.requirement.isRequired && r.status === 'not_started') {
        reason = 'Requisito obligatorio pendiente';
      }

      return {
        code: r.requirement.code,
        name: r.requirement.name,
        status: r.status,
        reason,
      };
    });

    // Check phone verification status
    const phoneVerified = formattedRequirements.some(
      (r) => r.code === 'phone_verified' && r.status === 'approved'
    );

    console.log('[Employee Status] Response:', {
      userId,
      status: summary.status,
      canBeAssignedJobs: summary.canBeAssignedJobs,
      tier3Progress: `${summary.tier3.completed}/${summary.tier3.total}`,
      badgesEarned: earnedBadges.filter((b) => b.isEarned).length,
    });

    return NextResponse.json({
      success: true,
      userId,
      status: summary.status,
      canBeAssignedJobs: summary.canBeAssignedJobs,
      identityVerified: summary.identityVerified,
      verificationCompletedAt: summary.verificationCompletedAt?.toISOString() || null,
      tier3: summary.tier3,
      requirements: formattedRequirements,
      badges: earnedBadges,
      requiresAttention,
      phoneVerified,
      phoneNumber: typeof session.phone === 'string' ? session.phone : undefined,
    });
  } catch (error) {
    console.error('[Employee Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estado de verificación',
      },
      { status: 500 }
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function getEmployeeBadges(userId: string, organizationId: string) {
  // For now, return the static badge definitions with earned status from database
  // In a real implementation, this would query the verification_submissions table
  // for optional employee badges

  try {
    const badgeSubmissions = await verificationManager.getRequirementsForUser(userId, organizationId);

    return EMPLOYEE_BADGES.map((badge) => {
      const submission = badgeSubmissions.find((s) => s.requirement.code === badge.code);
      const isEarned = submission?.status === 'approved';
      const isExpired = submission?.status === 'expired';
      const daysUntilExpiry = submission?.daysUntilExpiry ?? null;
      const isExpiringSoon = submission?.isExpiringSoon ?? false;

      return {
        ...badge,
        isEarned,
        earnedAt: submission?.submission?.verifiedAt?.toISOString(),
        expiresAt: submission?.expiresAt?.toISOString() || null,
        isValid: isEarned && !isExpired,
        isExpiringSoon,
        daysUntilExpiry,
      };
    });
  } catch (error) {
    console.error('[Employee Badges] Error fetching badges:', error);
    // Return badges as not earned if there's an error
    return EMPLOYEE_BADGES.map((badge) => ({
      ...badge,
      isEarned: false,
      isValid: false,
    }));
  }
}

