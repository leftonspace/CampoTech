/**
 * Verification Manager Service
 * ============================
 *
 * Core service for managing organization and employee verification.
 * Handles requirement status tracking, submissions, approvals, and
 * verification status calculation.
 *
 * Status Calculation:
 * - 'pending': No Tier 2 requirements completed
 * - 'partial': Some but not all Tier 2 completed
 * - 'verified': All Tier 2 requirements completed
 * - 'suspended': Has active compliance block
 */

import { prisma } from '@/lib/prisma';
import {
  VerificationSubmission,
  VerificationRequirement,
  VerificationSubmissionStatus,
  OrgVerificationStatus,
  UserVerificationStatus,
} from '@prisma/client';
import { autoVerifier } from './auto-verifier';
import { acknowledgmentService } from './acknowledgment-service';
import type {
  RequirementWithStatus,
  CombinedStatus,
  OrgVerificationSummary,
  UserVerificationSummary,
  Badge,
  SubmissionInput,
} from './verification-types';
import type { MissingAcknowledgment } from './acknowledgment-service';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Days before expiry to consider "expiring soon" */
const EXPIRING_SOON_DAYS = 30;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate days until a date
 */
function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Map submission status to combined status
 */
function getCombinedStatus(
  submission: VerificationSubmission | null
): CombinedStatus {
  if (!submission) return 'not_started';

  // Check if expired
  if (submission.expiresAt && new Date() > submission.expiresAt) {
    return 'expired';
  }

  switch (submission.status) {
    case 'pending':
      return 'pending';
    case 'in_review':
      return 'in_review';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class VerificationManagerClass {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET REQUIREMENTS WITH STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all requirements with status for an organization (Tier 2 + 4)
   */
  async getRequirementsForOrg(orgId: string): Promise<RequirementWithStatus[]> {
    // Get Tier 2 (required) and Tier 4 (optional badges) requirements
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        isActive: true,
        tier: { in: [2, 4] },
        appliesTo: { in: ['organization', 'owner'] },
      },
      orderBy: [{ tier: 'asc' }, { displayOrder: 'asc' }],
    });

    // Get existing submissions for this org
    const submissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId: orgId,
        requirementId: { in: requirements.map((r) => r.id) },
      },
    });

    // Create a map for quick lookup
    const submissionMap = new Map<string, VerificationSubmission>();
    for (const sub of submissions) {
      // Use the most recent submission per requirement
      const key = sub.requirementId;
      const existing = submissionMap.get(key);
      if (!existing || sub.submittedAt > existing.submittedAt) {
        submissionMap.set(key, sub);
      }
    }

    // Build requirements with status
    return requirements.map((req) => {
      const submission = submissionMap.get(req.id) || null;
      const status = getCombinedStatus(submission);
      const expiresAt = submission?.expiresAt || null;
      const days = daysUntil(expiresAt);

      return {
        requirement: req,
        submission,
        status,
        expiresAt,
        daysUntilExpiry: days,
        isExpiringSoon: days !== null && days <= EXPIRING_SOON_DAYS && days > 0,
        canUpload: req.requiresDocument && status !== 'approved',
        canUpdate: status !== 'approved' && status !== 'in_review',
      };
    });
  }

  /**
   * Get all requirements with status for an employee (Tier 3)
   */
  async getRequirementsForUser(
    userId: string,
    orgId: string
  ): Promise<RequirementWithStatus[]> {
    // Get Tier 3 (employee) requirements
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        isActive: true,
        tier: 3,
        appliesTo: 'employee',
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Get existing submissions for this user
    const submissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId: orgId,
        userId,
        requirementId: { in: requirements.map((r) => r.id) },
      },
    });

    // Create a map for quick lookup
    const submissionMap = new Map<string, VerificationSubmission>();
    for (const sub of submissions) {
      submissionMap.set(sub.requirementId, sub);
    }

    // Build requirements with status
    return requirements.map((req) => {
      const submission = submissionMap.get(req.id) || null;
      const status = getCombinedStatus(submission);
      const expiresAt = submission?.expiresAt || null;
      const days = daysUntil(expiresAt);

      return {
        requirement: req,
        submission,
        status,
        expiresAt,
        daysUntilExpiry: days,
        isExpiringSoon: days !== null && days <= EXPIRING_SOON_DAYS && days > 0,
        canUpload: req.requiresDocument && status !== 'approved',
        canUpdate: status !== 'approved' && status !== 'in_review',
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMISSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Submit a verification (create or update submission)
   */
  async submitVerification(input: SubmissionInput): Promise<VerificationSubmission> {
    const { organizationId, requirementCode, userId } = input;

    // Get the requirement
    const requirement = await prisma.verificationRequirement.findUnique({
      where: { code: requirementCode },
    });

    if (!requirement) {
      throw new Error(`Requirement not found: ${requirementCode}`);
    }

    // Determine the effective user ID
    const effectiveUserId = userId || (
      await prisma.user.findFirst({
        where: { organizationId, role: 'OWNER' },
        select: { id: true },
      })
    )?.id;

    if (!effectiveUserId) {
      throw new Error('Could not determine user for submission');
    }

    // Create or update the submission
    const submission = await prisma.verificationSubmission.upsert({
      where: {
        organizationId_requirementId_userId: {
          organizationId,
          requirementId: requirement.id,
          userId: effectiveUserId,
        },
      },
      create: {
        organizationId,
        requirementId: requirement.id,
        userId: effectiveUserId,
        submittedValue: input.submittedValue,
        documentUrl: input.documentUrl,
        documentType: input.documentType,
        documentFilename: input.documentFilename,
        expiresAt: input.expiresAt,
        autoVerifyResponse: input.autoVerifyResponse as object,
        status: requirement.autoVerifySource ? 'pending' : 'in_review',
        submittedAt: new Date(),
      },
      update: {
        submittedValue: input.submittedValue,
        documentUrl: input.documentUrl,
        documentType: input.documentType,
        documentFilename: input.documentFilename,
        expiresAt: input.expiresAt,
        autoVerifyResponse: input.autoVerifyResponse as object,
        status: 'pending',
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        rejectionCode: null,
        updatedAt: new Date(),
      },
      include: { requirement: true },
    });

    // Attempt auto-verification if configured
    if (requirement.autoVerifySource) {
      const verifyResult = await autoVerifier.verifySubmission(
        submission as VerificationSubmission & { requirement: VerificationRequirement }
      );

      if (verifyResult.success) {
        if (verifyResult.shouldApprove) {
          // Auto-approve
          await prisma.verificationSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'approved',
              verifiedAt: new Date(),
              verifiedBy: 'system',
              autoVerifyResponse: verifyResult.verificationData as object,
              autoVerifyCheckedAt: new Date(),
            },
          });
        } else if (verifyResult.needsReview) {
          // Set for manual review
          await prisma.verificationSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'in_review',
              autoVerifyResponse: verifyResult.verificationData as object,
              autoVerifyCheckedAt: new Date(),
              notes: verifyResult.reason,
            },
          });
        } else if (verifyResult.reason && !verifyResult.shouldApprove) {
          // Auto-reject
          await prisma.verificationSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'rejected',
              rejectionReason: verifyResult.reason,
              autoVerifyResponse: verifyResult.verificationData as object,
              autoVerifyCheckedAt: new Date(),
            },
          });
        }
      }
    }

    // Update org/user verification status
    await this.updateOrgVerificationStatus(organizationId);
    if (requirement.appliesTo === 'employee' && userId) {
      await this.updateUserVerificationStatus(userId);
    }

    // Return fresh submission
    return prisma.verificationSubmission.findUnique({
      where: { id: submission.id },
    }) as Promise<VerificationSubmission>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Approve a submission (admin action)
   */
  async approveSubmission(
    submissionId: string,
    adminId: string,
    expiresAt?: Date
  ): Promise<void> {
    const submission = await prisma.verificationSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'approved',
        verifiedAt: new Date(),
        verifiedBy: 'admin',
        verifiedByUserId: adminId,
        expiresAt: expiresAt || undefined,
        rejectionReason: null,
        rejectionCode: null,
      },
      include: { requirement: true },
    });

    // Update org/user verification status
    await this.updateOrgVerificationStatus(submission.organizationId);
    if (submission.requirement.appliesTo === 'employee' && submission.userId) {
      await this.updateUserVerificationStatus(submission.userId);
    }
  }

  /**
   * Reject a submission (admin action)
   */
  async rejectSubmission(
    submissionId: string,
    adminId: string,
    reason: string,
    reasonCode?: string
  ): Promise<void> {
    const submission = await prisma.verificationSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'rejected',
        verifiedBy: 'admin',
        verifiedByUserId: adminId,
        rejectionReason: reason,
        rejectionCode: reasonCode,
      },
      include: { requirement: true },
    });

    // Update org/user verification status
    await this.updateOrgVerificationStatus(submission.organizationId);
    if (submission.requirement.appliesTo === 'employee' && submission.userId) {
      await this.updateUserVerificationStatus(submission.userId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS CHECKS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if all Tier 2 requirements are complete for org
   */
  async checkTier2Complete(orgId: string): Promise<boolean> {
    // Get all required Tier 2 requirements
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        isActive: true,
        tier: 2,
        isRequired: true,
        appliesTo: { in: ['organization', 'owner'] },
      },
      select: { id: true },
    });

    if (requirements.length === 0) return true;

    // Get approved submissions
    const approvedCount = await prisma.verificationSubmission.count({
      where: {
        organizationId: orgId,
        requirementId: { in: requirements.map((r) => r.id) },
        status: 'approved',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return approvedCount >= requirements.length;
  }

  /**
   * Check if org can complete Tier 2 (documents + acknowledgments)
   */
  async canCompleteTier2(
    orgId: string,
    ownerId: string
  ): Promise<{
    canComplete: boolean;
    documentsComplete: boolean;
    missingAcknowledgments: MissingAcknowledgment[];
  }> {
    // Check if all documents are complete
    const documentsComplete = await this.checkTier2Complete(orgId);

    // Check if all acknowledgments are complete
    const { missing: missingAcknowledgments } =
      await acknowledgmentService.canCompleteTier2(ownerId);

    return {
      canComplete: documentsComplete && missingAcknowledgments.length === 0,
      documentsComplete,
      missingAcknowledgments,
    };
  }

  /**
   * Check if owner can add first employee (acknowledgment check)
   */
  async canAddFirstEmployee(ownerId: string): Promise<{
    canAdd: boolean;
    missingAcknowledgments: MissingAcknowledgment[];
  }> {
    const { missing: missingAcknowledgments } =
      await acknowledgmentService.canAddFirstEmployee(ownerId);

    return {
      canAdd: missingAcknowledgments.length === 0,
      missingAcknowledgments,
    };
  }

  /**
   * Check if an employee is fully verified
   */
  async checkEmployeeVerified(userId: string): Promise<boolean> {
    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) return false;

    // Get all required Tier 3 requirements
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        isActive: true,
        tier: 3,
        isRequired: true,
        appliesTo: 'employee',
      },
      select: { id: true },
    });

    if (requirements.length === 0) return true;

    // Get approved submissions
    const approvedCount = await prisma.verificationSubmission.count({
      where: {
        organizationId: user.organizationId,
        userId,
        requirementId: { in: requirements.map((r) => r.id) },
        status: 'approved',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return approvedCount >= requirements.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS UPDATES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update organization's verification status based on submissions
   */
  async updateOrgVerificationStatus(orgId: string): Promise<void> {
    // Check for active compliance blocks
    const hasActiveBlock = await prisma.complianceBlock.count({
      where: {
        organizationId: orgId,
        unblockedAt: null,
      },
    }) > 0;

    if (hasActiveBlock) {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          verificationStatus: 'suspended',
          canReceiveJobs: false,
        },
      });
      return;
    }

    // Get Tier 2 requirements
    const requirements = await this.getRequirementsForOrg(orgId);
    const tier2Requirements = requirements.filter(
      (r) => r.requirement.tier === 2 && r.requirement.isRequired
    );

    // Count statuses
    const approved = tier2Requirements.filter((r) => r.status === 'approved').length;
    const total = tier2Requirements.length;

    // Determine status
    let status: OrgVerificationStatus;
    let canReceiveJobs = false;
    let marketplaceVisible = false;
    let verificationCompletedAt: Date | null = null;

    if (total === 0 || approved === total) {
      status = 'verified';
      canReceiveJobs = true;
      marketplaceVisible = true;
      verificationCompletedAt = new Date();
    } else if (approved > 0) {
      status = 'partial';
      canReceiveJobs = false;
      marketplaceVisible = false;
    } else {
      status = 'pending';
      canReceiveJobs = false;
      marketplaceVisible = false;
    }

    // Calculate compliance score
    const complianceScore = await this.calculateComplianceScore(orgId);

    // Update organization
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        verificationStatus: status,
        canReceiveJobs,
        marketplaceVisible,
        complianceScore,
        verificationCompletedAt:
          status === 'verified' ? verificationCompletedAt : null,
        lastComplianceCheck: new Date(),
      },
    });
  }

  /**
   * Update user's verification status
   */
  async updateUserVerificationStatus(userId: string): Promise<void> {
    const isVerified = await this.checkEmployeeVerified(userId);

    // Check for active compliance blocks
    const hasActiveBlock = await prisma.complianceBlock.count({
      where: {
        userId,
        unblockedAt: null,
      },
    }) > 0;

    let status: UserVerificationStatus;
    let canBeAssignedJobs = false;
    let identityVerified = false;

    if (hasActiveBlock) {
      status = 'suspended';
    } else if (isVerified) {
      status = 'verified';
      canBeAssignedJobs = true;
      identityVerified = true;
    } else {
      status = 'pending';
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: status,
        canBeAssignedJobs,
        identityVerified,
        verificationCompletedAt: status === 'verified' ? new Date() : null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BADGES & COMPLIANCE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get badges earned by organization (Tier 4 approved submissions)
   */
  async getEarnedBadges(orgId: string): Promise<Badge[]> {
    // Get Tier 4 requirements with approved submissions
    const submissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId: orgId,
        status: 'approved',
        requirement: {
          tier: 4,
          isActive: true,
        },
      },
      include: { requirement: true },
    });

    return submissions.map((sub) => ({
      code: sub.requirement.code,
      name: sub.requirement.name,
      icon: sub.requirement.badgeIcon,
      label: sub.requirement.badgeLabel,
      earnedAt: sub.verifiedAt || sub.submittedAt,
      expiresAt: sub.expiresAt,
      isValid: !sub.expiresAt || sub.expiresAt > new Date(),
    }));
  }

  /**
   * Calculate compliance score (percentage of optional badges + requirements)
   */
  async calculateComplianceScore(orgId: string): Promise<number> {
    const requirements = await this.getRequirementsForOrg(orgId);

    if (requirements.length === 0) return 100;

    // Count approved (including expired for Tier 4 badges)
    const approved = requirements.filter((r) => r.status === 'approved').length;

    // Weight: Tier 2 required = 70%, Tier 4 badges = 30%
    const tier2Reqs = requirements.filter((r) => r.requirement.tier === 2);
    const tier4Reqs = requirements.filter((r) => r.requirement.tier === 4);

    const tier2Approved = tier2Reqs.filter((r) => r.status === 'approved').length;
    const tier4Approved = tier4Reqs.filter((r) => r.status === 'approved').length;

    let score = 0;

    // Tier 2 contributes 70%
    if (tier2Reqs.length > 0) {
      score += (tier2Approved / tier2Reqs.length) * 70;
    } else {
      score += 70; // All Tier 2 complete if none required
    }

    // Tier 4 contributes 30%
    if (tier4Reqs.length > 0) {
      score += (tier4Approved / tier4Reqs.length) * 30;
    }
    // Don't add 30 if no Tier 4 badges available

    return Math.round(score);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get full verification summary for an organization
   */
  async getOrgVerificationSummary(orgId: string): Promise<OrgVerificationSummary> {
    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        verificationStatus: true,
        canReceiveJobs: true,
        marketplaceVisible: true,
        complianceScore: true,
        verificationCompletedAt: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get requirements with status
    const requirements = await this.getRequirementsForOrg(orgId);

    // Separate by tier
    const tier2Reqs = requirements.filter((r) => r.requirement.tier === 2);
    const tier4Reqs = requirements.filter((r) => r.requirement.tier === 4);

    // Count by status for Tier 2
    const tier2Stats = {
      total: tier2Reqs.length,
      completed: tier2Reqs.filter((r) => r.status === 'approved').length,
      pending: tier2Reqs.filter((r) =>
        ['not_started', 'pending'].includes(r.status)
      ).length,
      inReview: tier2Reqs.filter((r) => r.status === 'in_review').length,
      rejected: tier2Reqs.filter((r) => r.status === 'rejected').length,
    };

    // Count badges for Tier 4
    const tier4Stats = {
      total: tier4Reqs.length,
      earned: tier4Reqs.filter((r) => r.status === 'approved').length,
    };

    // Get active blocks count
    const activeBlocks = await prisma.complianceBlock.count({
      where: { organizationId: orgId, unblockedAt: null },
    });

    // Get requirements needing attention
    const requiresAttention = requirements.filter(
      (r) =>
        r.status === 'rejected' ||
        r.status === 'expired' ||
        r.isExpiringSoon ||
        (r.requirement.isRequired && r.status === 'not_started')
    );

    return {
      status: org.verificationStatus as OrgVerificationStatus,
      canReceiveJobs: org.canReceiveJobs,
      marketplaceVisible: org.marketplaceVisible,
      complianceScore: org.complianceScore,
      verificationCompletedAt: org.verificationCompletedAt,
      tier2: tier2Stats,
      tier4: tier4Stats,
      activeBlocks,
      requiresAttention,
    };
  }

  /**
   * Get full verification summary for a user/employee
   */
  async getUserVerificationSummary(
    userId: string,
    orgId: string
  ): Promise<UserVerificationSummary> {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        verificationStatus: true,
        canBeAssignedJobs: true,
        identityVerified: true,
        verificationCompletedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get requirements with status
    const requirements = await this.getRequirementsForUser(userId, orgId);

    // Count by status
    const tier3Stats = {
      total: requirements.length,
      completed: requirements.filter((r) => r.status === 'approved').length,
      pending: requirements.filter((r) =>
        ['not_started', 'pending'].includes(r.status)
      ).length,
      inReview: requirements.filter((r) => r.status === 'in_review').length,
      rejected: requirements.filter((r) => r.status === 'rejected').length,
    };

    // Get requirements needing attention
    const requiresAttention = requirements.filter(
      (r) =>
        r.status === 'rejected' ||
        r.status === 'expired' ||
        r.isExpiringSoon ||
        (r.requirement.isRequired && r.status === 'not_started')
    );

    return {
      status: user.verificationStatus as UserVerificationStatus,
      canBeAssignedJobs: user.canBeAssignedJobs,
      identityVerified: user.identityVerified,
      verificationCompletedAt: user.verificationCompletedAt,
      tier3: tier3Stats,
      requiresAttention,
    };
  }
}

// Export singleton instance
export const verificationManager = new VerificationManagerClass();
