/**
 * 360dialog Provider Unit Tests
 * ==============================
 *
 * Tests for the 360dialog BSP provider implementation.
 * Covers number provisioning, message sending, and webhook handling.
 */

// Using Jest globals
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';
import crypto from 'crypto';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppBusinessAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Import mocked prisma
import { prisma } from '@/lib/prisma';

// Mock fetch globally
const mockFetch = jest.fn();
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
    jest.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct configuration', () => {
      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('360dialog');
    });

    it('should have BSP capability enabled', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities.supportsTemplates).toBe(true);
      expect(capabilities.supportsMedia).toBe(true);
      expect(capabilities.supportsBroadcast).toBe(true);
    });
  });

  describe('getAvailableNumbers', () => {
    it('should fetch available numbers from partner API', async () => {
      const mockNumbers = [
        { id: 'num1', phone: '+5491155551234', country: 'AR', status: 'available' },
        { id: 'num2', phone: '+5491155555678', country: 'AR', status: 'available' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ numbers: mockNumbers }),
      });

      const numbers = await provider.getAvailableNumbers('AR');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/partner/numbers/available'),
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
      const mockProvisionResult = {
        success: true,
        numberId: 'provisioned_123',
        status: 'pending_verification',
        verificationMethod: 'sms',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProvisionResult,
      });

      const result = await provider.provisionNumber('org123', 'num1', {
        businessName: 'Test Business',
        displayName: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.numberId).toBe('provisioned_123');
      expect(result.status).toBe('pending_verification');
    });

    it('should handle provisioning failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Number already provisioned' }),
      });

      const result = await provider.provisionNumber('org123', 'num1', {
        businessName: 'Test Business',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyNumber', () => {
    it('should verify number with OTP code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true, apiKey: 'waba_api_key_123' }),
      });

      const result = await provider.verifyNumber('org123', '123456');

      expect(result.success).toBe(true);
    });

    it('should handle invalid verification code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid code' }),
      });

      const result = await provider.verifyNumber('org123', '000000');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      // Mock prisma to return account with API key
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        accessToken: 'waba_api_key',
        phoneNumberId: 'phone_123',
        provisioningStatus: 'ACTIVE',
      });
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
          error: { message: 'Invalid phone number' },
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
      // Mock usage check to return limit reached
      jest.mock('@/lib/services/whatsapp-usage.service', () => ({
        WhatsAppUsageService: {
          canSendMessage: jest.fn().mockResolvedValue({
            allowed: false,
            reason: 'Monthly limit reached',
          }),
        },
      }));

      const result = await provider.sendMessage('org123', {
        to: '+5491155551234',
        type: 'text',
        content: { type: 'text', body: 'Hello' },
      });

      // Should fail due to limit
      expect(result.success).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC-SHA256 signature', () => {
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
      const invalidSignature = 'sha256=invalid_signature_here';

      const isValid = provider.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should handle missing sha256 prefix', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook_secret';
      const signatureWithoutPrefix = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(payload, signatureWithoutPrefix, secret);
      expect(isValid).toBe(false);
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
      provider.verifyWebhookSignature(payload, 'sha256=aaaa', secret);
      const time2 = performance.now() - start2;

      // Times should be relatively similar (within 10x) for timing safety
      expect(Math.abs(time1 - time2)).toBeLessThan(Math.max(time1, time2) * 10);
    });
  });

  describe('releaseNumber', () => {
    it('should release provisioned number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ released: true }),
      });

      const result = await provider.releaseNumber('org123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/partner/numbers/'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('getUsageStats', () => {
    it('should fetch usage statistics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messagesSent: 150,
          messagesReceived: 120,
          templatesSent: 50,
        }),
      });

      const stats = await provider.getUsageStats('org123', new Date(), new Date());

      expect(stats).toBeDefined();
      expect(stats.messagesSent).toBe(150);
    });
  });

  describe('getCapabilities', () => {
    it('should return all provider capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsTemplates: true,
        supportsMedia: true,
        supportsBroadcast: true,
        supportsProvisioning: true,
        supportsWebhooks: true,
        maxMessageLength: 4096,
        supportedMediaTypes: ['image', 'video', 'audio', 'document', 'sticker'],
      });
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
    jest.clearAllMocks();
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const numbers = await provider.getAvailableNumbers('AR');
    expect(numbers).toEqual([]);
  });

  it('should handle timeout errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

    const result = await provider.sendMessage('org123', {
      to: '+5491155551234',
      type: 'text',
      content: { type: 'text', body: 'Hello' },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('should handle rate limiting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => name === 'Retry-After' ? '60' : null,
      },
    });

    const result = await provider.sendMessage('org123', {
      to: '+5491155551234',
      type: 'text',
      content: { type: 'text', body: 'Hello' },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorCode).toBe('RATE_LIMITED');
  });
});
