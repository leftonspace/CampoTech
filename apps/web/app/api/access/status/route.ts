/**
 * Access Status API
 * =================
 *
 * GET /api/access/status
 *
 * Returns the current organization's access status including:
 * - Dashboard access
 * - Job receiving capability
 * - Employee assignment capability
 * - Marketplace visibility
 * - Block reasons (if any)
 * - Subscription and verification status
 *
 * This endpoint is used by the client-side useAccessStatus hook.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkAccess, checkUserAccess } from '@/lib/access-control/checker';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AccessStatusResponse {
  success: boolean;
  data?: {
    // Overall access
    canAccessDashboard: boolean;
    canReceiveJobs: boolean;
    canAssignEmployees: boolean;
    isMarketplaceVisible: boolean;

    // Quick flags
    requiresAction: boolean;
    hasWarnings: boolean;
    isSoftBlocked: boolean;
    isHardBlocked: boolean;

    // Block reasons
    blockReasons: Array<{
      code: string;
      type: 'subscription' | 'verification' | 'compliance';
      severity: 'warning' | 'soft_block' | 'hard_block';
      message: string;
      actionRequired?: string;
      actionUrl?: string;
    }>;

    // Subscription info
    subscription: {
      status: string;
      tier: string;
      trialDaysRemaining: number | null;
      isTrialExpired: boolean;
      isPaid: boolean;
      isActive: boolean;
    };

    // Verification info
    verification: {
      status: string;
      tier2Complete: boolean;
      pendingRequirements: string[];
      expiredDocuments: string[];
      expiringDocuments: Array<{
        requirementCode: string;
        requirementName: string;
        expiresAt: string;
        daysUntilExpiry: number;
      }>;
      hasActiveBlock: boolean;
    };

    // User-specific info (for employees)
    user?: {
      canBeAssignedJobs: boolean;
      isVerified: boolean;
      status: string;
    };
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Access Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse<AccessStatusResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get organization access status
    const accessStatus = await checkAccess(session.organizationId);

    // Get user access status (for non-owners)
    let userStatus: { canBeAssignedJobs: boolean; isVerified: boolean; status: string } | undefined;
    if (session.role !== 'OWNER') {
      const userAccess = await checkUserAccess(session.id, session.organizationId);
      userStatus = {
        canBeAssignedJobs: userAccess.canBeAssignedJobs,
        isVerified: userAccess.isVerified,
        status: userAccess.status,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        // Overall access
        canAccessDashboard: accessStatus.canAccessDashboard,
        canReceiveJobs: accessStatus.canReceiveJobs,
        canAssignEmployees: accessStatus.canAssignEmployees,
        isMarketplaceVisible: accessStatus.isMarketplaceVisible,

        // Quick flags
        requiresAction: accessStatus.requiresAction,
        hasWarnings: accessStatus.hasWarnings,
        isSoftBlocked: accessStatus.isSoftBlocked,
        isHardBlocked: accessStatus.isHardBlocked,

        // Block reasons
        blockReasons: accessStatus.blockReasons,

        // Subscription info
        subscription: {
          status: accessStatus.subscription.status,
          tier: accessStatus.subscription.tier,
          trialDaysRemaining: accessStatus.subscription.trialDaysRemaining,
          isTrialExpired: accessStatus.subscription.isTrialExpired,
          isPaid: accessStatus.subscription.isPaid,
          isActive: accessStatus.subscription.isActive,
        },

        // Verification info
        verification: {
          status: accessStatus.verification.status,
          tier2Complete: accessStatus.verification.tier2Complete,
          pendingRequirements: accessStatus.verification.pendingRequirements,
          expiredDocuments: accessStatus.verification.expiredDocuments,
          expiringDocuments: accessStatus.verification.expiringDocuments.map((doc) => ({
            ...doc,
            expiresAt: doc.expiresAt.toISOString(),
          })),
          hasActiveBlock: accessStatus.verification.hasActiveBlock,
        },

        // User info
        user: userStatus,
      },
    });
  } catch (error) {
    console.error('[Access Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estado de acceso',
      },
      { status: 500 }
    );
  }
}
