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

// Using Jest globals
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

// Mock prisma
const mockPrisma = createMockPrisma();
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { trialManager, TRIAL_DAYS, TRIAL_TIER } from '@/lib/services/trial-manager';

describe('TrialManager', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('createTrial', () => {
    it('should create a 14-day trial for a new organization', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const orgId = 'org-new-1';

      mockPrisma.organizationSubscription.create.mockResolvedValueOnce({
        id: 'sub-1',
        organizationId: orgId,
        tier: TRIAL_TIER,
        status: 'trialing',
        trialEndsAt: new Date('2024-01-29T10:00:00Z'),
        currentPeriodStart: now,
        currentPeriodEnd: new Date('2024-01-29T10:00:00Z'),
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

    it('should set trial end date exactly 14 days from now', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const expectedEndDate = new Date('2024-01-29T10:00:00Z');

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

  describe('checkExpiringTrials', () => {
    it('should return trials expiring in specified days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const expiringOrg = createMockOrgWithSubscription({
        id: 'org-expiring',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2024-01-18T10:00:00Z'), // 3 days
      });

      const activeOrg = createMockOrgWithSubscription({
        id: 'org-active',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2024-01-25T10:00:00Z'), // 10 days
      });

      mockPrisma.organization.findMany = jest.fn().mockResolvedValueOnce([expiringOrg]);

      const expiring = await trialManager.checkExpiringTrials(3);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].id).toBe('org-expiring');
    });
  });

  describe('expireTrial', () => {
    it('should update organization to expired status', async () => {
      const org = createMockTrialOrg(0);
      mockPrisma._addOrganization(org);

      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'expired',
      });
      mockPrisma.organizationSubscription.updateMany = jest.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await trialManager.expireTrial(org.id);

      expect(result.success).toBe(true);
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

      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.organizationSubscription.updateMany = jest.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.expireTrial(org.id);

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'trial_expired',
          }),
        })
      );
    });
  });

  describe('extendTrial', () => {
    it('should extend trial by specified days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2024-01-20T10:00:00Z'), // 5 days left
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        trialEndsAt: new Date('2024-01-27T10:00:00Z'), // +7 days
      });
      mockPrisma.organizationSubscription.updateMany = jest.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await trialManager.extendTrial(org.id, 7, 'Customer request');

      expect(result.success).toBe(true);
      expect(result.newTrialEndsAt).toBeDefined();
    });

    it('should not extend already expired trials', async () => {
      const now = new Date('2024-01-30T10:00:00Z');
      freezeTime(now);

      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'expired',
        trialEndsAt: new Date('2024-01-25T10:00:00Z'), // Already expired
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const result = await trialManager.extendTrial(org.id, 7, 'Customer request');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should log extension event with reason', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2024-01-20T10:00:00Z'),
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.organizationSubscription.updateMany = jest.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.extendTrial(org.id, 7, 'Sales promotion');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'trial_extended',
            eventData: expect.objectContaining({
              reason: 'Sales promotion',
              extensionDays: 7,
            }),
          }),
        })
      );
    });
  });

  describe('convertTrialToSubscription', () => {
    it('should update organization to active subscription', async () => {
      const org = createMockTrialOrg(5);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'active',
        subscriptionTier: 'PROFESIONAL',
      });
      mockPrisma.organizationSubscription.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await trialManager.convertTrialToSubscription(
        org.id,
        'PROFESIONAL',
        'sub-mp-123'
      );

      expect(result.success).toBe(true);
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
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.organizationSubscription.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.convertTrialToSubscription(org.id, 'INICIAL', 'sub-mp-123');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'trial_converted',
          }),
        })
      );
    });
  });

  describe('constants', () => {
    it('should have correct trial duration', () => {
      expect(TRIAL_DAYS).toBe(14);
    });

    it('should grant INICIAL tier during trial', () => {
      expect(TRIAL_TIER).toBe('INICIAL');
    });
  });
});
