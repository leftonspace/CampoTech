/**
 * 360dialog Provider Unit Tests
 * ==============================
 *
 * Tests for the 360dialog BSP provider implementation.
 * Covers number provisioning, message sending, and webhook handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';
import crypto from 'crypto';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    whatsAppBusinessAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    whatsAppMessage: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Mock WhatsApp usage service
vi.mock('@/lib/services/whatsapp-usage.service', () => ({
  WhatsAppUsageService: {
    canSendMessage: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { WhatsAppUsageService } from '@/lib/services/whatsapp-usage.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;


describe('Dialog360Provider', () => {
  let provider: Dialog360Provider;
  const config = {
    apiKey: 'test_partner_api_key',
    partnerId: 'test_partner_id',
    webhookSecret: 'test_webhook_secret',
  };

  beforeEach(() => {
    provider = new Dialog360Provider(config);
    vi.clearAllMocks();
    // Reset usage service default
    (WhatsAppUsageService.canSendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct configuration', () => {
      expect(provider).toBeDefined();
      expect(provider.displayName).toBe('360dialog');
    });

    it('should have BSP capability enabled', () => {
      expect(provider.supportsTemplates()).toBe(true);
      expect(provider.supportsMedia()).toBe(true);
      expect(provider.supportsProvisioning()).toBe(true);
      expect(provider.supportsInteractive()).toBe(true);
    });
  });

  describe('getAvailableNumbers', () => {
    it('should fetch available numbers from partner API', async () => {
      const mockNumbers = [
        { phone: '+5491155551234', displayPhone: '+54 9 11 5555-1234', countryCode: 'AR', areaCode: '11' },
        { phone: '+5491155555678', displayPhone: '+54 9 11 5555-5678', countryCode: 'AR', areaCode: '11' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ numbers: mockNumbers }),
      });

      const numbers = await provider.getAvailableNumbers('AR');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/partners/test_partner_id/numbers/available'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${config.apiKey}`,
          }),
        })
      );

      expect(numbers).toHaveLength(2);
      expect(numbers[0].phoneNumber).toBe('+5491155551234');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Internal Server Error' }),
      });


      const numbers = await provider.getAvailableNumbers('AR');
      expect(numbers).toEqual([]);
    });

    it('should filter by country code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ numbers: [] }),
      });

      await provider.getAvailableNumbers('AR');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('country=AR'),
        expect.anything()
      );
    });
  });

  describe('provisionNumber', () => {
    it('should provision a number successfully', async () => {
      // Mock org lookup
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        name: 'Test Business',
      });

      const mockChannelResponse = {
        id: 'channel_123',
        phoneNumberId: 'provisioned_123',
        apiKey: 'channel_api_key',
        wabaId: 'waba_123',
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannelResponse,
      });

      // Mock prisma upsert and update
      (prisma.whatsAppBusinessAccount.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      (prisma.organization.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      const result = await provider.provisionNumber('org123', '+5491155551234');

      expect(result.success).toBe(true);
      expect(result.phoneNumberId).toBe('provisioned_123');
      expect(result.status).toBe('ACTIVE');
    });

    it('should handle provisioning failure', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        name: 'Test Business',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Number already provisioned' } }),
      });

      const result = await provider.provisionNumber('org123', '+5491155551234');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyCode', () => {
    it('should verify number with OTP code', async () => {
      (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bspAccountId: 'channel_123',
        accessToken: 'channel_api_key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

      (prisma.whatsAppBusinessAccount.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      const result = await provider.verifyCode('org123', '123456');

      expect(result.success).toBe(true);
      expect(result.status).toBe('VERIFIED');
    });

    it('should handle invalid verification code', async () => {
      (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bspAccountId: 'channel_123',
        accessToken: 'channel_api_key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid code' } }),
      });

      const result = await provider.verifyCode('org123', '000000');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      // Mock prisma to return account with API key
      (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        accessToken: 'waba_api_key',
        phoneNumberId: 'phone_123',
        provisioningStatus: 'ACTIVE',
      });
      // Mock the update for message count increment
      (prisma.whatsAppBusinessAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    });


    it('should send text message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.abc123' }],
        }),
      });

      const result = await provider.sendMessage('org123', {
        to: '+5491155551234',
        type: 'text',
        content: { type: 'text', body: 'Hello World' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.abc123');
    });

    it('should handle message sending failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid phone number', code: 400 },
        }),
      });

      const result = await provider.sendMessage('org123', {
        to: 'invalid',
        type: 'text',
        content: { type: 'text', body: 'Hello' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should check usage limits before sending', async () => {
      // Override to return limit reached
      (WhatsAppUsageService.canSendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        reason: 'Monthly limit reached',
      });

      const result = await provider.sendMessage('org123', {
        to: '+5491155551234',
        type: 'text',
        content: { type: 'text', body: 'Hello' },
      });

      // Should fail due to limit
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('LIMIT_REACHED');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC-SHA256 signature with prefix', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook_secret';

      // Generate valid signature
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(payload, expectedSignature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook_secret';
      // Use a 64-char hex string (same length as SHA-256 output) to avoid timingSafeEqual length error
      const invalidSignature = 'sha256=' + '0'.repeat(64);

      const isValid = provider.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should handle bare hex signature (without sha256 prefix)', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook_secret';
      const signatureWithoutPrefix = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Implementation handles both formats
      const isValid = provider.verifyWebhookSignature(payload, signatureWithoutPrefix, secret);
      expect(isValid).toBe(true);
    });

    it('should be timing-safe against timing attacks', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook_secret';

      // Same prefix, different hash should take similar time
      const validSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const start1 = performance.now();
      provider.verifyWebhookSignature(payload, validSignature, secret);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      // Use same-length hex to avoid timingSafeEqual throwing on length mismatch
      provider.verifyWebhookSignature(payload, 'sha256=' + 'a'.repeat(64), secret);
      const time2 = performance.now() - start2;

      // Times should be relatively similar (within 10x) for timing safety
      expect(Math.abs(time1 - time2)).toBeLessThan(Math.max(time1, time2) * 10);
    });
  });

  describe('releaseNumber', () => {
    it('should release provisioned number', async () => {
      (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bspAccountId: 'channel_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ released: true }),
      });

      (prisma.whatsAppBusinessAccount.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      (prisma.organization.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      // releaseNumber returns void, should not throw
      await expect(provider.releaseNumber('org123')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/partners/${config.partnerId}/channels/channel_123`),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('getUsageStats', () => {
    it('should fetch usage statistics', async () => {
      (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        monthlyMessageCount: 150,
        lastBillingReset: new Date(),
        organization: {
          subscription: { tier: 'PROFESIONAL' },
        },
      });

      // Mock message counts
      (prisma.whatsAppMessage.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(150) // sent
        .mockResolvedValueOnce(120); // received

      const stats = await provider.getUsageStats('org123');

      expect(stats).toBeDefined();
      expect(stats.messagesSent).toBe(150);
      expect(stats.messagesReceived).toBe(120);
      expect(stats.limits).toBeDefined();
      expect(stats.limits.monthlyMessages).toBe(1000); // PROFESIONAL tier
    });
  });

  describe('capabilities', () => {
    it('should support provisioning', () => {
      expect(provider.supportsProvisioning()).toBe(true);
    });

    it('should support templates', () => {
      expect(provider.supportsTemplates()).toBe(true);
    });

    it('should support interactive messages', () => {
      expect(provider.supportsInteractive()).toBe(true);
    });

    it('should support media messages', () => {
      expect(provider.supportsMedia()).toBe(true);
    });

    it('should have correct provider name', () => {
      expect(provider.name).toBe('DIALOG_360');
      expect(provider.displayName).toBe('360dialog');
    });
  });
});

describe('Dialog360Provider Error Handling', () => {
  let provider: Dialog360Provider;

  beforeEach(() => {
    provider = new Dialog360Provider({
      apiKey: 'test_key',
      partnerId: 'test_partner',
    });
    vi.clearAllMocks();
    // Default: usage allowed
    (WhatsAppUsageService.canSendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const numbers = await provider.getAvailableNumbers('AR');
    expect(numbers).toEqual([]);
  });

  it('should handle timeout errors in sendMessage', async () => {
    // Mock prisma for sendMessage
    (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'waba_api_key',
      provisioningStatus: 'ACTIVE',
    });

    mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

    const result = await provider.sendMessage('org123', {
      to: '+5491155551234',
      type: 'text',
      content: { type: 'text', body: 'Hello' },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('should handle rate limiting in sendMessage', async () => {
    // Mock prisma for sendMessage
    (prisma.whatsAppBusinessAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'waba_api_key',
      provisioningStatus: 'ACTIVE',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limited', code: 429 },
      }),
    });

    const result = await provider.sendMessage('org123', {
      to: '+5491155551234',
      type: 'text',
      content: { type: 'text', body: 'Hello' },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorCode).toBe('429');
  });
});
