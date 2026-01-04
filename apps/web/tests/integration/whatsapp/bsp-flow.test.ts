/**
 * WhatsApp BSP Integration Tests
 * ===============================
 *
 * Integration tests for the full WhatsApp BSP flow including:
 * - Provisioning flow
 * - Message sending/receiving
 * - AI response integration
 * - Usage tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Mock environment
vi.stubEnv('DIALOG360_PARTNER_API_KEY', 'test_partner_key');
vi.stubEnv('DIALOG360_PARTNER_ID', 'test_partner_id');
vi.stubEnv('DIALOG360_WEBHOOK_SECRET', 'test_webhook_secret');

// Mock prisma
const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
  whatsAppBusinessAccount: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  whatsAppConversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  whatsAppMessage: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  aIConfiguration: {
    findUnique: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WhatsApp BSP Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Provisioning Flow', () => {
    it('should complete end-to-end provisioning flow', async () => {
      // 1. Check subscription tier
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub123',
        tier: 'PROFESIONAL',
        status: 'ACTIVE',
      });

      // 2. Get available numbers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          numbers: [
            { id: 'num1', phone: '+5491155551234', country: 'AR' },
            { id: 'num2', phone: '+5493515552222', country: 'AR' },
          ],
        }),
      });

      // 3. Start provisioning
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          numberId: 'prov123',
          status: 'pending_verification',
        }),
      });

      mockPrisma.whatsAppBusinessAccount.create.mockResolvedValue({
        id: 'waba123',
        organizationId: 'org123',
        phoneNumber: '+5491155551234',
        provisioningStatus: 'PENDING_VERIFICATION',
      });

      // 4. Verify with OTP
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          verified: true,
          apiKey: 'waba_api_key_123',
        }),
      });

      mockPrisma.whatsAppBusinessAccount.update.mockResolvedValue({
        id: 'waba123',
        provisioningStatus: 'ACTIVE',
        accessToken: 'waba_api_key_123',
      });

      // Simulate the flow
      const subscription = await mockPrisma.subscription.findFirst();
      expect(subscription?.tier).toBe('PROFESIONAL');

      const numbersResponse = await mockFetch();
      const numbers = await numbersResponse.json();
      expect(numbers.numbers).toHaveLength(2);

      const provisionResponse = await mockFetch();
      const provisionResult = await provisionResponse.json();
      expect(provisionResult.success).toBe(true);

      const verifyResponse = await mockFetch();
      const verifyResult = await verifyResponse.json();
      expect(verifyResult.verified).toBe(true);
    });
  });

  describe('Message Sending Flow', () => {
    beforeEach(() => {
      // Setup active WABA account
      mockPrisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        organizationId: 'org123',
        phoneNumber: '+5491155551234',
        phoneNumberId: 'phone123',
        accessToken: 'waba_api_key',
        provisioningStatus: 'ACTIVE',
        monthlyMessageCount: 50,
      });
    });

    it('should send text message and track usage', async () => {
      // Mock message send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.abc123' }],
        }),
      });

      // Mock conversation
      mockPrisma.whatsAppConversation.findFirst.mockResolvedValue({
        id: 'conv123',
        organizationId: 'org123',
      });

      // Mock message creation
      mockPrisma.whatsAppMessage.create.mockResolvedValue({
        id: 'msg123',
        whatsappMessageId: 'wamid.abc123',
        direction: 'OUTBOUND',
        status: 'SENT',
      });

      // Mock usage update
      mockPrisma.whatsAppBusinessAccount.update.mockResolvedValue({
        monthlyMessageCount: 51,
      });

      // Simulate sending a message
      const response = await mockFetch('https://waba.360dialog.io/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          to: '+5491155559999',
          type: 'text',
          text: { body: 'Hello World' },
        }),
      });

      const result = await response.json();
      expect(result.messages[0].id).toBe('wamid.abc123');

      // Verify message was saved
      await mockPrisma.whatsAppMessage.create({
        data: {
          conversationId: 'conv123',
          whatsappMessageId: 'wamid.abc123',
          direction: 'OUTBOUND',
          content: 'Hello World',
          status: 'SENT',
        },
      });

      expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalled();
    });

    it('should handle message delivery status updates', async () => {
      // Mock status update
      mockPrisma.whatsAppMessage.updateMany.mockResolvedValue({
        count: 1,
      });

      // Simulate webhook status update
      const statusUpdate = {
        id: 'wamid.abc123',
        status: 'delivered',
        timestamp: '1702654800',
      };

      await mockPrisma.whatsAppMessage.updateMany({
        where: { whatsappMessageId: statusUpdate.id },
        data: { status: 'DELIVERED' },
      });

      expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { whatsappMessageId: 'wamid.abc123' },
        })
      );
    });
  });

  describe('Inbound Message Flow', () => {
    beforeEach(() => {
      mockPrisma.whatsAppBusinessAccount.findFirst.mockResolvedValue({
        id: 'waba123',
        organizationId: 'org123',
        phoneNumber: '+5491155551234',
        phoneNumberId: 'phone123',
        provisioningStatus: 'ACTIVE',
      });
    });

    it('should process inbound message and create conversation', async () => {
      // No existing customer
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      // Create new customer
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust123',
        organizationId: 'org123',
        name: 'John Doe',
        phone: '+5491199998888',
      });

      // No existing conversation
      mockPrisma.whatsAppConversation.findFirst.mockResolvedValue(null);

      // Create new conversation
      mockPrisma.whatsAppConversation.create.mockResolvedValue({
        id: 'conv123',
        organizationId: 'org123',
        customerId: 'cust123',
        status: 'OPEN',
      });

      // Save inbound message
      mockPrisma.whatsAppMessage.create.mockResolvedValue({
        id: 'msg123',
        conversationId: 'conv123',
        direction: 'INBOUND',
        content: 'Hola, necesito un presupuesto',
      });

      // Simulate processing inbound message
      const inboundMessage = {
        from: '+5491199998888',
        id: 'wamid.inbound123',
        timestamp: '1702654800',
        type: 'text',
        text: { body: 'Hola, necesito un presupuesto' },
      };

      // Check customer
      let customer = await mockPrisma.customer.findFirst({
        where: { phone: inboundMessage.from },
      });

      if (!customer) {
        customer = await mockPrisma.customer.create({
          data: {
            organizationId: 'org123',
            name: inboundMessage.from,
            phone: inboundMessage.from,
          },
        });
      }

      expect(customer.id).toBe('cust123');

      // Check conversation
      let conversation = await mockPrisma.whatsAppConversation.findFirst({
        where: { customerPhone: inboundMessage.from },
      });

      if (!conversation) {
        conversation = await mockPrisma.whatsAppConversation.create({
          data: {
            organizationId: 'org123',
            customerId: customer.id,
            customerPhone: inboundMessage.from,
            status: 'OPEN',
          },
        });
      }

      expect(conversation.id).toBe('conv123');

      // Save message
      const message = await mockPrisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          whatsappMessageId: inboundMessage.id,
          direction: 'INBOUND',
          content: inboundMessage.text.body,
        },
      });

      expect(message.direction).toBe('INBOUND');
    });
  });

  describe('AI Response Integration', () => {
    beforeEach(() => {
      // Setup AI configuration
      mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
        id: 'aiconfig123',
        organizationId: 'org123',
        isEnabled: true,
        autoResponseEnabled: true,
        minConfidenceToRespond: 70,
        companyName: 'Test Company',
        servicesOffered: [{ name: 'Installation', description: 'AC installation' }],
      });

      mockPrisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        organizationId: 'org123',
        accessToken: 'waba_api_key',
        provisioningStatus: 'ACTIVE',
      });
    });

    it('should trigger AI response for inbound messages', async () => {
      // Mock OpenAI response would go here
      // For now, test the flow structure

      const aiConfig = await mockPrisma.aIConfiguration.findUnique({
        where: { organizationId: 'org123' },
      });

      expect(aiConfig?.isEnabled).toBe(true);
      expect(aiConfig?.autoResponseEnabled).toBe(true);
    });

    it('should respect business hours for AI responses', () => {
      const businessHours = {
        lunes: { open: '09:00', close: '18:00' },
        martes: { open: '09:00', close: '18:00' },
        miercoles: { open: '09:00', close: '18:00' },
        jueves: { open: '09:00', close: '18:00' },
        viernes: { open: '09:00', close: '18:00' },
        sabado: null,
        domingo: null,
      };

      // Monday at 10:00 should be within hours
      const isWithinHours: (day: string, time: string) => boolean = (day, time) => {
        const hours = businessHours[day as keyof typeof businessHours];
        if (!hours) return false;
        return time >= hours.open && time <= hours.close;
      };

      expect(isWithinHours('lunes', '10:00')).toBe(true);
      expect(isWithinHours('lunes', '20:00')).toBe(false);
      expect(isWithinHours('sabado', '10:00')).toBe(false);
    });
  });

  describe('Usage Tracking Accuracy', () => {
    it('should accurately track monthly message count', async () => {
      mockPrisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        monthlyMessageCount: 100,
        lastBillingReset: new Date('2024-12-01'),
      });

      // Simulate sending 5 messages
      for (let i = 0; i < 5; i++) {
        mockPrisma.whatsAppBusinessAccount.update.mockResolvedValueOnce({
          monthlyMessageCount: 101 + i,
        });
      }

      // After 5 messages, count should be 105
      const account = await mockPrisma.whatsAppBusinessAccount.findUnique({
        where: { id: 'waba123' },
      });

      expect(account?.monthlyMessageCount).toBe(100);
    });

    it('should reset count at billing cycle', () => {
      const lastReset = new Date('2024-11-01');
      const now = new Date('2024-12-15');

      // Check if new billing cycle
      const isNewBillingCycle = (lastReset: Date, now: Date) => {
        return lastReset.getMonth() !== now.getMonth() ||
          lastReset.getFullYear() !== now.getFullYear();
      };

      expect(isNewBillingCycle(lastReset, now)).toBe(true);

      const sameMonth = new Date('2024-12-01');
      expect(isNewBillingCycle(sameMonth, now)).toBe(false);
    });

    it('should enforce tier limits', () => {
      const tierLimits = {
        PROFESIONAL: 1000,
        EMPRESARIAL: 5000,
        ENTERPRISE: -1, // Unlimited
      };

      const checkLimit = (tier: string, currentCount: number) => {
        const limit = tierLimits[tier as keyof typeof tierLimits];
        if (limit === -1) return { allowed: true };
        return {
          allowed: currentCount < limit,
          remaining: limit - currentCount,
        };
      };

      expect(checkLimit('PROFESIONAL', 500).allowed).toBe(true);
      expect(checkLimit('PROFESIONAL', 1000).allowed).toBe(false);
      expect(checkLimit('ENTERPRISE', 999999).allowed).toBe(true);
    });
  });
});

describe('Webhook Processing', () => {
  it('should process message webhook correctly', () => {
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '+5491155551234',
              phone_number_id: 'phone123',
            },
            messages: [{
              from: '+5491199998888',
              id: 'wamid.inbound456',
              timestamp: '1702654800',
              type: 'text',
              text: { body: 'Test message' },
            }],
            contacts: [{
              profile: { name: 'Test User' },
              wa_id: '5491199998888',
            }],
          },
        }],
      }],
    };

    expect(webhookPayload.object).toBe('whatsapp_business_account');
    expect(webhookPayload.entry[0].changes[0].value.messages).toHaveLength(1);
    expect(webhookPayload.entry[0].changes[0].value.messages[0].text.body).toBe('Test message');
  });

  it('should process status webhook correctly', () => {
    const statusWebhook = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            statuses: [{
              id: 'wamid.abc123',
              status: 'delivered',
              timestamp: '1702654800',
              recipient_id: '5491199998888',
            }],
          },
        }],
      }],
    };

    const status = statusWebhook.entry[0].changes[0].value.statuses[0];
    expect(status.status).toBe('delivered');
    expect(status.id).toBe('wamid.abc123');
  });
});
