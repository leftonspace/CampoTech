/**
 * Unified Access Control Checker
 * ===============================
 *
 * Checks BOTH subscription AND verification status to determine
 * what an organization/user can access.
 *
 * Access Levels:
 * - Dashboard Access: Has active trial OR subscription, not hard-blocked
 * - Job Access: Dashboard + Tier 2 verified + no expired docs + no blocks
 * - Employee Assignment: Job access + employee is individually verified
 * - Marketplace Visibility: Job access + no soft/hard blocks
 */

import { prisma } from '@/lib/prisma';
import type {
  SubscriptionStatus,
  SubscriptionTier,
  OrgVerificationStatus,
  UserVerificationStatus,
} from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockReason {
  code: string;
  type: 'subscription' | 'verification' | 'compliance';
  severity: 'warning' | 'soft_block' | 'hard_block';
  message: string;
  actionRequired?: string;
  actionUrl?: string;
}

export interface ExpiringDoc {
  requirementCode: string;
  requirementName: string;
  expiresAt: Date;
  daysUntilExpiry: number;
}

export interface SubscriptionAccessStatus {
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  isPaid: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isPastDue: boolean;
}

export interface VerificationAccessStatus {
  status: OrgVerificationStatus;
  tier2Complete: boolean;
  pendingRequirements: string[];
  expiredDocuments: string[];
  expiringDocuments: ExpiringDoc[];
  hasActiveBlock: boolean;
}

export interface AccessStatus {
  // Overall access
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  canAssignEmployees: boolean;
  isMarketplaceVisible: boolean;

  // Reasons for any restrictions
  blockReasons: BlockReason[];

  // Individual system statuses
  subscription: SubscriptionAccessStatus;
  verification: VerificationAccessStatus;

  // Quick access flags
  requiresAction: boolean;
  hasWarnings: boolean;
  isSoftBlocked: boolean;
  isHardBlocked: boolean;
}

export interface UserAccessStatus {
  userId: string;
  canBeAssignedJobs: boolean;
  isVerified: boolean;
  status: UserVerificationStatus;
  blockReasons: BlockReason[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const EXPIRING_SOON_DAYS = 30;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ACCESS CHECK FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check full access status for an organization
 */
export async function checkAccess(organizationId: string): Promise<AccessStatus> {
  // Get organization with subscription and verification data
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      verificationStatus: true,
      canReceiveJobs: true,
      marketplaceVisible: true,
    },
  });

  if (!org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  // Check for active compliance blocks
  const activeBlocks = await prisma.complianceBlock.findMany({
    where: {
      organizationId,
      unblockedAt: null,
    },
    select: {
      blockType: true,
      reason: true,
      reasonCode: true,
    },
  });

  // Get Tier 2 requirements status
  const tier2Status = await getTier2Status(organizationId);

  // Build subscription status
  const subscription = buildSubscriptionStatus(org);

  // Build verification status
  const verification: VerificationAccessStatus = {
    status: org.verificationStatus,
    tier2Complete: tier2Status.isComplete,
    pendingRequirements: tier2Status.pending,
    expiredDocuments: tier2Status.expired,
    expiringDocuments: tier2Status.expiring,
    hasActiveBlock: activeBlocks.length > 0,
  };

  // Collect block reasons
  const blockReasons: BlockReason[] = [];

  // Check subscription blocks
  addSubscriptionBlockReasons(subscription, blockReasons);

  // Check verification blocks
  addVerificationBlockReasons(verification, blockReasons);

  // Check compliance blocks
  for (const block of activeBlocks) {
    blockReasons.push({
      code: block.reasonCode || 'compliance_block',
      type: 'compliance',
      severity: block.blockType === 'hard_block' ? 'hard_block' : 'soft_block',
      message: block.reason,
      actionRequired: 'Contacte soporte para resolver este bloqueo',
      actionUrl: '/dashboard/settings/compliance',
    });
  }

  // Determine access levels
  const hasHardBlock = blockReasons.some((r) => r.severity === 'hard_block');
  const hasSoftBlock = blockReasons.some((r) => r.severity === 'soft_block');
  const hasWarnings = blockReasons.some((r) => r.severity === 'warning');

  // Can access dashboard:
  // - Has active trial OR active subscription
  // - Not hard-blocked
  const canAccessDashboard =
    subscription.isActive &&
    !hasHardBlock;

  // Can receive jobs:
  // - canAccessDashboard = true
  // - Tier 2 verification complete
  // - No expired required documents
  // - No active compliance block
  const canReceiveJobs =
    canAccessDashboard &&
    verification.tier2Complete &&
    verification.expiredDocuments.length === 0 &&
    !verification.hasActiveBlock;

  // Can assign employees:
  // - canReceiveJobs = true
  // (Employee verification is checked separately via checkUserAccess)
  const canAssignEmployees = canReceiveJobs;

  // Is marketplace visible:
  // - canReceiveJobs = true
  // - No soft or hard blocks
  const isMarketplaceVisible =
    canReceiveJobs &&
    !hasSoftBlock &&
    !hasHardBlock;

  return {
    canAccessDashboard,
    canReceiveJobs,
    canAssignEmployees,
    isMarketplaceVisible,
    blockReasons,
    subscription,
    verification,
    requiresAction: blockReasons.some(
      (r) => r.severity === 'soft_block' || r.severity === 'hard_block'
    ),
    hasWarnings,
    isSoftBlocked: hasSoftBlock && !hasHardBlock,
    isHardBlocked: hasHardBlock,
  };
}

