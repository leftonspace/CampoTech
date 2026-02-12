/**
 * Access Control Unit Tests
 * =========================
 *
 * Tests for the Unified Access Control Checker:
 * - Organization access based on subscription status
 * - Verification-based access restrictions
 * - Block reason generation
 * - Quick check functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock prisma with vi.hoisted to avoid hoisting issues
const mockPrisma = vi.hoisted(() => {
  return {
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    complianceBlock: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    verificationRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    verificationSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import {
  checkAccess,
  checkUserAccess,
  canReceiveJobs,
  canAssignUser,
  isOrgMarketplaceVisible,
} from '@/lib/access-control/checker';

// Helper to create org data
function createOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    subscriptionTier: 'INICIAL',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    verificationStatus: 'verified',
    canReceiveJobs: true,
    marketplaceVisible: true,
    ...overrides,
  };
}

describe('Access Control - checkAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mockPrisma.complianceBlock.findMany.mockResolvedValue([]);
    mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
    mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
  });

  describe('Dashboard Access', () => {
    it('should allow dashboard access for active subscription', async () => {
      const org = createOrg({ subscriptionStatus: 'active' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.canAccessDashboard).toBe(true);
      expect(access.isHardBlocked).toBe(false);
    });

    it('should allow dashboard access during trial', async () => {
      const org = createOrg({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.canAccessDashboard).toBe(true);
      expect(access.subscription.trialDaysRemaining).toBeGreaterThan(0);
    });

    it('should block dashboard when subscription is expired', async () => {
      const org = createOrg({ subscriptionStatus: 'expired' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.canAccessDashboard).toBe(false);
      expect(access.isHardBlocked).toBe(true);
      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({ code: 'trial_expired' })
      );
    });

    it('should block dashboard when hard blocked by compliance', async () => {
      const org = createOrg();
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.complianceBlock.findMany.mockResolvedValueOnce([
        { blockType: 'hard_block', reason: 'Fraude detectado', reasonCode: 'fraud' },
      ]);

      const access = await checkAccess('org-1');

      expect(access.canAccessDashboard).toBe(false);
      expect(access.isHardBlocked).toBe(true);
    });
  });

  describe('Subscription Status', () => {
    it('should mark past_due as active but with soft block', async () => {
      const org = createOrg({ subscriptionStatus: 'past_due' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.subscription.isActive).toBe(true);
      expect(access.subscription.isPastDue).toBe(true);
      expect(access.isSoftBlocked).toBe(true);
      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({ code: 'payment_past_due' })
      );
    });

    it('should mark cancelled with soft block', async () => {
      const org = createOrg({ subscriptionStatus: 'cancelled' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.subscription.isCancelled).toBe(true);
      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({ code: 'subscription_cancelled' })
      );
    });

    it('should warn when trial is expiring soon', async () => {
      const org = createOrg({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days left
      });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.hasWarnings).toBe(true);
      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({ code: 'trial_expiring' })
      );
    });
  });

  describe('Verification Status', () => {
    it('should indicate pending verification as soft block', async () => {
      const org = createOrg({ verificationStatus: 'pending' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.verification.status).toBe('pending');
      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({ code: 'verification_pending' })
      );
    });

    it('should indicate suspended verification as hard block', async () => {
      const org = createOrg({ verificationStatus: 'suspended' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.blockReasons).toContainEqual(
        expect.objectContaining({
          code: 'verification_suspended',
          severity: 'hard_block',
        })
      );
    });

    it('should allow job reception when verified and no blocks', async () => {
      const org = createOrg({ verificationStatus: 'verified' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.canReceiveJobs).toBe(true);
    });

    it('should block job reception when Tier 2 is incomplete', async () => {
      const org = createOrg({ verificationStatus: 'partial' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      // Simulate incomplete Tier 2
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1', code: 'cuit', name: 'CUIT' },
      ]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([]);

      const access = await checkAccess('org-1');

      expect(access.canReceiveJobs).toBe(false);
    });
  });

  describe('Marketplace Visibility', () => {
    it('should be visible when fully verified and active', async () => {
      const org = createOrg();
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.isMarketplaceVisible).toBe(true);
    });

    it('should not be visible when soft blocked', async () => {
      const org = createOrg({ subscriptionStatus: 'past_due' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await checkAccess('org-1');

      expect(access.isMarketplaceVisible).toBe(false);
    });
  });

  describe('Quick checks', () => {
    it('canReceiveJobs should check org field', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        canReceiveJobs: true,
      });

      const result = await canReceiveJobs('org-1');
      expect(result).toBe(true);
    });

    it('canReceiveJobs should return false when org field is false', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        canReceiveJobs: false,
      });

      const result = await canReceiveJobs('org-1');
      expect(result).toBe(false);
    });

    it('canAssignUser should check user field', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        canBeAssignedJobs: true,
      });

      const result = await canAssignUser('user-1');
      expect(result).toBe(true);
    });

    it('isOrgMarketplaceVisible should check org field', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        marketplaceVisible: true,
      });

      const result = await isOrgMarketplaceVisible('org-1');
      expect(result).toBe(true);
    });
  });
});

describe('Access Control - checkUserAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.complianceBlock.findMany.mockResolvedValue([]);
  });

  it('should return verified status for verified user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      verificationStatus: 'verified',
      canBeAssignedJobs: true,
      identityVerified: true,
    });

    const access = await checkUserAccess('user-1', 'org-1');

    expect(access.isVerified).toBe(true);
    expect(access.canBeAssignedJobs).toBe(true);
    expect(access.blockReasons).toHaveLength(0);
  });

  it('should block unverified user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      verificationStatus: 'pending',
      canBeAssignedJobs: false,
      identityVerified: false,
    });

    const access = await checkUserAccess('user-1', 'org-1');

    expect(access.isVerified).toBe(false);
    expect(access.blockReasons).toContainEqual(
      expect.objectContaining({ code: 'user_not_verified' })
    );
  });

  it('should throw for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(checkUserAccess('nonexistent', 'org-1')).rejects.toThrow('User not found');
  });
});
