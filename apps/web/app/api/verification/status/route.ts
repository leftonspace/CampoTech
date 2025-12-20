/**
 * Verification Status API
 * =======================
 *
 * GET /api/verification/status
 *
 * Returns the organization's verification status including:
 * - Overall verification status (pending, partial, verified, suspended)
 * - All requirements with their current status
 * - Earned badges (Tier 4)
 * - Compliance score
 * - Items requiring attention
 *
 * Query parameters:
 * - userId: Optional - If provided, returns employee (Tier 3) verification status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verificationManager } from '@/lib/services/verification-manager';
import type { OrgVerificationSummary, UserVerificationSummary, Badge } from '@/lib/services/verification-types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface OrgStatusResponse {
  success: boolean;
  type: 'organization';
  status: OrgVerificationSummary['status'];
  canReceiveJobs: boolean;
  marketplaceVisible: boolean;
  complianceScore: number;
  verificationCompletedAt: string | null;
  tier2: OrgVerificationSummary['tier2'];
  tier4: OrgVerificationSummary['tier4'];
  badges: Badge[];
  activeBlocks: number;
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
  }>;
  requiresAttention: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
  error?: string;
}

interface UserStatusResponse {
  success: boolean;
  type: 'user';
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
  }>;
  requiresAttention: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
  error?: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

type StatusResponse = OrgStatusResponse | UserStatusResponse | ErrorResponse;

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Verification Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse<StatusResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('[Verification Status] Request:', {
      organizationId,
      userId,
      requesterId: session.id,
      requesterRole: session.role,
    });

    // If userId provided, return user/employee verification status
    if (userId) {
      return await getUserVerificationStatus(userId, organizationId, session);
    }

    // Otherwise, return organization verification status
    return await getOrgVerificationStatus(organizationId);
  } catch (error) {
    console.error('[Verification Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estado de verificación',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get organization verification status
 */
async function getOrgVerificationStatus(
  organizationId: string
): Promise<NextResponse<OrgStatusResponse | ErrorResponse>> {
  try {
    // Get summary from verification manager
    const summary = await verificationManager.getOrgVerificationSummary(organizationId);

    // Get all requirements with status
    const requirements = await verificationManager.getRequirementsForOrg(organizationId);

    // Get earned badges
    const badges = await verificationManager.getEarnedBadges(organizationId);

    // Format requirements for response
    const formattedRequirements = requirements.map((r) => ({
      code: r.requirement.code,
      name: r.requirement.name,
      description: r.requirement.description,
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
    }));

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

    console.log('[Verification Status] Org status:', {
      organizationId,
      status: summary.status,
      canReceiveJobs: summary.canReceiveJobs,
      complianceScore: summary.complianceScore,
      tier2Progress: `${summary.tier2.completed}/${summary.tier2.total}`,
      badgesEarned: badges.length,
    });

    return NextResponse.json({
      success: true,
      type: 'organization',
      status: summary.status,
      canReceiveJobs: summary.canReceiveJobs,
      marketplaceVisible: summary.marketplaceVisible,
      complianceScore: summary.complianceScore,
      verificationCompletedAt: summary.verificationCompletedAt?.toISOString() || null,
      tier2: summary.tier2,
      tier4: summary.tier4,
      badges: badges.map((b) => ({
        ...b,
        earnedAt: b.earnedAt,
        expiresAt: b.expiresAt,
      })),
      activeBlocks: summary.activeBlocks,
      requirements: formattedRequirements,
      requiresAttention,
    });
  } catch (error) {
    console.error('[Verification Status] Org status error:', error);
    throw error;
  }
}

/**
 * Get user/employee verification status
 */
async function getUserVerificationStatus(
  userId: string,
  organizationId: string,
  session: { id: string; role?: string }
): Promise<NextResponse<UserStatusResponse | ErrorResponse>> {
  // Check permissions - user can view their own status, OWNER/ADMIN can view any
  const isOwnStatus = session.id === userId;
  const isAdmin = ['OWNER', 'ADMIN'].includes(session.role?.toUpperCase() || '');

  if (!isOwnStatus && !isAdmin) {
    return NextResponse.json(
      {
        success: false,
        error: 'No tenés permiso para ver el estado de verificación de este usuario',
      },
      { status: 403 }
    );
  }

  try {
    // Get summary from verification manager
    const summary = await verificationManager.getUserVerificationSummary(userId, organizationId);

    // Get all requirements with status
    const requirements = await verificationManager.getRequirementsForUser(userId, organizationId);

    // Format requirements for response
    const formattedRequirements = requirements.map((r) => ({
      code: r.requirement.code,
      name: r.requirement.name,
      description: r.requirement.description,
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
    }));

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

    console.log('[Verification Status] User status:', {
      userId,
      organizationId,
      status: summary.status,
      canBeAssignedJobs: summary.canBeAssignedJobs,
      tier3Progress: `${summary.tier3.completed}/${summary.tier3.total}`,
    });

    return NextResponse.json({
      success: true,
      type: 'user',
      userId,
      status: summary.status,
      canBeAssignedJobs: summary.canBeAssignedJobs,
      identityVerified: summary.identityVerified,
      verificationCompletedAt: summary.verificationCompletedAt?.toISOString() || null,
      tier3: summary.tier3,
      requirements: formattedRequirements,
      requiresAttention,
    });
  } catch (error) {
    console.error('[Verification Status] User status error:', error);
    throw error;
  }
}
