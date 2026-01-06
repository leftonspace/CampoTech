/**
 * Block Manager Service
 * =====================
 *
 * Manages compliance blocks for organizations and users.
 * Handles creation, removal, and automatic updates based on
 * subscription and verification status changes.
 *
 * Block Types:
 * - soft_block: Can access dashboard, complete existing jobs,
 *               cannot accept new jobs, not visible in marketplace
 * - hard_block: Can only access /blocked and /billing pages,
 *               all other routes redirect to /blocked
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { ComplianceBlockType } from '@/lib/types/subscription';

// Type for ComplianceBlock from Prisma model
interface ComplianceBlock {
  id: string;
  organizationId: string;
  userId: string | null;
  blockType: ComplianceBlockType;
  reason: string;
  reasonCode: string | null;
  relatedSubmissionId: string | null;
  createdBy: string | null;
  notes: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateBlockInput {
  organizationId: string;
  userId?: string;
  blockType: 'soft_block' | 'hard_block';
  reason: string;
  reasonCode?: string;
  relatedSubmissionId?: string;
  createdBy?: string;
  notes?: string;
}

export interface BlockSummary {
  hasActiveBlocks: boolean;
  hasSoftBlock: boolean;
  hasHardBlock: boolean;
  blocks: ComplianceBlock[];
  reasons: string[];
}

export interface AutoBlockResult {
  blocksCreated: number;
  blocksRemoved: number;
  currentStatus: BlockSummary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Reason codes for categorization */
export const BLOCK_REASON_CODES = {
  // Subscription-related
  TRIAL_EXPIRED: 'trial_expired',
  // Note: No TRIAL_EXPIRED_GRACE - we use immediate block (Netflix model)
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_PAST_DUE: 'payment_past_due',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',

  // Verification-related
  DOCUMENT_EXPIRED: 'document_expired',
  DOCUMENT_REJECTED: 'document_rejected',
  VERIFICATION_INCOMPLETE: 'verification_incomplete',
  VERIFICATION_SUSPENDED: 'verification_suspended',

  // Compliance-related
  MANUAL_ADMIN_BLOCK: 'manual_admin_block',
  FRAUD_SUSPECTED: 'fraud_suspected',
  TERMS_VIOLATION: 'terms_violation',
  LEGAL_HOLD: 'legal_hold',
} as const;

export type BlockReasonCode = (typeof BLOCK_REASON_CODES)[keyof typeof BLOCK_REASON_CODES];

/** 
 * DATA RETENTION PERIOD (Internal Only)
 * Days to keep data after trial expiry before any cleanup.
 * NOT communicated to users - silent safety net for returning customers.
 */
const DATA_RETENTION_DAYS = 30;

/** Days after payment failure to escalate to hard block (payment needs retry window) */
const PAYMENT_GRACE_PERIOD_DAYS = 7;