/**
 * Check access status for a specific user/employee
 */
export async function checkUserAccess(
  userId: string,
  organizationId: string
): Promise<UserAccessStatus> {
  // Get user with verification data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      verificationStatus: true,
      canBeAssignedJobs: true,
      identityVerified: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const blockReasons: BlockReason[] = [];

  // Check for user-level compliance blocks
  const userBlocks = await prisma.complianceBlock.findMany({
    where: {
      userId,
      unblockedAt: null,
    },
    select: {
      blockType: true,
      reason: true,
      reasonCode: true,
    },
  });

  for (const block of userBlocks) {
    blockReasons.push({
      code: block.reasonCode || 'user_compliance_block',
      type: 'compliance',
      severity: block.blockType === 'hard_block' ? 'hard_block' : 'soft_block',
      message: block.reason,
      actionRequired: 'Contacte soporte para resolver este bloqueo',
    });
  }

  // Check verification status
  if (user.verificationStatus !== 'verified') {
    blockReasons.push({
      code: 'user_not_verified',
      type: 'verification',
      severity: 'soft_block',
      message: 'Usuario no verificado',
      actionRequired: 'Complete la verificación de identidad',
      actionUrl: '/dashboard/settings/verification',
    });
  }

  const hasBlock = blockReasons.some(
    (r) => r.severity === 'soft_block' || r.severity === 'hard_block'
  );

  return {
    userId,
    canBeAssignedJobs: user.canBeAssignedJobs && !hasBlock,
    isVerified: user.verificationStatus === 'verified',
    status: user.verificationStatus,
    blockReasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build subscription status from org data
 */
function buildSubscriptionStatus(org: {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
}): SubscriptionAccessStatus {
  const now = new Date();
  const trialEndsAt = org.trialEndsAt;
  const isInTrial = org.subscriptionStatus === 'trialing' && trialEndsAt;
  const trialDaysRemaining = isInTrial
    ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrialExpired = isInTrial && trialDaysRemaining === 0;

  // Determine if subscription is active
  const activeStatuses: SubscriptionStatus[] = ['active', 'trialing', 'past_due'];
  const isActive = activeStatuses.includes(org.subscriptionStatus);

  // Determine if paid
  const isPaid = ['active', 'past_due'].includes(org.subscriptionStatus);

  return {
    status: org.subscriptionStatus,
    tier: org.subscriptionTier,
    trialDaysRemaining,
    isTrialExpired: isTrialExpired || org.subscriptionStatus === 'expired',
    isPaid,
    isActive,
    isCancelled: org.subscriptionStatus === 'cancelled',
    isPastDue: org.subscriptionStatus === 'past_due',
  };
}

/**
 * Get Tier 2 verification status
 */
async function getTier2Status(organizationId: string): Promise<{
  isComplete: boolean;
  pending: string[];
  expired: string[];
  expiring: ExpiringDoc[];
}> {
  const now = new Date();
  const expiringThreshold = new Date();
  expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRING_SOON_DAYS);

  // Get all Tier 2 requirements
  const requirements = await prisma.verificationRequirement.findMany({
    where: {
      isActive: true,
      tier: 2,
      isRequired: true,
      appliesTo: { in: ['organization', 'owner'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (requirements.length === 0) {
    return { isComplete: true, pending: [], expired: [], expiring: [] };
  }

  // Get submissions for these requirements
  const submissions = await prisma.verificationSubmission.findMany({
    where: {
      organizationId,
      requirementId: { in: requirements.map((r) => r.id) },
    },
    select: {
      requirementId: true,
      status: true,
      expiresAt: true,
      requirement: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  // Create submission map
  const submissionMap = new Map(submissions.map((s) => [s.requirementId, s]));

  const pending: string[] = [];
  const expired: string[] = [];
  const expiring: ExpiringDoc[] = [];

  for (const req of requirements) {
    const submission = submissionMap.get(req.id);

    if (!submission || submission.status !== 'approved') {
      pending.push(req.code);
    } else if (submission.expiresAt && submission.expiresAt < now) {
      expired.push(req.code);
    } else if (
      submission.expiresAt &&
      submission.expiresAt < expiringThreshold
    ) {
      const daysUntilExpiry = Math.ceil(
        (submission.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      expiring.push({
        requirementCode: req.code,
        requirementName: req.name,
        expiresAt: submission.expiresAt,
        daysUntilExpiry,
      });
    }
  }

  return {
    isComplete: pending.length === 0 && expired.length === 0,
    pending,
    expired,
    expiring,
  };
}

/**
 * Add subscription-related block reasons
 */
function addSubscriptionBlockReasons(
  subscription: SubscriptionAccessStatus,
  blockReasons: BlockReason[]
): void {
  // Trial expiring soon
  if (
    subscription.trialDaysRemaining !== null &&
    subscription.trialDaysRemaining <= 7 &&
    subscription.trialDaysRemaining > 0
  ) {
    blockReasons.push({
      code: 'trial_expiring',
      type: 'subscription',
      severity: 'warning',
      message: `Tu período de prueba termina en ${subscription.trialDaysRemaining} días`,
      actionRequired: 'Elegí un plan para continuar',
      actionUrl: '/dashboard/settings/billing',
    });
  }

  // Trial expired
  if (subscription.isTrialExpired || subscription.status === 'expired') {
    blockReasons.push({
      code: 'trial_expired',
      type: 'subscription',
      severity: 'hard_block',
      message: 'Tu período de prueba ha terminado',
      actionRequired: 'Elegí un plan para continuar usando CampoTech',
      actionUrl: '/dashboard/settings/billing',
    });
  }

  // Past due
  if (subscription.isPastDue) {
    blockReasons.push({
      code: 'payment_past_due',
      type: 'subscription',
      severity: 'soft_block',
      message: 'Tu pago está vencido',
      actionRequired: 'Actualizá tu método de pago',
      actionUrl: '/dashboard/settings/billing',
    });
  }

  // Cancelled
  if (subscription.isCancelled) {
    blockReasons.push({
      code: 'subscription_cancelled',
      type: 'subscription',
      severity: 'soft_block',
      message: 'Tu suscripción ha sido cancelada',
      actionRequired: 'Reactivá tu suscripción para continuar',
      actionUrl: '/dashboard/settings/billing',
    });
  }

  // No subscription
  if (subscription.status === 'none' && subscription.tier === 'FREE') {
    blockReasons.push({
      code: 'no_subscription',
      type: 'subscription',
      severity: 'warning',
      message: 'Estás en el plan gratuito con funciones limitadas',
      actionRequired: 'Actualizá a un plan pago para más funciones',
      actionUrl: '/dashboard/settings/billing',
    });
  }
}

/**
 * Add verification-related block reasons
 */
function addVerificationBlockReasons(
  verification: VerificationAccessStatus,
  blockReasons: BlockReason[]
): void {
  // Not verified
  if (verification.status === 'pending') {
    blockReasons.push({
      code: 'verification_pending',
      type: 'verification',
      severity: 'soft_block',
      message: 'Tu negocio no está verificado',
      actionRequired: 'Completá la verificación para recibir trabajos',
      actionUrl: '/dashboard/settings/verification',
    });
  }

  // Partial verification
  if (verification.status === 'partial') {
    blockReasons.push({
      code: 'verification_partial',
      type: 'verification',
      severity: 'soft_block',
      message: 'Tu verificación está incompleta',
      actionRequired: `Completá ${verification.pendingRequirements.length} requisitos pendientes`,
      actionUrl: '/dashboard/settings/verification',
    });
  }

  // Suspended verification
  if (verification.status === 'suspended') {
    blockReasons.push({
      code: 'verification_suspended',
      type: 'verification',
      severity: 'hard_block',
      message: 'Tu verificación ha sido suspendida',
      actionRequired: 'Contactá soporte para más información',
      actionUrl: '/dashboard/settings/verification',
    });
  }

  // Expired documents
  if (verification.expiredDocuments.length > 0) {
    blockReasons.push({
      code: 'documents_expired',
      type: 'verification',
      severity: 'soft_block',
      message: `Tenés ${verification.expiredDocuments.length} documento(s) vencido(s)`,
      actionRequired: 'Actualizá tus documentos para continuar recibiendo trabajos',
      actionUrl: '/dashboard/settings/verification',
    });
  }

  // Expiring soon documents (warning)
  if (verification.expiringDocuments.length > 0) {
    const soonest = verification.expiringDocuments.reduce((a, b) =>
      a.daysUntilExpiry < b.daysUntilExpiry ? a : b
    );
    blockReasons.push({
      code: 'documents_expiring',
      type: 'verification',
      severity: 'warning',
      message: `${soonest.requirementName} vence en ${soonest.daysUntilExpiry} días`,
      actionRequired: 'Actualizá tus documentos antes de que venzan',
      actionUrl: '/dashboard/settings/verification',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick check if organization can receive jobs (cached check)
 */
export async function canReceiveJobs(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { canReceiveJobs: true },
  });
  return org?.canReceiveJobs ?? false;
}

/**
 * Quick check if user can be assigned jobs
 */
export async function canAssignUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { canBeAssignedJobs: true },
  });
  return user?.canBeAssignedJobs ?? false;
}

/**
 * Quick check if organization is marketplace visible
 */
export async function isOrgMarketplaceVisible(
  organizationId: string
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { marketplaceVisible: true },
  });
  return org?.marketplaceVisible ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default checkAccess;
