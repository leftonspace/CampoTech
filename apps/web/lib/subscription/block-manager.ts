/**
 * Block Manager
 * ==============
 * 
 * Manages access blocking for organizations based on subscription status.
 * 
 * Block Types:
 * - soft_block: Limited access (can view dashboard, cannot create jobs)
 * - hard_block: Severely limited access (only billing page accessible)
 * 
 * Used for:
 * - Trial expiration
 * - Payment failures
 * - Subscription cancellation
 */

import { prisma } from '@/lib/prisma';

// Types
export type BlockType = 'soft_block' | 'hard_block' | null;

export interface BlockStatus {
    isBlocked: boolean;
    blockType: BlockType;
    blockReason: string | null;
    blockedAt: Date | null;
    canAccessDashboard: boolean;
    canAccessBilling: boolean;
    canReceiveJobs: boolean;
}

export interface BlockResult {
    success: boolean;
    error?: string;
    newBlockType?: BlockType;
    alreadyMaxBlock?: boolean;
}

/**
 * Block Manager Class
 */
class BlockManager {
    /**
     * Apply a block to an organization
     */
    async applyBlock(
        organizationId: string,
        blockType: 'soft_block' | 'hard_block',
        reason: string
    ): Promise<BlockResult> {
        try {
            // Check if organization exists
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
            });

            if (!org) {
                return {
                    success: false,
                    error: 'Organization not found',
                };
            }

            // Update organization with block
            await prisma.organization.update({
                where: { id: organizationId },
                data: {
                    blockType,
                    blockReason: reason,
                    blockedAt: new Date(),
                },
            });

            // Log the block event
            await prisma.subscriptionEvent.create({
                data: {
                    organizationId,
                    eventType: 'block_applied',
                    eventData: {
                        blockType,
                        reason,
                        timestamp: new Date().toISOString(),
                    },
                },
            });

            return {
                success: true,
                newBlockType: blockType,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Remove block from an organization
     */
    async removeBlock(
        organizationId: string,
        reason: string
    ): Promise<BlockResult> {
        try {
            // Get current organization state
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
            });

            if (!org) {
                return {
                    success: false,
                    error: 'Organization not found',
                };
            }

            const previousBlockType = org.blockType;

            // Remove block
            await prisma.organization.update({
                where: { id: organizationId },
                data: {
                    blockType: null,
                    blockReason: null,
                    blockedAt: null,
                },
            });

            // Log the removal event
            await prisma.subscriptionEvent.create({
                data: {
                    organizationId,
                    eventType: 'block_removed',
                    eventData: {
                        reason,
                        previousBlockType,
                        timestamp: new Date().toISOString(),
                    },
                },
            });

            return {
                success: true,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get block status for an organization
     */
    async getBlockStatus(organizationId: string): Promise<BlockStatus> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                blockType: true,
                blockReason: true,
                blockedAt: true,
            },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        const isBlocked = org.blockType !== null;
        const blockType = org.blockType as BlockType;

        // Determine access permissions based on block type
        let canAccessDashboard = true;
        let canAccessBilling = true;
        let canReceiveJobs = true;

        if (blockType === 'soft_block') {
            canAccessDashboard = true;
            canAccessBilling = true;
            canReceiveJobs = false;
        } else if (blockType === 'hard_block') {
            canAccessDashboard = false;
            canAccessBilling = true; // Can still access billing to resolve issue
            canReceiveJobs = false;
        }

        return {
            isBlocked,
            blockType,
            blockReason: org.blockReason,
            blockedAt: org.blockedAt,
            canAccessDashboard,
            canAccessBilling,
            canReceiveJobs,
        };
    }

    /**
     * Escalate block level (soft -> hard)
     */
    async escalateBlock(
        organizationId: string,
        reason: string
    ): Promise<BlockResult> {
        try {
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
            });

            if (!org) {
                return {
                    success: false,
                    error: 'Organization not found',
                };
            }

            // If already hard blocked, nothing to escalate
            if (org.blockType === 'hard_block') {
                return {
                    success: true,
                    alreadyMaxBlock: true,
                };
            }

            // Determine new block type
            const newBlockType: 'soft_block' | 'hard_block' =
                org.blockType === 'soft_block' ? 'hard_block' : 'soft_block';

            // Apply the escalated block
            await prisma.organization.update({
                where: { id: organizationId },
                data: {
                    blockType: newBlockType,
                    blockReason: reason,
                    blockedAt: new Date(),
                },
            });

            // Log escalation event
            await prisma.subscriptionEvent.create({
                data: {
                    organizationId,
                    eventType: 'block_escalated',
                    eventData: {
                        from: org.blockType,
                        to: newBlockType,
                        reason,
                        timestamp: new Date().toISOString(),
                    },
                },
            });

            return {
                success: true,
                newBlockType,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get all blocked organizations
     */
    async getBlockedOrganizations(
        blockType?: 'soft_block' | 'hard_block'
    ): Promise<any[]> {
        const where: any = {
            blockType: {
                not: null,
            },
        };

        if (blockType) {
            where.blockType = blockType;
        }

        return await prisma.organization.findMany({
            where,
            select: {
                id: true,
                name: true,
                blockType: true,
                blockReason: true,
                blockedAt: true,
                subscriptionStatus: true,
                subscriptionTier: true,
            },
        });
    }

    /**
     * Check and apply blocks (cron job)
     * 
     * This should be run periodically to:
     * - Block orgs with expired trials past grace period
     * - Escalate soft blocks to hard blocks after extended period
     */
    async checkAndApplyBlocks(): Promise<{
        blocksApplied: number;
        escalated: number;
    }> {
        let blocksApplied = 0;
        let escalated = 0;

        const now = new Date();
        const gracePeriodDays = 7; // 7 days grace period after trial expiration
        const escalationDays = 14; // Escalate to hard block after 14 days

        // Find organizations that should be blocked
        const orgsToBlock = await prisma.organization.findMany({
            where: {
                subscriptionStatus: 'expired',
                blockType: null,
                trialEndsAt: {
                    lt: new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000),
                },
            },
        });

        // Apply soft blocks
        for (const org of orgsToBlock) {
            await this.applyBlock(
                org.id,
                'soft_block',
                'Trial expired - grace period ended'
            );
            blocksApplied++;
        }

        // Find soft blocks that should be escalated
        const orgsToEscalate = await prisma.organization.findMany({
            where: {
                blockType: 'soft_block',
                blockedAt: {
                    lt: new Date(now.getTime() - escalationDays * 24 * 60 * 60 * 1000),
                },
            },
        });

        // Escalate to hard blocks
        for (const org of orgsToEscalate) {
            await this.escalateBlock(
                org.id,
                'Extended non-payment - escalating to hard block'
            );
            escalated++;
        }

        return {
            blocksApplied,
            escalated,
        };
    }
}

// Export singleton instance
export const blockManager = new BlockManager();
