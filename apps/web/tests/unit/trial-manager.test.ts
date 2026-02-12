/**
 * Trial Manager Unit Tests
 * ========================
 *
 * Tests for the trial management functionality:
 * - Creating trials for new organizations
 * - Checking trial status
 * - Trial expiration handling
 * - Extending trials
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockOrgWithSubscription,
  createMockTrialOrg,
  createMockSubscription,
  createMockTrialSubscription,
  createMockPrisma,
  freezeTime,
  unfreezeTime,
  advanceTime,
  resetAllMocks,
} from '../utils/subscription-test-helpers';

// Mock prisma - use async factory to avoid hoisting issues
vi.mock('@/lib/prisma', async () => {
  const helpers = await import('../utils/subscription-test-helpers');
  return { prisma: helpers.createMockPrisma() };
});

// Import the mocked module to get a reference
import { prisma as mockPrisma } from '@/lib/prisma';

// Import after mocking
import { trialManager, TRIAL_DAYS, TRIAL_TIER } from '@/lib/services/trial-manager';

describe('TrialManager', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('createTrial', () => {
    it('should create a 21-day trial for a new organization', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const orgId = 'org-new-1';

      mockPrisma.organizationSubscription.create.mockResolvedValueOnce({
        id: 'sub-1',
        organizationId: orgId,
        tier: TRIAL_TIER,
        status: 'trialing',
        trialEndsAt: new Date('2024-02-05T10:00:00Z'), // 21 days from Jan 15
        currentPeriodStart: now,
        currentPeriodEnd: new Date('2024-02-05T10:00:00Z'),
      });

      mockPrisma.organization.update.mockResolvedValueOnce({
        id: orgId,
        subscriptionTier: TRIAL_TIER,
        subscriptionStatus: 'trialing',
      });

      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({ id: 'event-1' });

      const result = await trialManager.createTrial(orgId);

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription?.tier).toBe(TRIAL_TIER);
      expect(result.subscription?.status).toBe('trialing');
    });

    it('should set trial end date exactly 21 days from now', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const expectedEndDate = new Date('2024-02-05T10:00:00Z'); // 21 days from Jan 15

      mockPrisma.organizationSubscription.create.mockImplementation(async ({ data }) => {
        expect(data.trialEndsAt).toEqual(expectedEndDate);
        return { ...data, id: 'sub-1' };
      });

      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.createTrial('org-1');

      expect(mockPrisma.organizationSubscription.create).toHaveBeenCalled();
    });

    it('should use INICIAL tier during trial', async () => {
      mockPrisma.organizationSubscription.create.mockImplementation(async ({ data }) => {
        expect(data.tier).toBe('INICIAL');
        return { ...data, id: 'sub-1' };
      });

      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.createTrial('org-1');

      expect(TRIAL_TIER).toBe('INICIAL');
    });

    it('should return error if subscription creation fails', async () => {
      mockPrisma.organizationSubscription.create.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await trialManager.createTrial('org-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('getTrialStatus', () => {
    it('should return active trial with correct days remaining', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const trialEndsAt = new Date('2024-01-22T10:00:00Z'); // 7 days from now
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
        trialEndsAt,
      });

      mockPrisma._addOrganization(org);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await trialManager.getTrialStatus(org.id);

      expect(status.isActive).toBe(true);
      expect(status.daysRemaining).toBe(7);
      expect(status.isExpired).toBe(false);
    });

    it('should flag trial as expiring soon when less than 7 days remain', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const trialEndsAt = new Date('2024-01-18T10:00:00Z'); // 3 days from now
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
        trialEndsAt,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await trialManager.getTrialStatus(org.id);

      expect(status.isExpiringSoon).toBe(true);
      expect(status.daysRemaining).toBe(3);
    });

    it('should return expired status when trial has ended', async () => {
      const now = new Date('2024-01-30T10:00:00Z');
      freezeTime(now);

      const trialEndsAt = new Date('2024-01-29T10:00:00Z'); // Yesterday
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'expired',
        trialEndsAt,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await trialManager.getTrialStatus(org.id);

      expect(status.isActive).toBe(false);
      expect(status.isExpired).toBe(true);
      expect(status.daysRemaining).toBeLessThanOrEqual(0);
    });

    it('should return inactive for organizations without trial', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'active',
        trialEndsAt: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const status = await trialManager.getTrialStatus(org.id);

      expect(status.isActive).toBe(false);
      expect(status.trialEndsAt).toBeNull();
    });
  });

  describe('getTrialsNeedingReminders', () => {
    it('should return trials needing reminders for specified days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const expiringOrg = {
        id: 'org-expiring',
        trialEndsAt: new Date('2024-01-18T10:00:00Z'), // 3 days
        email: 'test@example.com',
      };

      mockPrisma.organization.findMany = vi.fn().mockResolvedValueOnce([expiringOrg]);

      const reminders = await trialManager.getTrialsNeedingReminders(3);

      expect(reminders).toHaveLength(1);
      expect(reminders[0].organizationId).toBe('org-expiring');
    });
  });

  describe('expireTrial', () => {
    it('should update organization to expired status', async () => {
      const org = createMockTrialOrg(0);
      mockPrisma._addOrganization(org);

      // expireTrial calls: updateMany, organization.update, findFirst, logEvent
      mockPrisma.organizationSubscription.updateMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'expired',
      });
      mockPrisma.organizationSubscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', organizationId: org.id });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await trialManager.expireTrial(org.id);

      // expireTrial returns boolean, not { success: boolean }
      expect(result).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'expired',
          }),
        })
      );
    });

    it('should log trial expiration event', async () => {
      const org = createMockTrialOrg(0);
      mockPrisma._addOrganization(org);

      mockPrisma.organizationSubscription.updateMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.organizationSubscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', organizationId: org.id });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.expireTrial(org.id);

      // The actual event type is 'trial_ended', not 'trial_expired'
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'trial_ended',
          }),
        })
      );
    });
  });

  // Note: extendTrial does not exist in the current implementation
  // Trial extensions are handled through admin tooling, not through the TrialManager class


  describe('convertTrialToActive', () => {
    it('should update organization to active subscription', async () => {
      const org = createMockTrialOrg(5);

      // convertTrialToActive calls: updateMany, org.update, findFirst, logEvent x2
      mockPrisma.organizationSubscription.updateMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'active',
        subscriptionTier: 'PROFESIONAL',
      });
      mockPrisma.organizationSubscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', organizationId: org.id });
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      // Actual API: convertTrialToActive(orgId, tier, billingCycle)
      const result = await trialManager.convertTrialToActive(
        org.id,
        'PROFESIONAL',
        'MONTHLY'
      );

      expect(result).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'active',
            subscriptionTier: 'PROFESIONAL',
          }),
        })
      );
    });

    it('should log trial conversion event', async () => {
      const org = createMockTrialOrg(5);

      mockPrisma.organizationSubscription.updateMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.organizationSubscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', organizationId: org.id });
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      await trialManager.convertTrialToActive(org.id, 'INICIAL', 'MONTHLY');

      // Should log 'trial_ended' with converted reason
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'trial_ended',
          }),
        })
      );
    });
  });

  describe('constants', () => {
    it('should have correct trial duration', () => {
      expect(TRIAL_DAYS).toBe(21);
    });

    it('should grant INICIAL tier during trial', () => {
      expect(TRIAL_TIER).toBe('INICIAL');
    });
  });
});
