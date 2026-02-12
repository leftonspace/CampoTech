/**
 * Verification Manager Unit Tests
 * ================================
 *
 * Tests for document verification functionality:
 * - Verification submission
 * - Status tracking
 * - Approval/rejection flows
 * - Tier completion checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock prisma with all models needed by verification-manager
// Must be inside vi.hoisted() so it's available when vi.mock runs
const mockPrisma = vi.hoisted(() => {
  const mp = {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationRequirement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    verificationSubmission: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    complianceBlock: {
      count: vi.fn().mockResolvedValue(0),
    },
    businessPublicProfile: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Set up $transaction after mp is defined so it can reference itself
  mp.$transaction.mockImplementation(async (callback: unknown) => {
    if (typeof callback === 'function') return callback(mp);
    return Promise.all(callback as Promise<unknown>[]);
  });
  return mp;
});

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock auto-verifier
vi.mock('@/lib/services/auto-verifier', () => ({
  autoVerifier: {
    verifySubmission: vi.fn().mockResolvedValue({ success: false }),
  },
}));

// Mock whatsapp profile sync
vi.mock('@/lib/services/whatsapp-profile-sync.service', () => ({
  whatsAppProfileSync: {
    syncProfile: vi.fn().mockResolvedValue(undefined),
    syncBadgesToWhatsApp: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock acknowledgment service
vi.mock('@/lib/services/acknowledgment-service', () => ({
  acknowledgmentService: {
    getUnacknowledgedRequirements: vi.fn().mockResolvedValue([]),
  },
}));

// Import after mocking
import { verificationManager } from '@/lib/services/verification-manager';

describe('VerificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitVerification', () => {
    it('should create a new verification submission', async () => {
      const mockRequirement = {
        id: 'req-1',
        code: 'cuit_certificate',
        name: 'Certificado CUIT',
        tier: 2,
        isRequired: true,
        isActive: true,
        appliesTo: 'organization',
        autoVerifySource: null,
      };

      const mockSubmission = {
        id: 'sub-1',
        organizationId: 'org-1',
        requirementId: 'req-1',
        userId: 'user-1',
        status: 'in_review',
        documentUrl: 'https://storage.example.com/doc.pdf',
        documentType: 'pdf',
        submittedAt: new Date(),
        requirement: mockRequirement,
      };

      mockPrisma.verificationRequirement.findUnique.mockResolvedValueOnce(mockRequirement);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-1' });
      mockPrisma.verificationSubmission.upsert.mockResolvedValueOnce(mockSubmission);
      // Mock status update calls
      mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.verificationSubmission.findUnique.mockResolvedValueOnce(mockSubmission);

      const result = await verificationManager.submitVerification({
        organizationId: 'org-1',
        requirementCode: 'cuit_certificate',
        documentUrl: 'https://storage.example.com/doc.pdf',
        documentType: 'pdf',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('in_review');
      expect(mockPrisma.verificationSubmission.upsert).toHaveBeenCalled();
    });

    it('should throw error for invalid requirement code', async () => {
      mockPrisma.verificationRequirement.findUnique.mockResolvedValueOnce(null);

      await expect(
        verificationManager.submitVerification({
          organizationId: 'org-1',
          requirementCode: 'nonexistent',
        })
      ).rejects.toThrow('Requirement not found');
    });
  });

  describe('approveSubmission', () => {
    it('should approve a pending submission', async () => {
      const mockSubmission = {
        id: 'sub-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'approved',
        requirement: {
          appliesTo: 'organization',
        },
      };

      mockPrisma.verificationSubmission.update.mockResolvedValueOnce(mockSubmission);
      // Mock status update calls  
      mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
      mockPrisma.organization.update.mockResolvedValue({});

      await verificationManager.approveSubmission('sub-1', 'admin-1');

      expect(mockPrisma.verificationSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: 'approved',
            verifiedBy: 'admin',
            verifiedByUserId: 'admin-1',
          }),
        })
      );
    });

    it('should accept optional expiration date', async () => {
      const expiresAt = new Date('2027-01-01');
      const mockSubmission = {
        id: 'sub-1',
        organizationId: 'org-1',
        requirement: { appliesTo: 'organization' },
      };

      mockPrisma.verificationSubmission.update.mockResolvedValueOnce(mockSubmission);
      mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
      mockPrisma.organization.update.mockResolvedValue({});

      await verificationManager.approveSubmission('sub-1', 'admin-1', expiresAt);

      expect(mockPrisma.verificationSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt,
          }),
        })
      );
    });
  });

  describe('rejectSubmission', () => {
    it('should reject a submission with reason', async () => {
      const mockSubmission = {
        id: 'sub-1',
        organizationId: 'org-1',
        status: 'rejected',
        requirement: { appliesTo: 'organization' },
      };

      mockPrisma.verificationSubmission.update.mockResolvedValueOnce(mockSubmission);
      mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
      mockPrisma.organization.update.mockResolvedValue({});

      await verificationManager.rejectSubmission('sub-1', 'admin-1', 'Documento ilegible');

      expect(mockPrisma.verificationSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Documento ilegible',
          }),
        })
      );
    });

    it('should include optional rejection code', async () => {
      const mockSubmission = {
        id: 'sub-1',
        organizationId: 'org-1',
        requirement: { appliesTo: 'organization' },
      };

      mockPrisma.verificationSubmission.update.mockResolvedValueOnce(mockSubmission);
      mockPrisma.verificationRequirement.findMany.mockResolvedValue([]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValue([]);
      mockPrisma.organization.update.mockResolvedValue({});

      await verificationManager.rejectSubmission('sub-1', 'admin-1', 'Expired', 'DOC_EXPIRED');

      expect(mockPrisma.verificationSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rejectionCode: 'DOC_EXPIRED',
          }),
        })
      );
    });
  });

  describe('checkTier2Complete', () => {
    it('should return true when all required Tier 2 requirements are approved', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1' },
        { id: 'req-2' },
      ]);
      mockPrisma.verificationSubmission.count.mockResolvedValueOnce(2);

      const result = await verificationManager.checkTier2Complete('org-1');

      expect(result).toBe(true);
    });

    it('should return false when not all requirements are approved', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1' },
        { id: 'req-2' },
        { id: 'req-3' },
      ]);
      mockPrisma.verificationSubmission.count.mockResolvedValueOnce(1);

      const result = await verificationManager.checkTier2Complete('org-1');

      expect(result).toBe(false);
    });

    it('should return true when there are no requirements', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([]);

      const result = await verificationManager.checkTier2Complete('org-1');

      expect(result).toBe(true);
    });
  });

  describe('checkEmployeeVerified', () => {
    it('should return true when employee has all required verifications', async () => {
      // checkEmployeeVerified first calls user.findUnique to get organizationId
      mockPrisma.user.findUnique.mockResolvedValueOnce({ organizationId: 'org-1' });
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([{ id: 'req-emp-1' }]);
      mockPrisma.verificationSubmission.count.mockResolvedValueOnce(1);

      const result = await verificationManager.checkEmployeeVerified('user-1');

      expect(result).toBe(true);
    });

    it('should return false when employee is missing verifications', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ organizationId: 'org-1' });
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-emp-1' },
        { id: 'req-emp-2' },
      ]);
      mockPrisma.verificationSubmission.count.mockResolvedValueOnce(0);

      const result = await verificationManager.checkEmployeeVerified('user-1');

      expect(result).toBe(false);
    });
  });

  describe('getRequirementsForOrg', () => {
    it('should return requirements with their submission status', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-1',
          code: 'cuit_certificate',
          name: 'Certificado CUIT',
          tier: 2,
          isRequired: true,
          isActive: true,
          appliesTo: 'organization',
        },
      ]);

      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          requirementId: 'req-1',
          status: 'approved',
          submittedAt: new Date(),
          verifiedAt: new Date(),
          expiresAt: null,
        },
      ]);

      const result = await verificationManager.getRequirementsForOrg('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].requirement.code).toBe('cuit_certificate');
      expect(result[0].status).toBe('approved');
    });

    it('should return not_submitted for requirements without submissions', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-1',
          code: 'insurance',
          name: 'Seguro',
          tier: 2,
          isRequired: true,
          isActive: true,
          appliesTo: 'organization',
        },
      ]);

      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([]);

      const result = await verificationManager.getRequirementsForOrg('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('not_started');
    });
  });

  describe('calculateComplianceScore', () => {
    it('should return 100 when all Tier 2 and Tier 4 requirements are met', async () => {
      // Score = Tier 2 approved (70%) + Tier 4 approved (30%)
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1', code: 'cuit', tier: 2, isRequired: true, isActive: true, appliesTo: 'organization' },
        { id: 'req-2', code: 'gas_cert', tier: 4, isRequired: false, isActive: true, appliesTo: 'organization' },
      ]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([
        { id: 'sub-1', requirementId: 'req-1', status: 'approved', expiresAt: null, submittedAt: new Date() },
        { id: 'sub-2', requirementId: 'req-2', status: 'approved', expiresAt: null, submittedAt: new Date() },
      ]);

      const score = await verificationManager.calculateComplianceScore('org-1');

      expect(score).toBe(100);
    });

    it('should return 70 when only Tier 2 requirements are met (no Tier 4 available)', async () => {
      // Only Tier 2 reqs, all approved = 70% (Tier 4 contributes 0 if none available)
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1', code: 'cuit', tier: 2, isRequired: true, isActive: true, appliesTo: 'organization' },
        { id: 'req-2', code: 'insurance', tier: 2, isRequired: true, isActive: true, appliesTo: 'organization' },
      ]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([
        { id: 'sub-1', requirementId: 'req-1', status: 'approved', expiresAt: null, submittedAt: new Date() },
        { id: 'sub-2', requirementId: 'req-2', status: 'approved', expiresAt: null, submittedAt: new Date() },
      ]);

      const score = await verificationManager.calculateComplianceScore('org-1');

      expect(score).toBe(70);
    });

    it('should return 0 when no requirements are met', async () => {
      mockPrisma.verificationRequirement.findMany.mockResolvedValueOnce([
        { id: 'req-1', code: 'cuit', tier: 2, isRequired: true, isActive: true, appliesTo: 'organization' },
        { id: 'req-2', code: 'insurance', tier: 2, isRequired: true, isActive: true, appliesTo: 'organization' },
      ]);
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([]);

      const score = await verificationManager.calculateComplianceScore('org-1');

      expect(score).toBe(0);
    });
  });

  describe('getEarnedBadges', () => {
    it('should return badges for approved Tier 4 submissions', async () => {
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          status: 'approved',
          verifiedAt: new Date(),
          expiresAt: null,
          requirement: {
            code: 'gas_certified',
            name: 'Gasista matriculado',
            tier: 4,
            badgeLabel: 'Gasista Matriculado',
            badgeIcon: 'flame',
          },
        },
      ]);

      const badges = await verificationManager.getEarnedBadges('org-1');

      expect(badges).toHaveLength(1);
      expect(badges[0].code).toBe('gas_certified');
      expect(badges[0].label).toBe('Gasista Matriculado');
    });

    it('should return empty array when no Tier 4 badges earned', async () => {
      mockPrisma.verificationSubmission.findMany.mockResolvedValueOnce([]);

      const badges = await verificationManager.getEarnedBadges('org-1');

      expect(badges).toEqual([]);
    });
  });
});
