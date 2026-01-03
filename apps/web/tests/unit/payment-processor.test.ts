/**
 * Payment Processor Unit Tests
 * ============================
 *
 * Tests for payment processing functionality:
 * - Processing approved payments
 * - Handling failed payments
 * - Refund processing
 * - Ley 24.240 refund eligibility
 */

// Using Jest globals
import {
  createMockOrgWithSubscription,
  createMockPayment,
  createMockSubscription,
  createMockPrisma,
  mockMercadoPagoResponses,
  freezeTime,
  unfreezeTime,
  resetAllMocks,
} from '../utils/subscription-test-helpers';

// Mock prisma
const mockPrisma = createMockPrisma();
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock MercadoPago client
jest.mock('@/lib/integrations/mercadopago/client', () => ({
  mercadoPagoClient: {
    getPayment: jest.fn(),
    createRefund: jest.fn(),
  },
}));

import { paymentProcessor, LEY_24240_REFUND_DAYS } from '@/lib/subscription/payment-processor';
import { mercadoPagoClient } from '@/lib/integrations/mercadopago/client';

describe('PaymentProcessor', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('processApprovedPayment', () => {
    it('should activate subscription on successful payment', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'trialing',
      });
      const payment = createMockPayment({
        status: 'pending',
        organizationId: org.id,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'completed',
      });
      mockPrisma.organization.update.mockResolvedValueOnce({
        ...org,
        subscriptionStatus: 'active',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-123',
        amount: 25000,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'active',
          }),
        })
      );
    });

    it('should remove blocks when payment succeeds', async () => {
      const org = createMockOrgWithSubscription({
        subscriptionStatus: 'expired',
        blockType: 'soft_block',
      });
      const payment = createMockPayment({
        status: 'pending',
        organizationId: org.id,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-123',
        amount: 25000,
      });

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockType: null,
            blockReason: null,
          }),
        })
      );
    });

    it('should log payment success event', async () => {
      const org = createMockOrgWithSubscription();
      const payment = createMockPayment({
        status: 'pending',
        organizationId: org.id,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-123',
        amount: 25000,
      });

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'payment.succeeded',
          }),
        })
      );
    });

    it('should reject already processed payments', async () => {
      const payment = createMockPayment({
        status: 'completed', // Already processed
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);

      const result = await paymentProcessor.processApprovedPayment(payment.id, {
        mercadoPagoPaymentId: 'mp-123',
        amount: 25000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });
  });

  describe('processFailedPayment', () => {
    it('should mark payment as failed', async () => {
      const payment = createMockPayment({
        status: 'pending',
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'failed',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await paymentProcessor.processFailedPayment(
        payment.id,
        'cc_rejected_bad_filled_security_code'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        })
      );
    });

    it('should apply soft block after multiple failed payments', async () => {
      const org = createMockOrgWithSubscription({
        blockType: null,
      });
      const payment = createMockPayment({
        status: 'pending',
        organizationId: org.id,
      });

      // Mock finding multiple failed payments
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.subscriptionPayment.count = jest.fn().mockResolvedValueOnce(3); // 3 failed payments
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processFailedPayment(
        payment.id,
        'cc_rejected_insufficient_amount'
      );

      expect(mockPrisma.organization.update).toHaveBeenCalled();
    });

    it('should log failure reason', async () => {
      const payment = createMockPayment({ status: 'pending' });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processFailedPayment(payment.id, 'card_declined');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'payment.failed',
            eventData: expect.objectContaining({
              reason: 'card_declined',
            }),
          }),
        })
      );
    });
  });

  describe('processRefund', () => {
    it('should process full refund within Ley 24.240 period', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'), // 5 days ago - within 10-day window
        amount: 25000,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      jest.mocked(mercadoPagoClient.createRefund).mockResolvedValueOnce(
        mockMercadoPagoResponses.refundSuccess('refund-123', 25000)
      );
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({
        ...payment,
        status: 'refunded',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await paymentProcessor.processRefund(payment.id, 'Customer request');

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(25000);
      expect(result.isLey24240Refund).toBe(true);
    });

    it('should not auto-refund after Ley 24.240 period', async () => {
      const now = new Date('2024-01-30T10:00:00Z');
      freezeTime(now);

      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'), // 20 days ago - outside 10-day window
        amount: 25000,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);

      const result = await paymentProcessor.processRefund(payment.id, 'Customer request');

      expect(result.success).toBe(false);
      expect(result.error).toContain('refund period');
    });

    it('should allow admin override for late refunds', async () => {
      const now = new Date('2024-01-30T10:00:00Z');
      freezeTime(now);

      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'), // 20 days ago
        amount: 25000,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      jest.mocked(mercadoPagoClient.createRefund).mockResolvedValueOnce(
        mockMercadoPagoResponses.refundSuccess('refund-123', 25000)
      );
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await paymentProcessor.processRefund(
        payment.id,
        'Admin override',
        { forceRefund: true, adminId: 'admin-1' }
      );

      expect(result.success).toBe(true);
    });

    it('should cancel subscription after refund', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const org = createMockOrgWithSubscription();
      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'),
        amount: 25000,
        organizationId: org.id,
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      jest.mocked(mercadoPagoClient.createRefund).mockResolvedValueOnce(
        mockMercadoPagoResponses.refundSuccess()
      );
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.subscriptionPayment.update.mockResolvedValueOnce({});
      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await paymentProcessor.processRefund(payment.id, 'Customer cancellation');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'cancelled',
          }),
        })
      );
    });
  });

  describe('checkRefundEligibility', () => {
    it('should return eligible within 10 days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'), // 5 days ago
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);

      const eligibility = await paymentProcessor.checkRefundEligibility(payment.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.daysRemaining).toBe(5);
      expect(eligibility.isLey24240).toBe(true);
    });

    it('should return not eligible after 10 days', async () => {
      const now = new Date('2024-01-25T10:00:00Z');
      freezeTime(now);

      const payment = createMockPayment({
        status: 'completed',
        paidAt: new Date('2024-01-10T10:00:00Z'), // 15 days ago
      });

      mockPrisma.subscriptionPayment.findUnique.mockResolvedValueOnce(payment);

      const eligibility = await paymentProcessor.checkRefundEligibility(payment.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.daysRemaining).toBe(0);
    });
  });

  describe('constants', () => {
    it('should have correct Ley 24.240 refund period', () => {
      expect(LEY_24240_REFUND_DAYS).toBe(10);
    });
  });

  describe('createPaymentRecord', () => {
    it('should create payment record with correct data', async () => {
      const paymentData = {
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        amount: 25000,
        currency: 'ARS',
        paymentMethod: 'credit_card',
      };

      mockPrisma.subscriptionPayment.create.mockResolvedValueOnce({
        id: 'pay-new',
        ...paymentData,
        status: 'pending',
      });

      const result = await paymentProcessor.createPaymentRecord(paymentData);

      expect(result.id).toBeDefined();
      expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 25000,
            currency: 'ARS',
            status: 'pending',
          }),
        })
      );
    });
  });
});
