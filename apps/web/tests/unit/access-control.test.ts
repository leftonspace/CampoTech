/**
 * Access Control Unit Tests
 * =========================
 *
 * Tests for route and feature access control:
 * - Route blocking based on subscription status
 * - Feature access based on tier
 * - Block enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockOrgWithSubscription,
  createMockBlockedOrg,
  createMockTrialOrg,
  createMockPrisma,
  resetAllMocks,
} from '../utils/subscription-test-helpers';

// Mock prisma
const mockPrisma = createMockPrisma();
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { accessControl } from '@/lib/access-control/checker';

describe('AccessControl', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    vi.clearAllMocks();
  });

  describe('checkRouteAccess', () => {
    it('should allow access to dashboard for active subscription', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'active',
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/dashboard');

      expect(access.allowed).toBe(true);
    });

    it('should allow access to dashboard during trial', async () => {
      const org = createMockTrialOrg(7);

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/dashboard');

      expect(access.allowed).toBe(true);
    });

    it('should block dashboard access when hard blocked', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/dashboard');

      expect(access.allowed).toBe(false);
      expect(access.redirectTo).toBe('/blocked');
    });

    it('should allow billing access when hard blocked', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/billing');

      expect(access.allowed).toBe(true);
    });

    it('should allow blocked page access when blocked', async () => {
      const org = createMockBlockedOrg('hard_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/blocked');

      expect(access.allowed).toBe(true);
    });

    it('should allow limited dashboard access when soft blocked', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/dashboard');

      expect(access.allowed).toBe(true);
      expect(access.warning).toBeDefined();
    });

    it('should block jobs page when soft blocked', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkRouteAccess(org.id, '/jobs/new');

      expect(access.allowed).toBe(false);
      expect(access.reason).toContain('blocked');
    });
  });

  describe('checkFeatureAccess', () => {
    it('should allow all features for EMPRESA tier', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'EMPRESA',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkFeatureAccess(org.id, 'advanced_analytics');

      expect(access.allowed).toBe(true);
    });

    it('should restrict advanced features for FREE tier', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'FREE',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkFeatureAccess(org.id, 'advanced_analytics');

      expect(access.allowed).toBe(false);
      expect(access.requiredTier).toBeDefined();
    });

    it('should allow basic features for INICIAL tier', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'INICIAL',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkFeatureAccess(org.id, 'job_management');

      expect(access.allowed).toBe(true);
    });

    it('should grant trial users INICIAL tier features', async () => {
      const org = createMockTrialOrg(14);

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkFeatureAccess(org.id, 'job_management');

      expect(access.allowed).toBe(true);
    });

    it('should deny features when subscription is expired', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'expired',
        subscriptionTier: 'INICIAL',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkFeatureAccess(org.id, 'job_management');

      expect(access.allowed).toBe(false);
      expect(access.reason).toContain('expired');
    });
  });

  describe('checkJobLimits', () => {
    it('should allow jobs within monthly limit', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'INICIAL', // 50 jobs/month
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.job = {
        count: vi.fn().mockResolvedValueOnce(25), // 25 jobs used
      };

      const access = await accessControl.checkJobLimits(org.id);

      expect(access.allowed).toBe(true);
      expect(access.remaining).toBe(25);
    });

    it('should deny jobs when limit exceeded', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'INICIAL',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.job = {
        count: vi.fn().mockResolvedValueOnce(50), // Limit reached
      };

      const access = await accessControl.checkJobLimits(org.id);

      expect(access.allowed).toBe(false);
      expect(access.remaining).toBe(0);
      expect(access.upgradeRequired).toBe(true);
    });

    it('should allow unlimited jobs for EMPRESA tier', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'EMPRESA',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.job = {
        count: vi.fn().mockResolvedValueOnce(1000), // Lots of jobs
      };

      const access = await accessControl.checkJobLimits(org.id);

      expect(access.allowed).toBe(true);
      expect(access.unlimited).toBe(true);
    });
  });

  describe('checkVerificationAccess', () => {
    it('should allow job reception when verified', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkVerificationAccess(org.id);

      expect(access.canReceiveJobs).toBe(true);
    });

    it('should block job reception when not verified', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'pending',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkVerificationAccess(org.id);

      expect(access.canReceiveJobs).toBe(false);
      expect(access.reason).toContain('verification');
    });

    it('should allow dashboard access when paid but not verified', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'pending',
        subscriptionStatus: 'active', // Paid
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const access = await accessControl.checkVerificationAccess(org.id);

      expect(access.canAccessDashboard).toBe(true);
      expect(access.canReceiveJobs).toBe(false);
    });
  });

  describe('getAccessContext', () => {
    it('should return full access context for organization', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionTier: 'PROFESIONAL',
        subscriptionStatus: 'active',
        verificationStatus: 'verified',
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const context = await accessControl.getAccessContext(org.id);

      expect(context.tier).toBe('PROFESIONAL');
      expect(context.status).toBe('active');
      expect(context.isVerified).toBe(true);
      expect(context.isBlocked).toBe(false);
      expect(context.canReceiveJobs).toBe(true);
    });

    it('should include blocking info when blocked', async () => {
      const org = createMockBlockedOrg('soft_block');

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const context = await accessControl.getAccessContext(org.id);

      expect(context.isBlocked).toBe(true);
      expect(context.blockType).toBe('soft_block');
      expect(context.blockReason).toBeDefined();
    });

    it('should include trial info when trialing', async () => {
      const org = createMockTrialOrg(5);

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const context = await accessControl.getAccessContext(org.id);

      expect(context.isTrial).toBe(true);
      expect(context.trialDaysRemaining).toBe(5);
    });
  });

  describe('BLOCKED_ROUTES', () => {
    it('should define which routes are blocked for each block type', () => {
      const blockedRoutes = accessControl.getBlockedRoutes('hard_block');

      expect(blockedRoutes).toContain('/dashboard');
      expect(blockedRoutes).toContain('/jobs');
      expect(blockedRoutes).not.toContain('/billing');
      expect(blockedRoutes).not.toContain('/blocked');
    });

    it('should have fewer blocked routes for soft block', () => {
      const hardBlockedRoutes = accessControl.getBlockedRoutes('hard_block');
      const softBlockedRoutes = accessControl.getBlockedRoutes('soft_block');

      expect(softBlockedRoutes.length).toBeLessThan(hardBlockedRoutes.length);
    });
  });

  describe('TIER_LIMITS', () => {
    it('should define job limits for each tier', () => {
      const limits = accessControl.getTierLimits();

      expect(limits.FREE.monthlyJobs).toBe(5);
      expect(limits.INICIAL.monthlyJobs).toBe(50);
      expect(limits.PROFESIONAL.monthlyJobs).toBe(200);
      expect(limits.EMPRESA.monthlyJobs).toBe(-1); // Unlimited
    });
  });
});