/** Days after document rejection to apply soft block */
const DOCUMENT_REJECTION_GRACE_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class BlockManager {
  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCK CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new compliance block
   */
  async createBlock(input: CreateBlockInput): Promise<ComplianceBlock> {
    const { organizationId, userId, blockType, reason, reasonCode, relatedSubmissionId, createdBy, notes } = input;

    // Check if similar block already exists
    const existingBlock = await prisma.complianceBlock.findFirst({
      where: {
        organizationId,
        userId: userId || null,
        reasonCode: reasonCode || null,
        unblockedAt: null,
      },
    });

    if (existingBlock) {
      // Update existing block if escalating from soft to hard
      if (existingBlock.blockType === 'soft_block' && blockType === 'hard_block') {
        const updated = await prisma.complianceBlock.update({
          where: { id: existingBlock.id },
          data: {
            blockType: 'hard_block',
            reason,
            notes: notes ? `${existingBlock.notes || ''}\n${notes}` : existingBlock.notes,
          },
        });

        await this.updateOrgAccessFlags(organizationId);
        return updated;
      }

      // Return existing block
      return existingBlock;
    }

    // Create new block
    const block = await prisma.complianceBlock.create({
      data: {
        organizationId,
        userId,
        blockType: blockType as ComplianceBlockType,
        reason,
        reasonCode,
        relatedSubmissionId,
        createdBy,
        notes,
      },
    });

    // Update organization flags
    await this.updateOrgAccessFlags(organizationId);

    // Log the block event
    await this.logBlockEvent(organizationId, 'block_created', {
      blockId: block.id,
      blockType,
      reasonCode,
      reason,
    });

    return block;
  }

  /**
   * Apply a soft block to an organization
   */
  async applySoftBlock(
    organizationId: string,
    reason: string,
    options?: {
      reasonCode?: string;
      submissionId?: string;
      createdBy?: string;
    }
  ): Promise<ComplianceBlock> {
    return this.createBlock({
      organizationId,
      blockType: 'soft_block',
      reason,
      reasonCode: options?.reasonCode,
      relatedSubmissionId: options?.submissionId,
      createdBy: options?.createdBy,
    });
  }

  /**
   * Apply a hard block to an organization
   */
  async applyHardBlock(
    organizationId: string,
    reason: string,
    options?: {
      reasonCode?: string;
      submissionId?: string;
      createdBy?: string;
    }
  ): Promise<ComplianceBlock> {
    return this.createBlock({
      organizationId,
      blockType: 'hard_block',
      reason,
      reasonCode: options?.reasonCode,
      relatedSubmissionId: options?.submissionId,
      createdBy: options?.createdBy,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCK REMOVAL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Remove a specific block (admin action)
   */
  async removeBlock(
    blockId: string,
    adminId: string,
    unblockReason?: string
  ): Promise<void> {
    const block = await prisma.complianceBlock.findUnique({
      where: { id: blockId },
    });

    if (!block) {
      throw new Error(`Block not found: ${blockId}`);
    }

    if (block.unblockedAt) {
      throw new Error('Block is already removed');
    }

    await prisma.complianceBlock.update({
      where: { id: blockId },
      data: {
        unblockedAt: new Date(),
        unblockedBy: adminId,
        unblockReason: unblockReason || 'Admin action',
      },
    });

    // Update organization flags
    await this.updateOrgAccessFlags(block.organizationId);

    // Log the unblock event
    await this.logBlockEvent(block.organizationId, 'block_removed', {
      blockId,
      unblockedBy: adminId,
      unblockReason,
    });
  }

  /**
   * Remove all blocks with a specific reason code
   */
  async removeBlocksByReasonCode(
    organizationId: string,
    reasonCode: string,
    adminId?: string
  ): Promise<number> {
    const result = await prisma.complianceBlock.updateMany({
      where: {
        organizationId,
        reasonCode,
        unblockedAt: null,
      },
      data: {
        unblockedAt: new Date(),
        unblockedBy: adminId || 'system',
        unblockReason: 'Auto-resolved',
      },
    });

    if (result.count > 0) {
      await this.updateOrgAccessFlags(organizationId);
      await this.logBlockEvent(organizationId, 'blocks_auto_removed', {
        reasonCode,
        count: result.count,
      });
    }

    return result.count;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCK QUERIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all active blocks for an organization
   */
  async getActiveBlocks(organizationId: string): Promise<ComplianceBlock[]> {
    return prisma.complianceBlock.findMany({
      where: {
        organizationId,
        unblockedAt: null,
      },
      orderBy: { blockedAt: 'desc' },
    });
  }

  /**
   * Get block reasons for display
   */
  async getBlockReasons(organizationId: string): Promise<string[]> {
    const blocks = await this.getActiveBlocks(organizationId);
    return blocks.map((b) => b.reason);
  }

  /**
   * Get block summary for an organization
   */
  async getBlockSummary(organizationId: string): Promise<BlockSummary> {
    const blocks = await this.getActiveBlocks(organizationId);

    return {
      hasActiveBlocks: blocks.length > 0,
      hasSoftBlock: blocks.some((b) => b.blockType === 'soft_block'),
      hasHardBlock: blocks.some((b) => b.blockType === 'hard_block'),
      blocks,
      reasons: blocks.map((b) => b.reason),
    };
  }

  /**
   * Check if organization has any hard blocks
   */
  async hasHardBlock(organizationId: string): Promise<boolean> {
    const count = await prisma.complianceBlock.count({
      where: {
        organizationId,
        blockType: 'hard_block',
        unblockedAt: null,
      },
    });
    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTOMATIC BLOCK MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check and update blocks based on current organization status
   * Called after subscription/verification status changes
   */
  async checkAndUpdateBlocks(organizationId: string): Promise<AutoBlockResult> {
    let blocksCreated = 0;
    let blocksRemoved = 0;

    // Get organization with all relevant data
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        verificationStatus: true,
      },
    });

    if (!org) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    const now = new Date();

    // ─── CHECK SUBSCRIPTION STATUS ───────────────────────────────────────────

    // Trial expired - IMMEDIATE HARD BLOCK (no visible grace period)
    // Industry standard: Netflix/Spotify model - pay or locked, no countdown
    // Data is retained silently for DATA_RETENTION_DAYS for returning customers
    if (org.subscriptionStatus === 'expired' ||
      (org.subscriptionStatus === 'trialing' && org.trialEndsAt && org.trialEndsAt < now)) {

      // Immediate hard block - no "X days remaining" messaging
      // This prevents users from gaming the system by waiting for grace period
      await this.applyHardBlock(
        organizationId,
        'Tu período de prueba ha terminado. Elegí un plan para seguir usando CampoTech.',
        { reasonCode: BLOCK_REASON_CODES.TRIAL_EXPIRED }
      );
      blocksCreated++;

      // Note: Data is retained for DATA_RETENTION_DAYS internally,
      // but this is NOT communicated to users (silent safety net)

    } else {
      // Remove trial expired blocks if trial is active
      if (org.subscriptionStatus === 'trialing' && org.trialEndsAt && org.trialEndsAt > now) {
        const removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.TRIAL_EXPIRED);
        blocksRemoved += removed;
      }
    }

    // Payment past due
    if (org.subscriptionStatus === 'past_due') {
      await this.applySoftBlock(organizationId, 'Tu pago está vencido. Actualizá tu método de pago.', {
        reasonCode: BLOCK_REASON_CODES.PAYMENT_PAST_DUE,
      });
      blocksCreated++;
    } else {
      // Remove payment blocks if subscription is active
      if (org.subscriptionStatus === 'active') {
        let removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.PAYMENT_PAST_DUE);
        removed += await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.PAYMENT_FAILED);
        blocksRemoved += removed;
      }
    }

    // Subscription cancelled
    if (org.subscriptionStatus === 'cancelled') {
      await this.applySoftBlock(organizationId, 'Tu suscripción ha sido cancelada.', {
        reasonCode: BLOCK_REASON_CODES.SUBSCRIPTION_CANCELLED,
      });
      blocksCreated++;
    } else {
      if (org.subscriptionStatus === 'active') {
        const removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.SUBSCRIPTION_CANCELLED);
        blocksRemoved += removed;
      }
    }

    // ─── CHECK VERIFICATION STATUS ───────────────────────────────────────────

    if (org.verificationStatus === 'suspended') {
      await this.applyHardBlock(organizationId, 'Tu verificación ha sido suspendida. Contactá soporte.', {
        reasonCode: BLOCK_REASON_CODES.VERIFICATION_SUSPENDED,
      });
      blocksCreated++;
    } else if (org.verificationStatus === 'verified') {
      // Remove verification-related blocks
      let removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.VERIFICATION_SUSPENDED);
      removed += await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.VERIFICATION_INCOMPLETE);
      blocksRemoved += removed;
    }

    // ─── CHECK FOR EXPIRED DOCUMENTS ─────────────────────────────────────────

    const expiredDocs = await this.checkExpiredDocuments(organizationId);
    if (expiredDocs.length > 0) {
      await this.applySoftBlock(
        organizationId,
        `Tenés ${expiredDocs.length} documento(s) vencido(s). Actualizalos para continuar.`,
        { reasonCode: BLOCK_REASON_CODES.DOCUMENT_EXPIRED }
      );
      blocksCreated++;
    } else {
      const removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.DOCUMENT_EXPIRED);
      blocksRemoved += removed;
    }

    // ─── CHECK FOR REJECTED DOCUMENTS WITHOUT RESUBMISSION ───────────────────

    const rejectedWithoutResubmission = await this.checkRejectedDocuments(organizationId);
    if (rejectedWithoutResubmission.length > 0) {
      // Check if rejection is older than grace period
      const oldestRejection = rejectedWithoutResubmission.reduce((a, b) =>
        a.reviewedAt! < b.reviewedAt! ? a : b
      );
      const daysSinceRejection = Math.floor(
        (now.getTime() - oldestRejection.reviewedAt!.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRejection >= DOCUMENT_REJECTION_GRACE_DAYS) {
        await this.applySoftBlock(
          organizationId,
          'Tenés documentos rechazados sin reenviar. Volvé a enviarlos.',
          { reasonCode: BLOCK_REASON_CODES.DOCUMENT_REJECTED }
        );
        blocksCreated++;
      }
    } else {
      const removed = await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.DOCUMENT_REJECTED);
      blocksRemoved += removed;
    }

    // Get final status
    const currentStatus = await this.getBlockSummary(organizationId);

    return {
      blocksCreated,
      blocksRemoved,
      currentStatus,
    };
  }

  /**
   * Attempt to auto-unblock when issues are resolved
   */
  async attemptAutoUnblock(organizationId: string): Promise<boolean> {
    const result = await this.checkAndUpdateBlocks(organizationId);
    return result.blocksRemoved > 0;
  }

  /**
   * Called when payment is completed - remove subscription blocks
   */
  async onPaymentCompleted(organizationId: string): Promise<void> {
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.TRIAL_EXPIRED);
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.PAYMENT_FAILED);
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.PAYMENT_PAST_DUE);
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.SUBSCRIPTION_EXPIRED);

    await this.updateOrgAccessFlags(organizationId);
  }

  /**
   * Called when all required documents are approved - remove verification blocks
   */
  async onVerificationComplete(organizationId: string): Promise<void> {
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.DOCUMENT_EXPIRED);
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.DOCUMENT_REJECTED);
    await this.removeBlocksByReasonCode(organizationId, BLOCK_REASON_CODES.VERIFICATION_INCOMPLETE);

    await this.updateOrgAccessFlags(organizationId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update organization access flags based on current blocks
   */
  private async updateOrgAccessFlags(organizationId: string): Promise<void> {
    const summary = await this.getBlockSummary(organizationId);

    // Get current verification and subscription status
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        verificationStatus: true,
      },
    });

    if (!org) return;

    // Determine access levels
    const isSubscriptionActive = ['active', 'trialing'].includes(org.subscriptionStatus);
    const isVerified = org.verificationStatus === 'verified';

    const canReceiveJobs =
      isSubscriptionActive &&
      isVerified &&
      !summary.hasHardBlock &&
      !summary.hasSoftBlock;

    const marketplaceVisible =
      canReceiveJobs &&
      !summary.hasActiveBlocks;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        canReceiveJobs,
        marketplaceVisible,
      },
    });
  }

  /**
   * Check for expired required documents
   */
  private async checkExpiredDocuments(organizationId: string): Promise<{ requirementId: string; code: string }[]> {
    const now = new Date();

    const expiredSubmissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId,
        status: 'approved',
        expiresAt: { lt: now },
        requirement: {
          isRequired: true,
          isActive: true,
        },
      },
      select: {
        requirementId: true,
        requirement: {
          select: { code: true },
        },
      },
    });

    type ExpiredSubmission = (typeof expiredSubmissions)[number];
    return expiredSubmissions.map((s: ExpiredSubmission) => ({
      requirementId: s.requirementId,
      code: s.requirement.code,
    }));
  }

  /**
   * Check for rejected documents without resubmission
   */
  private async checkRejectedDocuments(organizationId: string): Promise<
    { requirementId: string; code: string; reviewedAt: Date | null }[]
  > {
    // Find requirements where latest submission is rejected
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        isRequired: true,
        isActive: true,
        tier: 2,
      },
      select: { id: true, code: true },
    });

    const results: { requirementId: string; code: string; reviewedAt: Date | null }[] = [];

    for (const req of requirements) {
      const latestSubmission = await prisma.verificationSubmission.findFirst({
        where: {
          organizationId,
          requirementId: req.id,
        },
        orderBy: { submittedAt: 'desc' },
        select: {
          status: true,
          reviewedAt: true,
        },
      });

      if (latestSubmission?.status === 'rejected') {
        results.push({
          requirementId: req.id,
          code: req.code,
          reviewedAt: latestSubmission.reviewedAt,
        });
      }
    }

    return results;
  }

  /**
   * Log a block-related event
   */
  private async logBlockEvent(
    organizationId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          eventType: `compliance.${eventType}`,
          eventData: data as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error('[BlockManager] Failed to log event:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Admin: Apply manual block
   */
  async adminBlock(
    organizationId: string,
    adminId: string,
    options: {
      blockType: 'soft_block' | 'hard_block';
      reason: string;
      reasonCode?: string;
      notes?: string;
    }
  ): Promise<ComplianceBlock> {
    return this.createBlock({
      organizationId,
      blockType: options.blockType,
      reason: options.reason,
      reasonCode: options.reasonCode || BLOCK_REASON_CODES.MANUAL_ADMIN_BLOCK,
      createdBy: adminId,
      notes: options.notes,
    });
  }

  /**
   * Admin: Get block history for an organization
   */
  async getBlockHistory(organizationId: string): Promise<ComplianceBlock[]> {
    return prisma.complianceBlock.findMany({
      where: { organizationId },
      orderBy: { blockedAt: 'desc' },
    });
  }

  /**
   * Admin: Get all organizations with active blocks
   */
  async getBlockedOrganizations(): Promise<
    {
      organizationId: string;
      organizationName: string;
      blockCount: number;
      hasHardBlock: boolean;
    }[]
  > {
    const grouped = await prisma.complianceBlock.groupBy({
      by: ['organizationId'],
      where: { unblockedAt: null },
      _count: { id: true },
    });

    type GroupedEntry = (typeof grouped)[number];
    const results = await Promise.all(
      grouped.map(async (g: GroupedEntry) => {
        const org = await prisma.organization.findUnique({
          where: { id: g.organizationId },
          select: { name: true },
        });

        const hasHardBlock = await this.hasHardBlock(g.organizationId);

        return {
          organizationId: g.organizationId,
          organizationName: org?.name || 'Unknown',
          blockCount: g._count.id,
          hasHardBlock,
        };
      })
    );

    return results.sort((a, b) => (a.hasHardBlock === b.hasHardBlock ? 0 : a.hasHardBlock ? -1 : 1));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const blockManager = new BlockManager();
export default blockManager;
