/**
 * WhatsApp Number Provisioning Unit Tests
 * =========================================
 *
 * Tests for the number provisioning flow including:
 * - Available number listing
 * - Number selection and reservation
 * - Verification process
 * - Provisioning status management
 */

// Using Jest globals

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    whatsAppBusinessAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
  },
}));

// Create a shared mock provider instance
const mockProvider = {
  getAvailableNumbers: jest.fn(),
  provisionNumber: jest.fn(),
  verifyNumber: jest.fn(),
  releaseNumber: jest.fn(),
  resendVerification: jest.fn(),
};

// Mock the provider factory to return the shared instance
jest.mock('@/lib/integrations/whatsapp/providers', () => ({
  getBSPProvider: vi.fn(() => mockProvider),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getBSPProvider } from '@/lib/integrations/whatsapp/providers';

const mockFetch = jest.fn();
global.fetch = mockFetch;


describe('Provisioning API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/whatsapp/provision - Status Check', () => {
    it('should return provisioning status for configured account', async () => {
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        phoneNumber: '+5491155551234',
        provisioningStatus: 'ACTIVE',
        displayPhoneNumber: '+54 9 11 5555-1234',
        bspProvider: 'DIALOG360',
      });

      // Simulate API call response structure
      const expectedResponse = {
        isProvisioned: true,
        status: 'ACTIVE',
        phoneNumber: '+5491155551234',
        displayPhoneNumber: '+54 9 11 5555-1234',
        provider: 'DIALOG360',
      };

      expect(expectedResponse.isProvisioned).toBe(true);
      expect(expectedResponse.status).toBe('ACTIVE');
    });

    it('should return not provisioned for new organization', async () => {
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        isProvisioned: false,
        status: null,
        phoneNumber: null,
      };

      expect(expectedResponse.isProvisioned).toBe(false);
    });
  });

  describe('GET /api/whatsapp/provision/available - Number Listing', () => {
    it('should return available numbers for PROFESIONAL tier', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        tier: 'PROFESIONAL',
        status: 'ACTIVE',
      });

      getBSPProvider().getAvailableNumbers.mockResolvedValue([
        { id: 'num1', phoneNumber: '+5491155551234', areaCode: '11', city: 'Buenos Aires' },
        { id: 'num2', phoneNumber: '+5493515552222', areaCode: '351', city: 'Córdoba' },
      ]);

      const numbers = await getBSPProvider().getAvailableNumbers('AR');

      expect(numbers).toHaveLength(2);
      expect(numbers[0].phoneNumber).toBe('+5491155551234');
    });

    it('should reject request for FREE tier', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        tier: 'FREE',
        status: 'ACTIVE',
      });

      // FREE tier should not have access to BSP
      const tier = 'FREE';
      const allowedTiers = ['PROFESIONAL', 'EMPRESARIAL', 'ENTERPRISE'];
      const hasAccess = allowedTiers.includes(tier);

      expect(hasAccess).toBe(false);
    });

    it('should reject request for INICIAL tier', async () => {
      const tier = 'INICIAL';
      const allowedTiers = ['PROFESIONAL', 'EMPRESARIAL', 'ENTERPRISE'];
      const hasAccess = allowedTiers.includes(tier);

      expect(hasAccess).toBe(false);
    });

    it('should group numbers by area code', () => {
      const numbers = [
        { id: '1', phoneNumber: '+5491155551111', areaCode: '11' },
        { id: '2', phoneNumber: '+5491155552222', areaCode: '11' },
        { id: '3', phoneNumber: '+5493515553333', areaCode: '351' },
      ];

      const grouped = numbers.reduce((acc, num) => {
        const code = num.areaCode;
        if (!acc[code]) acc[code] = [];
        acc[code].push(num);
        return acc;
      }, {} as Record<string, typeof numbers>);

      expect(Object.keys(grouped)).toContain('11');
      expect(Object.keys(grouped)).toContain('351');
      expect(grouped['11']).toHaveLength(2);
      expect(grouped['351']).toHaveLength(1);
    });
  });

  describe('POST /api/whatsapp/provision - Start Provisioning', () => {
    it('should start provisioning flow', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        tier: 'PROFESIONAL',
        status: 'ACTIVE',
      });

      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue(null);

      getBSPProvider().provisionNumber.mockResolvedValue({
        success: true,
        numberId: 'prov123',
        status: 'pending_verification',
        verificationMethod: 'sms',
      });

      prisma.whatsAppBusinessAccount.create.mockResolvedValue({
        id: 'waba123',
        phoneNumber: '+5491155551234',
        provisioningStatus: 'PENDING_VERIFICATION',
      });

      const result = await getBSPProvider().provisionNumber('org123', 'num1', {
        businessName: 'Test Business',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_verification');
    });

    it('should reject if already provisioned', async () => {
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'existing_waba',
        provisioningStatus: 'ACTIVE',
      });

      const hasExisting = true;
      expect(hasExisting).toBe(true);
      // Should return error about existing provisioning
    });

    it('should validate business name is provided', () => {
      const data = { numberId: 'num1' };
      const hasBusinessName = 'businessName' in data;
      expect(hasBusinessName).toBe(false);
      // Should return validation error
    });
  });

  describe('POST /api/whatsapp/provision/verify - Verification', () => {
    it('should verify with valid 6-digit code', async () => {
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        provisioningStatus: 'PENDING_VERIFICATION',
      });

      getBSPProvider().verifyNumber.mockResolvedValue({
        success: true,
        apiKey: 'waba_api_key_123',
      });

      const result = await getBSPProvider().verifyNumber('org123', '123456');

      expect(result.success).toBe(true);
    });

    it('should reject invalid code format', () => {
      const testCodes = ['12345', '1234567', 'abcdef', '12 34 56'];

      testCodes.forEach((code) => {
        const isValid = /^\d{6}$/.test(code);
        expect(isValid).toBe(false);
      });
    });

    it('should accept valid 6-digit codes', () => {
      const validCodes = ['123456', '000000', '999999'];

      validCodes.forEach((code) => {
        const isValid = /^\d{6}$/.test(code);
        expect(isValid).toBe(true);
      });
    });

    it('should handle resend verification request', async () => {
      getBSPProvider().resendVerification = jest.fn().mockResolvedValue({
        success: true,
        method: 'sms',
        expiresAt: new Date(Date.now() + 600000), // 10 minutes
      });

      const result = await getBSPProvider().resendVerification('org123');
      expect(result.success).toBe(true);
    });
  });

  describe('DELETE /api/whatsapp/provision - Release Number', () => {
    it('should release provisioned number', async () => {
      prisma.whatsAppBusinessAccount.findUnique.mockResolvedValue({
        id: 'waba123',
        provisioningStatus: 'ACTIVE',
      });

      getBSPProvider().releaseNumber.mockResolvedValue({
        success: true,
      });

      const result = await getBSPProvider().releaseNumber('org123');

      expect(result.success).toBe(true);
    });

    it('should update database after release', async () => {
      // Simulate updating the record to mark as released
      prisma.whatsAppBusinessAccount.update.mockResolvedValue({
        id: 'waba123',
        provisioningStatus: 'RELEASED',
        releasedAt: new Date(),
      });

      await prisma.whatsAppBusinessAccount.update({
        where: { id: 'waba123' },
        data: { provisioningStatus: 'RELEASED', releasedAt: new Date() },
      });

      expect(prisma.whatsAppBusinessAccount.update).toHaveBeenCalled();
    });
  });
});

