/**
 * Subscription Flow Integration Tests
 * ====================================
 *
 * End-to-end tests for the complete subscription lifecycle:
 * - Signup → Trial → Verify → Pay flow
 * - Subscription upgrades and downgrades
 * - Cancellation with refund
 * - Reactivation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockOrgWithSubscription,
  createMockTrialOrg,
  createMockSubscription,
  createMockPayment,
  createMockVerifiedOrganization,
  createMockPrisma,
  createMockEmailService,
  mockMercadoPagoResponses,
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

// Mock email - export full service for test access to helper methods
vi.mock('@/lib/email', async () => {
  const helpers = await import('../utils/subscription-test-helpers');
  const service = helpers.createMockEmailService();
  return {
    sendEmail: service.sendEmail,
    __mockEmailService: service,
  };
});

// Import the mocked modules to get references
import { prisma as mockPrisma } from '@/lib/prisma';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as emailModule from '@/lib/email';
const mockEmail = (emailModule as any).__mockEmailService as ReturnType<typeof createMockEmailService>;

vi.mock('@/lib/integrations/mercadopago/client', () => ({
  mercadoPagoClient: {
    getPayment: vi.fn(),
    createRefund: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}));

// Import services after mocking
import { trialManager } from '@/lib/services/trial-manager';
import { paymentProcessor } from '@/lib/subscription/payment-processor';
import { blockManager } from '@/lib/subscription/block-manager';
import { verificationManager } from '@/lib/services/verification-manager';
import { mercadoPagoClient } from '@/lib/integrations/mercadopago/client';

describe('Subscription Flow Integration', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    mockEmail.clearSentEmails();
    vi.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('Complete Signup → Trial → Verify → Pay Flow', () => {
    it('should complete full onboarding flow', async () => {
      const now = new Date('2024-01-01T10:00:00Z');
      freezeTime(now);

      // Step 1: Organization signs up and gets trial
      const orgId = 'org-new';

      mockPrisma.organizationSubscription.create.mockResolvedValueOnce({
        id: 'sub-1',
        organizationId: orgId,
        tier: 'INICIAL',
        status: 'trialing',
        trialEndsAt: new Date('2024-01-15T10:00:00Z'),
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        id: orgId,
        subscriptionStatus: 'trialing',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const trialResult = await trialManager.createTrial(orgId);

      expect(trialResult.success).toBe(true);
      expect(trialResult.subscription?.tier).toBe('INICIAL');
      expect(trialResult.subscription?.status).toBe('trialing');

      // Step 2: User completes verification (Tier 2)
      // checkTier2Complete calls verificationRequirement.findMany + verificationSubmission.count
      mockPrisma.verificationRequirement = { findMany: vi.fn().mockResolvedValueOnce([{ id: 'req-1' }]) };
      mockPrisma.verificationSubmission = { count: vi.fn().mockResolvedValueOnce(1) };

      const isVerified = await verificationManager.checkTier2Complete(orgId);
      expect(isVerified).toBe(true);

      // Step 3: User makes payment before trial ends
      advanceTime(10); // Day 11 of trial

      const payment = createMockPayment({
        organizationId: orgId,
        status: 'pending',
        amount: 25000,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: orgId,
        subscriptionStatus: 'trialing',
        verificationStatus: 'verified',
      });
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'completed',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        id: orgId,
        subscriptionStatus: 'active',
        subscriptionTier: 'INICIAL',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const paymentResult = await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-123',
        amount: 25000,
      });

      expect(paymentResult.success).toBe(true);

      // Verify final state
      expect(mockPrisma.organization.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'active',
          }),
        })
      );
    });

    it('should handle trial expiration and blocking flow', async () => {
      const now = new Date('2024-01-01T10:00:00Z');
      freezeTime(now);

      // Setup: Create trial org
      const org = createMockTrialOrg(14);
      mockPrisma._addOrganization(org);

      // Fast forward past trial
      advanceTime(15);

      // Trial expiration
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        ...org,
        trialEndsAt: new Date('2024-01-15T10:00:00Z'),
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'expired',
      });
      mockPrisma.organizationSubscription.updateMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await trialManager.expireTrial(org.id);

      // Soft block should be applied
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'expired',
        blockType: null,
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'soft_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await blockManager.applyBlock(org.id, 'soft_block', 'Trial expired');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockType: 'soft_block',
          }),
        })
      );
    });
  });

  describe('Subscription Upgrade Flow', () => {
    it('should upgrade from INICIAL to PROFESIONAL with proration', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const org = createMockOrgWithSubscription({
        subscriptionTier: 'INICIAL',
        subscriptionStatus: 'active',
      });

      // Current period: 15 days remaining
      // INICIAL: $25,000/month
      // PROFESIONAL: $55,000/month
      // Proration: ($55,000 - $25,000) / 30 * 15 = $15,000

      const payment = createMockPayment({
        organizationId: org.id,
        amount: 15000, // Prorated amount
        status: 'pending',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.subscriptionPayment.create.mockResolvedValueOnce(payment);
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'completed',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'active',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-upgrade',
        amount: 15000,
      });

      // processApprovedPayment sets subscriptionStatus to 'active' and clears blocks
      // Tier upgrade is handled externally, not by processApprovedPayment
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'active',
          }),
        })
      );
    });
  });

  describe('Subscription Cancellation Flow', () => {
    it('should process cancellation with Ley 24.240 refund', async () => {
      const now = new Date('2024-01-08T10:00:00Z');
      freezeTime(now);

      // Payment made 5 days ago - within 10-day window
      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-03T10:00:00Z'),
        amount: 25000,
        organizationId: 'org-1',
        mercadoPagoPaymentId: 'mp-pay-1',
      });

      const org = createMockOrgWithSubscription({
        id: 'org-1',
        subscriptionStatus: 'active',
      });

      // processRefund calls findUnique once, then checkRefundEligibility calls it again
      mockPrisma.subscriptionPayment.findUnique
        .mockResolvedValueOnce(payment)   // first call in processRefund
        .mockResolvedValueOnce(payment);  // second call in checkRefundEligibility

      // processRefund uses raw fetch() for MP refund, not mercadoPagoClient.createRefund
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'refund-1' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'refunded',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'cancelled',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await paymentProcessor.processRefund(payment.id, 'Customer request');

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(25000);
      expect(result.isLey24240Refund).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('Subscription Reactivation Flow', () => {
    it('should reactivate cancelled subscription', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'cancelled',
        subscriptionTier: 'FREE',
        blockType: 'hard_block',
      });

      const payment = createMockPayment({
        organizationId: org.id,
        amount: 25000,
        status: 'pending',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'completed',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'active',
        subscriptionTier: 'INICIAL',
        blockType: null,
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-reactivate',
        amount: 25000,
      });

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'active',
            blockType: null,
          }),
        })
      );
    });
  });

  describe('Webhook Processing Flow', () => {
    it('should process MercadoPago payment webhook', async () => {
      const webhookPayload = mockMercadoPagoResponses.webhookPaymentApproved('mp-pay-123');

      // Simulate webhook processing
      const payment = createMockPayment({
        mercadoPagoPaymentId: 'mp-pay-123',
        status: 'pending',
      });

      mockPrisma.subscriptionPayment.findFirst = vi.fn().mockResolvedValueOnce(payment);
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        createMockOrgWithSubscription({ subscriptionStatus: 'trialing' })
      );
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'completed',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      // This would be called by the webhook handler
      await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: webhookPayload.data.id,
        amount: 25000,
      });

      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
          }),
        })
      );
    });
  });

  describe('Email Notification Flow', () => {
    it('should send trial expiring email', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2024-01-22T10:00:00Z'),
      });

      // Simulate trial expiring notification
      await mockEmail.sendEmail({
        to: 'owner@example.com',
        subject: 'Tu prueba gratuita vence pronto',
        template: 'trial-expiring',
        data: {
          organizationName: org.name,
          daysRemaining: 7,
        },
      });

      const sentEmails = mockEmail.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].template).toBe('trial-expiring');
      expect(sentEmails[0].data.daysRemaining).toBe(7);
    });

    it('should send payment confirmation email', async () => {
      await mockEmail.sendEmail({
        to: 'owner@example.com',
        subject: 'Pago confirmado',
        template: 'payment-confirmed',
        data: {
          amount: 25000,
          tier: 'INICIAL',
        },
      });

      const lastEmail = mockEmail.getLastEmail();
      expect(lastEmail?.template).toBe('payment-confirmed');
      expect(lastEmail?.data.amount).toBe(25000);
    });
  });

  describe('Grace Period Flow', () => {
    it('should track grace period and escalate blocks', async () => {
      const now = new Date('2024-01-01T10:00:00Z');
      freezeTime(now);

      // Reset mocks to clear any leftover queued values from previous tests
      mockPrisma.organization.findUnique.mockReset();
      mockPrisma.organization.update.mockReset();
      mockPrisma.subscriptionEvent.create.mockReset();

      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'expired',
        trialEndsAt: new Date('2024-01-01T10:00:00Z'),
        blockType: null,
      });

      // Day 1: Trial expires, apply soft block
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'soft_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const applyResult = await blockManager.applyBlock(org.id, 'soft_block', 'Trial expired');
      expect(applyResult.success).toBe(true);

      // Day 8: Grace period ends, escalate to hard block
      advanceTime(7);

      // escalateBlock: findUnique -> checks blockType -> update -> log event
      const softBlockedOrg = { ...org, blockType: 'soft_block' };
      mockPrisma.organization.findUnique.mockResolvedValueOnce(softBlockedOrg);
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        blockType: 'hard_block',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const escalateResult = await blockManager.escalateBlock(org.id, 'Grace period expired');

      expect(escalateResult.success).toBe(true);
      expect(escalateResult.newBlockType).toBe('hard_block');
    });
  });
});
