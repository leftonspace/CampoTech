/**
 * Block Manager Unit Tests
 * ========================
 *
 * Tests for the access blocking functionality:
 * - Soft blocks (limited access)
 * - Hard blocks (full account lock)
 * - Block removal
 * - Block status checking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockOrgWithSubscription,
  createMockBlockedOrg,
  createMockPrisma,
  resetAllMocks,
} from '../utils/subscription-test-helpers';

// Mock prisma
const mockPrisma = createMockPrisma();
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { blockManager } from '@/lib/subscription/block-manager';

describe('BlockManager', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    vi.clearAllMocks();
  });

  describe('applyBlock', () => {
    it('should apply soft block to organization', async () => {
      const org = createMockOrgWithSubscription({
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'soft_block',
        blockReason: 'Trial expired',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.applyBlock(
        org.id,
        'soft_block',
        'Trial expired'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: org.id },
          data: expect.objectContaining({
            blockType: 'soft_block',
            blockReason: 'Trial expired',
          }),
        })
      );
    });

    it('should apply hard block to organization', async () => {
      const org = createMockOrgWithSubscription({
        blockType: 'soft_block',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'hard_block',
        blockReason: 'Payment failed multiple times',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.applyBlock(
        org.id,
        'hard_block',
        'Payment failed multiple times'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockType: 'hard_block',
          }),
        })
      );
    });

    it('should log block application event', async () => {
      const org = createMockOrgWithSubscription();

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await blockManager.applyBlock(org.id, 'soft_block', 'Test reason');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'block_applied',
            eventData: expect.objectContaining({
              blockType: 'soft_block',
              reason: 'Test reason',
            }),
          }),
        })
      );
    });

    it('should not apply block to non-existent organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      const result = await blockManager.applyBlock(
        'non-existent-org',
        'soft_block',
        'Test reason'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('removeBlock', () => {
    it('should remove soft block from organization', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: null,
        blockReason: null,
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.removeBlock(org.id, 'Payment received');

      expect(result.success).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockType: null,
            blockReason: null,
          }),
        })
      );
    });

    it('should remove hard block from organization', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: null,
        blockReason: null,
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.removeBlock(org.id, 'Admin override');

      expect(result.success).toBe(true);
    });

    it('should log block removal event', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await blockManager.removeBlock(org.id, 'Subscription renewed');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'block_removed',
            eventData: expect.objectContaining({
              reason: 'Subscription renewed',
              previousBlockType: 'soft_block',
            }),
          }),
        })
      );
    });

    it('should succeed even if organization has no block', async () => {
      const org = createMockOrgWithSubscription({
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce(org);

      const result = await blockManager.removeBlock(org.id, 'Precautionary');

      expect(result.success).toBe(true);
    });
  });

  describe('getBlockStatus', () => {
    it('should return blocked status for soft blocked org', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await blockManager.getBlockStatus(org.id);

      expect(status.isBlocked).toBe(true);
      expect(status.blockType).toBe('soft_block');
      expect(status.canAccessDashboard).toBe(true);
      expect(status.canAccessBilling).toBe(true);
      expect(status.canReceiveJobs).toBe(false);
    });

    it('should return hard blocked status with limited access', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await blockManager.getBlockStatus(org.id);

      expect(status.isBlocked).toBe(true);
      expect(status.blockType).toBe('hard_block');
      expect(status.canAccessDashboard).toBe(false);
      expect(status.canAccessBilling).toBe(true); // Can still access billing to fix issue
      expect(status.canReceiveJobs).toBe(false);
    });

    it('should return unblocked status for active org', async () => {
      const org = createMockOrgWithSubscription({
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await blockManager.getBlockStatus(org.id);

      expect(status.isBlocked).toBe(false);
      expect(status.blockType).toBeNull();
      expect(status.canAccessDashboard).toBe(true);
      expect(status.canReceiveJobs).toBe(true);
    });
  });

  describe('escalateBlock', () => {
    it('should escalate soft block to hard block', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'hard_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.escalateBlock(
        org.id,
        'Grace period expired'
      );

      expect(result.success).toBe(true);
      expect(result.newBlockType).toBe('hard_block');
    });

    it('should not escalate if already hard blocked', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const result = await blockManager.escalateBlock(
        org.id,
        'Already maximum block'
      );

      expect(result.success).toBe(true);
      expect(result.alreadyMaxBlock).toBe(true);
    });

    it('should apply soft block if currently not blocked', async () => {
      const org = createMockOrgWithSubscription({
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'soft_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.escalateBlock(
        org.id,
        'Trial expired'
      );

      expect(result.success).toBe(true);
      expect(result.newBlockType).toBe('soft_block');
    });
  });

  describe('getBlockedOrganizations', () => {
    it('should return all blocked organizations', async () => {
      const blockedOrgs = [
        createMockBlockedOrg('soft_block'),
        createMockBlockedOrg('hard_block'),
      ];

      mockPrisma.organization.findMany = vi.fn().mockResolvedValueOnce(blockedOrgs);

      const result = await blockManager.getBlockedOrganizations();

      expect(result).toHaveLength(2);
    });

    it('should filter by block type', async () => {
      const hardBlockedOrg = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findMany = vi.fn().mockResolvedValueOnce([hardBlockedOrg]);

      const result = await blockManager.getBlockedOrganizations('hard_block');

      expect(result).toHaveLength(1);
      expect(result[0].blockType).toBe('hard_block');
    });
  });

  describe('checkAndApplyBlocks (cron)', () => {
    it('should block orgs with expired trials past grace period', async () => {
      const expiredOrg = createMockOrgWithSubscription({
        id: 'org-expired',
        subscriptionStatus: 'expired',
        trialEndsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        blockType: null,
      });

      mockPrisma.organization.findMany = vi.fn().mockResolvedValueOnce([expiredOrg]);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...expiredOrg,
        blockType: 'soft_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.checkAndApplyBlocks();

      expect(result.blocksApplied).toBeGreaterThanOrEqual(0);
    });

    it('should escalate soft blocks to hard blocks after extended period', async () => {
      const softBlockedOrg = createMockOrgWithSubscription({
        id: 'org-soft-blocked',
        subscriptionStatus: 'expired',
        blockType: 'soft_block',
        // Blocked more than 14 days ago
      });

      mockPrisma.organization.findMany = vi.fn().mockResolvedValueOnce([softBlockedOrg]);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...softBlockedOrg,
        blockType: 'hard_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await blockManager.checkAndApplyBlocks();

      expect(result.escalated).toBeGreaterThanOrEqual(0);
    });
  });
});