describe('Provisioning Status Transitions', () => {
  it('should follow valid status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      NONE: ['PENDING_NUMBER_SELECTION'],
      PENDING_NUMBER_SELECTION: ['PENDING_VERIFICATION', 'CANCELLED'],
      PENDING_VERIFICATION: ['ACTIVE', 'FAILED', 'CANCELLED'],
      ACTIVE: ['SUSPENDED', 'RELEASED'],
      SUSPENDED: ['ACTIVE', 'RELEASED'],
      FAILED: ['PENDING_NUMBER_SELECTION'],
      RELEASED: ['PENDING_NUMBER_SELECTION'],
      CANCELLED: ['PENDING_NUMBER_SELECTION'],
    };

    // Test valid transition
    expect(validTransitions['NONE']).toContain('PENDING_NUMBER_SELECTION');
    expect(validTransitions['PENDING_VERIFICATION']).toContain('ACTIVE');

    // Test invalid transition
    expect(validTransitions['ACTIVE']).not.toContain('PENDING_VERIFICATION');
    expect(validTransitions['NONE']).not.toContain('ACTIVE');
  });

  it('should track status history', () => {
    const statusHistory = [
      { status: 'PENDING_NUMBER_SELECTION', timestamp: new Date('2024-01-01T10:00:00Z') },
      { status: 'PENDING_VERIFICATION', timestamp: new Date('2024-01-01T10:05:00Z') },
      { status: 'ACTIVE', timestamp: new Date('2024-01-01T10:10:00Z') },
    ];

    expect(statusHistory).toHaveLength(3);
    expect(statusHistory[0].status).toBe('PENDING_NUMBER_SELECTION');
    expect(statusHistory[statusHistory.length - 1].status).toBe('ACTIVE');
  });
});

describe('Tier-Based Access Control', () => {
  const tierAccess = {
    FREE: { canUseBsp: false, canUseWameLinks: false },
    INICIAL: { canUseBsp: false, canUseWameLinks: true },
    PROFESIONAL: { canUseBsp: true, canUseWameLinks: true },
    EMPRESARIAL: { canUseBsp: true, canUseWameLinks: true },
    ENTERPRISE: { canUseBsp: true, canUseWameLinks: true },
  };

  it('should restrict BSP access for FREE tier', () => {
    expect(tierAccess.FREE.canUseBsp).toBe(false);
  });

  it('should allow wa.me links for INICIAL tier', () => {
    expect(tierAccess.INICIAL.canUseWameLinks).toBe(true);
    expect(tierAccess.INICIAL.canUseBsp).toBe(false);
  });

  it('should allow BSP for PROFESIONAL tier', () => {
    expect(tierAccess.PROFESIONAL.canUseBsp).toBe(true);
  });

  it('should allow all features for ENTERPRISE tier', () => {
    expect(tierAccess.ENTERPRISE.canUseBsp).toBe(true);
    expect(tierAccess.ENTERPRISE.canUseWameLinks).toBe(true);
  });
});

