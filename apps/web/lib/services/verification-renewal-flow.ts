/**
 * CampoTech Verification Renewal Flow
 * =====================================
 *
 * Manages the document renewal/expiration workflow:
 * 1. Document expiring notification (30, 14, 7, 1 days)
 * 2. User uploads new document
 * 3. New document goes to review queue
 * 4. Old document NOT invalidated until new is approved
 * 5. If new rejected: keep old valid during grace period
 * 6. If new approved: archive old, activate new
 *
 * Business Rules:
 * - Old document remains valid while new is in review
 * - Grace period of 7 days after rejection for correction
 * - Expiration reminders at 30, 14, 7, 1 days
 * - Auto-block if document expires without renewal
 */

import { prisma } from '@/lib/prisma';
import { verificationManager } from './verification-manager';

// Type for VerificationSubmission from Prisma model
type VerificationSubmission = Awaited<ReturnType<typeof prisma.verificationSubmission.findFirst>> & {};
import { blockManager, BLOCK_REASON_CODES } from './block-manager';
import { funnelTracker } from './funnel-tracker';
import {
  sendDocumentExpiringEmail,
  sendDocumentExpiredEmail,
  sendDocumentApprovedEmail,
  sendDocumentRejectedEmail,
} from '@/lib/email/verification-emails';
import {
  notifyDocumentExpiring,
  notifyDocumentExpired,
  notifyDocumentApproved,
  notifyDocumentRejected,
} from '@/lib/notifications/verification-notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Days before expiry to send reminders */
export const EXPIRING_REMINDER_DAYS = [30, 14, 7, 1];

/** Grace period after rejection (days) */
export const REJECTION_GRACE_DAYS = 7;

/** Grace period after expiration for required documents (days) */
export const EXPIRATION_GRACE_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RenewalSubmissionResult {
  success: boolean;
  submission?: VerificationSubmission;
  previousSubmission?: VerificationSubmission;
  error?: string;
  status: 'submitted' | 'auto_approved' | 'pending_review' | 'error';
}

export interface RenewalApprovalResult {
  success: boolean;
  newSubmission?: VerificationSubmission;
  archivedSubmission?: VerificationSubmission;
  badgeEarned?: { label: string; icon: string };
  error?: string;
}

export interface RenewalRejectionResult {
  success: boolean;
  submission?: VerificationSubmission;
  previousStillValid: boolean;
  gracePeriodEnds?: Date;
  error?: string;
}

export interface ExpiringDocument {
  submissionId: string;
  organizationId: string;
  userId: string | null;
  requirementCode: string;
  requirementName: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  ownerEmail: string;
  ownerName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION RENEWAL FLOW SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class VerificationRenewalFlowService {
  /**
   * Submit a renewal document
   * Old document remains valid until new one is approved
   */
  async submitRenewal(
    organizationId: string,
    requirementCode: string,
    input: {
      documentUrl?: string;
      documentType?: string;
      documentFilename?: string;
      submittedValue?: string;
      expiresAt?: Date;
      userId?: string;
    }
  ): Promise<RenewalSubmissionResult> {
    try {
      // Get the current approved submission (if any)
      const requirement = await prisma.verificationRequirement.findUnique({
        where: { code: requirementCode },
      });

      if (!requirement) {
        return { success: false, error: 'Requirement not found', status: 'error' };
      }

      const previousSubmission = await prisma.verificationSubmission.findFirst({
        where: {
          organizationId,
          requirementId: requirement.id,
          status: 'approved',
        },
        orderBy: { approvedAt: 'desc' },
      });

      // Determine user ID
      const userId = input.userId || (
        await prisma.user.findFirst({
          where: { organizationId, role: 'OWNER' },
          select: { id: true },
        })
      )?.id;

      if (!userId) {
        return { success: false, error: 'Could not determine user', status: 'error' };
      }

      // Create new submission (marked as renewal if previous exists)
      const newSubmission = await prisma.verificationSubmission.create({
        data: {
          organizationId,
          requirementId: requirement.id,
          userId,
          status: requirement.autoVerifySource ? 'pending' : 'in_review',
          submittedValue: input.submittedValue,
          documentUrl: input.documentUrl,
          documentType: input.documentType,
          documentFilename: input.documentFilename,
          expiresAt: input.expiresAt,
          submittedAt: new Date(),
          isRenewal: previousSubmission !== null,
          previousSubmissionId: previousSubmission?.id,
        },
      });

      // Track renewal submission
      await funnelTracker.trackEvent({
        event: 'document_renewal_submitted',
        organizationId,
        userId,
        metadata: {
          requirementCode,
          isRenewal: previousSubmission !== null,
          previousExpiresAt: previousSubmission?.expiresAt?.toISOString(),
        },
      });

      // Attempt auto-verification if configured
      if (requirement.autoVerifySource) {
        // Auto-verification happens in verificationManager.submitVerification
        // For now, mark as submitted
        return {
          success: true,
          submission: newSubmission,
          previousSubmission: previousSubmission || undefined,
          status: 'pending_review',
        };
      }

      return {
        success: true,
        submission: newSubmission,
        previousSubmission: previousSubmission || undefined,
        status: 'pending_review',
      };
    } catch (error) {
      console.error('[VerificationRenewal] Submit error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }

  /**
   * Approve a renewal submission
   * Archives the old document and activates the new one
   */
  async approveRenewal(
    submissionId: string,
    adminId: string,
    newExpiresAt?: Date
  ): Promise<RenewalApprovalResult> {
    try {
      const submission = await prisma.verificationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          requirement: true,
          organization: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      });

      if (!submission) {
        return { success: false, error: 'Submission not found' };
      }

      // Get the previous submission if this is a renewal
      const previousSubmission = submission.previousSubmissionId
        ? await prisma.verificationSubmission.findUnique({
          where: { id: submission.previousSubmissionId },
        })
        : null;

      // Approve the new submission
      const updatedSubmission = await prisma.verificationSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          verifiedAt: new Date(),
          verifiedBy: 'admin',
          verifiedByUserId: adminId,
          expiresAt: newExpiresAt || submission.expiresAt,
        },
      });

      // Archive the old submission if this is a renewal
      if (previousSubmission) {
        await prisma.verificationSubmission.update({
          where: { id: previousSubmission.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archivedReason: 'Replaced by renewal',
            replacedById: submissionId,
          },
        });
      }

      // Check if this earns a badge (Tier 4 requirements)
      let badgeEarned: { label: string; icon: string } | undefined;
      if (submission.requirement.tier === 4 && submission.requirement.badgeLabel) {
        badgeEarned = {
          label: submission.requirement.badgeLabel,
          icon: submission.requirement.badgeIcon || 'award',
        };
      }

      // Send approval notification
      if (submission.organization.owner?.email) {
        await sendDocumentApprovedEmail(
          {
            userId: submission.organization.ownerId!,
            userName: submission.organization.owner.name || 'Usuario',
            userEmail: submission.organization.owner.email,
          },
          {
            organizationId: submission.organizationId,
            organizationName: submission.organization.name,
          },
          {
            documentId: submission.id,
            documentName: submission.requirement.name,
            documentType: submission.requirement.code,
            expiresAt: updatedSubmission.expiresAt || undefined,
          },
          badgeEarned
        );

        await notifyDocumentApproved(
          submission.organizationId,
          submission.organization.ownerId!,
          submission.requirement.name,
          badgeEarned
        );
      }

      // Remove any document-related blocks
      await blockManager.removeBlocksByReasonCode(
        submission.organizationId,
        BLOCK_REASON_CODES.DOCUMENT_EXPIRED
      );
      await blockManager.removeBlocksByReasonCode(
        submission.organizationId,
        BLOCK_REASON_CODES.DOCUMENT_REJECTED
      );

      // Update verification status
      await verificationManager.updateOrgVerificationStatus(submission.organizationId);

      // Track approval
      await funnelTracker.trackEvent({
        event: 'document_renewal_approved',
        organizationId: submission.organizationId,
        metadata: {
          requirementCode: submission.requirement.code,
          isRenewal: submission.isRenewal,
          badgeEarned: badgeEarned?.label,
        },
      });

      return {
        success: true,
        newSubmission: updatedSubmission,
        archivedSubmission: previousSubmission || undefined,
        badgeEarned,
      };
    } catch (error) {
      console.error('[VerificationRenewal] Approve error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reject a renewal submission
   * Old document remains valid during grace period
   */
  async rejectRenewal(
    submissionId: string,
    adminId: string,
    reason: string,
    reasonCode?: string
  ): Promise<RenewalRejectionResult> {
    try {
      const submission = await prisma.verificationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          requirement: true,
          organization: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      });

      if (!submission) {
        return { success: false, error: 'Submission not found', previousStillValid: false };
      }

      // Reject the submission
      const rejectedSubmission = await prisma.verificationSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          rejectionCode: reasonCode,
          reviewedAt: new Date(),
          verifiedBy: 'admin',
          verifiedByUserId: adminId,
        },
      });

      // Check if previous submission exists and is still valid
      let previousStillValid = false;
      const previousSubmission = submission.previousSubmissionId
        ? await prisma.verificationSubmission.findUnique({
          where: { id: submission.previousSubmissionId },
        })
        : null;

      if (previousSubmission && previousSubmission.status === 'approved') {
        // Check if previous hasn't expired yet
        if (!previousSubmission.expiresAt || previousSubmission.expiresAt > new Date()) {
          previousStillValid = true;
        }
      }

      // Calculate grace period
      const gracePeriodEnds = new Date();
      gracePeriodEnds.setDate(gracePeriodEnds.getDate() + REJECTION_GRACE_DAYS);

      // Send rejection notification
      if (submission.organization.owner?.email) {
        await sendDocumentRejectedEmail(
          {
            userId: submission.organization.ownerId!,
            userName: submission.organization.owner.name || 'Usuario',
            userEmail: submission.organization.owner.email,
          },
          {
            organizationId: submission.organizationId,
            organizationName: submission.organization.name,
          },
          {
            documentId: submission.id,
            documentName: submission.requirement.name,
            documentType: submission.requirement.code,
          },
          reason
        );

        await notifyDocumentRejected(
          submission.organizationId,
          submission.organization.ownerId!,
          submission.requirement.name,
          reason
        );
      }

      // Track rejection
      await funnelTracker.trackEvent({
        event: 'document_renewal_rejected',
        organizationId: submission.organizationId,
        metadata: {
          requirementCode: submission.requirement.code,
          reason,
          previousStillValid,
        },
      });

      return {
        success: true,
        submission: rejectedSubmission,
        previousStillValid,
        gracePeriodEnds,
      };
    } catch (error) {
      console.error('[VerificationRenewal] Reject error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        previousStillValid: false,
      };
    }
  }

  /**
   * Get documents expiring within the specified days
   * Used by cron job to send reminders
   */
  async getExpiringDocuments(daysFromNow: number): Promise<ExpiringDocument[]> {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysFromNow);

    // Set day boundaries
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const expiringSubmissions = await prisma.verificationSubmission.findMany({
      where: {
        status: 'approved',
        isArchived: false,
        expiresAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        requirement: true,
        organization: {
          select: {
            id: true,
            ownerId: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
    });

    type ExpiringEntry = (typeof expiringSubmissions)[number];
    return expiringSubmissions
      .filter((s: ExpiringEntry) => s.organization.owner?.email)
      .map((s: ExpiringEntry) => ({
        submissionId: s.id,
        organizationId: s.organizationId,
        userId: s.userId,
        requirementCode: s.requirement.code,
        requirementName: s.requirement.name,
        expiresAt: s.expiresAt!,
        daysUntilExpiry: daysFromNow,
        ownerEmail: s.organization.owner!.email!,
        ownerName: s.organization.owner!.name || 'Usuario',
      }));
  }

  /**
   * Send expiration reminder for a specific document
   */
  async sendExpirationReminder(
    submissionId: string,
    daysRemaining: number
  ): Promise<boolean> {
    try {
      const submission = await prisma.verificationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          requirement: true,
          organization: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      });

      if (!submission || !submission.organization.owner?.email) {
        return false;
      }

      // Check if we already sent a reminder for this day
      const existingReminder = await prisma.verificationReminder.findFirst({
        where: {
          submissionId,
          reminderType: 'expiring_soon',
          daysUntilExpiry: daysRemaining,
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      if (existingReminder) {
        return false; // Already sent
      }

      // Send email
      await sendDocumentExpiringEmail(
        {
          userId: submission.organization.ownerId!,
          userName: submission.organization.owner.name || 'Usuario',
          userEmail: submission.organization.owner.email,
        },
        {
          organizationId: submission.organizationId,
          organizationName: submission.organization.name,
        },
        {
          documentId: submission.id,
          documentName: submission.requirement.name,
          documentType: submission.requirement.code,
          expiresAt: submission.expiresAt || undefined,
        },
        daysRemaining
      );

      // Send in-app notification
      await notifyDocumentExpiring(
        submission.organizationId,
        submission.organization.ownerId!,
        submission.requirement.name,
        daysRemaining
      );

      // Log the reminder
      await prisma.verificationReminder.create({
        data: {
          submissionId,
          recipientUserId: submission.organization.ownerId!,
          reminderType: 'expiring_soon',
          daysUntilExpiry: daysRemaining,
          channel: 'email',
        },
      });

      return true;
    } catch (error) {
      console.error('[VerificationRenewal] Send reminder error:', error);
      return false;
    }
  }

  /**
   * Process expired documents
   * Called by cron job
   */
  async processExpiredDocuments(): Promise<{
    processed: number;
    blocked: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const now = new Date();
    let processed = 0;
    let blocked = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Find approved documents that have expired
    const expiredSubmissions = await prisma.verificationSubmission.findMany({
      where: {
        status: 'approved',
        isArchived: false,
        expiresAt: {
          lt: now,
        },
      },
      include: {
        requirement: true,
        organization: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
    });

    for (const submission of expiredSubmissions) {
      try {
        processed++;

        // Update status to expired
        await prisma.verificationSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'expired',
            expiryNotifiedAt: now,
          },
        });

        // Send expiration notification
        if (submission.organization.owner?.email) {
          await sendDocumentExpiredEmail(
            {
              userId: submission.organization.ownerId!,
              userName: submission.organization.owner.name || 'Usuario',
              userEmail: submission.organization.owner.email,
            },
            {
              organizationId: submission.organizationId,
              organizationName: submission.organization.name,
            },
            {
              documentId: submission.id,
              documentName: submission.requirement.name,
              documentType: submission.requirement.code,
              expiresAt: submission.expiresAt || undefined,
            }
          );

          await notifyDocumentExpired(
            submission.organizationId,
            submission.organization.ownerId!,
            submission.requirement.name
          );
        }

        // Apply block if this is a required document
        if (submission.requirement.isRequired) {
          await blockManager.applySoftBlock(
            submission.organizationId,
            `Documento requerido vencido: ${submission.requirement.name}`,
            {
              reasonCode: BLOCK_REASON_CODES.DOCUMENT_EXPIRED,
              submissionId: submission.id,
            }
          );
          blocked++;
        }

        // Update verification status
        await verificationManager.updateOrgVerificationStatus(submission.organizationId);
      } catch (error) {
        errors.push({
          id: submission.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { processed, blocked, errors };
  }

  /**
   * Get renewal status for a requirement
   */
  async getRenewalStatus(
    organizationId: string,
    requirementCode: string
  ): Promise<{
    currentSubmission: VerificationSubmission | null;
    pendingRenewal: VerificationSubmission | null;
    needsRenewal: boolean;
    daysUntilExpiry: number | null;
    isExpired: boolean;
  }> {
    const requirement = await prisma.verificationRequirement.findUnique({
      where: { code: requirementCode },
    });

    if (!requirement) {
      return {
        currentSubmission: null,
        pendingRenewal: null,
        needsRenewal: false,
        daysUntilExpiry: null,
        isExpired: false,
      };
    }

    // Get current approved submission
    const currentSubmission = await prisma.verificationSubmission.findFirst({
      where: {
        organizationId,
        requirementId: requirement.id,
        status: 'approved',
        isArchived: false,
      },
      orderBy: { approvedAt: 'desc' },
    });

    // Get pending renewal submission
    const pendingRenewal = await prisma.verificationSubmission.findFirst({
      where: {
        organizationId,
        requirementId: requirement.id,
        status: { in: ['pending', 'in_review'] },
        isRenewal: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Calculate days until expiry
    let daysUntilExpiry: number | null = null;
    let isExpired = false;
    let needsRenewal = false;

    if (currentSubmission?.expiresAt) {
      const now = new Date();
      const diffMs = currentSubmission.expiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        isExpired = true;
        needsRenewal = true;
      } else if (daysUntilExpiry <= 30) {
        needsRenewal = true;
      }
    }

    return {
      currentSubmission,
      pendingRenewal,
      needsRenewal,
      daysUntilExpiry,
      isExpired,
    };
  }
}

// Export singleton
export const verificationRenewalFlow = new VerificationRenewalFlowService();
