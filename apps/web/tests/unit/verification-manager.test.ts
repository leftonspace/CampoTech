/**
 * Verification Manager Unit Tests
 * ================================
 *
 * Tests for document verification functionality:
 * - Document submission
 * - Status tracking
 * - Approval/rejection flows
 * - Tier completion checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockOrgWithSubscription,
  createMockVerificationDocument,
  createMockVerifiedOrganization,
  createMockExpiringDocument,
  createMockPrisma,
  freezeTime,
  unfreezeTime,
  advanceTime,
  resetAllMocks,
} from '../utils/subscription-test-helpers';

// Mock prisma
const mockPrisma = createMockPrisma();
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { verificationManager } from '@/lib/services/verification-manager';

describe('VerificationManager', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPrisma._clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('submitDocument', () => {
    it('should create a new verification document', async () => {
      const doc = createMockVerificationDocument({
        status: 'pending',
        documentType: 'dni_front',
      });

      mockPrisma.verificationDocument.create.mockResolvedValueOnce(doc);
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await verificationManager.submitDocument({
        organizationId: 'org-1',
        userId: 'user-1',
        documentType: 'dni_front',
        fileUrl: 'https://storage.example.com/doc.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(mockPrisma.verificationDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: 'dni_front',
            status: 'pending',
          }),
        })
      );
    });

    it('should set document for review when submitted', async () => {
      const doc = createMockVerificationDocument({
        status: 'review',
      });

      mockPrisma.verificationDocument.create.mockResolvedValueOnce(doc);
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await verificationManager.submitDocument({
        organizationId: 'org-1',
        userId: 'user-1',
        documentType: 'cuit',
        fileUrl: 'https://storage.example.com/cuit.pdf',
        autoApprove: false,
      });

      expect(result.document?.status).toBe('review');
    });

    it('should log document submission event', async () => {
      const doc = createMockVerificationDocument();

      mockPrisma.verificationDocument.create.mockResolvedValueOnce(doc);
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await verificationManager.submitDocument({
        organizationId: 'org-1',
        userId: 'user-1',
        documentType: 'driver_license',
        fileUrl: 'https://storage.example.com/license.jpg',
      });

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'document.submitted',
          }),
        })
      );
    });

    it('should replace pending document of same type', async () => {
      const existingDoc = createMockVerificationDocument({
        id: 'doc-existing',
        documentType: 'dni_front',
        status: 'pending',
      });

      const newDoc = createMockVerificationDocument({
        id: 'doc-new',
        documentType: 'dni_front',
        status: 'pending',
      });

      mockPrisma.verificationDocument.findFirst = vi.fn().mockResolvedValueOnce(existingDoc);
      mockPrisma.verificationDocument.update = vi.fn().mockResolvedValueOnce({
        ...existingDoc,
        status: 'replaced',
      });
      mockPrisma.verificationDocument.create.mockResolvedValueOnce(newDoc);
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await verificationManager.submitDocument({
        organizationId: 'org-1',
        userId: 'user-1',
        documentType: 'dni_front',
        fileUrl: 'https://storage.example.com/new-doc.jpg',
      });

      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'replaced',
          }),
        })
      );
    });
  });

  describe('approveDocument', () => {
    it('should update document status to approved', async () => {
      const doc = createMockVerificationDocument({
        status: 'review',
      });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({
        ...doc,
        status: 'approved',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await verificationManager.approveDocument(doc.id, 'admin-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
          }),
        })
      );
    });

    it('should check tier completion after approval', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'in_review',
      });
      const doc = createMockVerificationDocument({
        status: 'review',
        organizationId: org.id,
      });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({
        ...doc,
        status: 'approved',
      });

      // Mock all Tier 2 docs as approved
      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce([
        createMockVerificationDocument({ documentType: 'cuit', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_front', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_back', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'selfie', status: 'approved' }),
      ]);

      mockPrisma.organization.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await verificationManager.approveDocument(doc.id, 'admin-1');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationStatus: 'verified',
          }),
        })
      );
    });

    it('should log approval event with admin ID', async () => {
      const doc = createMockVerificationDocument({ status: 'review' });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({});
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await verificationManager.approveDocument(doc.id, 'admin-123');

      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'document.approved',
            actorId: 'admin-123',
          }),
        })
      );
    });
  });

  describe('rejectDocument', () => {
    it('should update document status to rejected with reason', async () => {
      const doc = createMockVerificationDocument({
        status: 'review',
      });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({
        ...doc,
        status: 'rejected',
        rejectionReason: 'Image is blurry',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await verificationManager.rejectDocument(
        doc.id,
        'admin-1',
        'Image is blurry'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Image is blurry',
          }),
        })
      );
    });

    it('should notify user of rejection', async () => {
      const doc = createMockVerificationDocument({ status: 'review' });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({
        ...doc,
        status: 'rejected',
      });
      mockPrisma.notification = {
        create: vi.fn().mockResolvedValueOnce({}),
      };
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      await verificationManager.rejectDocument(doc.id, 'admin-1', 'Photo not clear');

      // Notification should be created
      expect(mockPrisma.notification?.create || mockPrisma.subscriptionEvent.create).toHaveBeenCalled();
    });
  });

  describe('getVerificationStatus', () => {
    it('should return pending when no documents submitted', async () => {
      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce([]);

      const status = await verificationManager.getVerificationStatus('org-1');

      expect(status.tier2Complete).toBe(false);
      expect(status.overallStatus).toBe('pending');
    });

    it('should return verified when all tier 2 docs approved', async () => {
      const docs = [
        createMockVerificationDocument({ documentType: 'cuit', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_front', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_back', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'selfie', status: 'approved' }),
      ];

      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce(docs);

      const status = await verificationManager.getVerificationStatus('org-1');

      expect(status.tier2Complete).toBe(true);
      expect(status.overallStatus).toBe('verified');
    });

    it('should return in_review when documents are pending review', async () => {
      const docs = [
        createMockVerificationDocument({ documentType: 'cuit', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_front', status: 'review' }),
      ];

      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce(docs);

      const status = await verificationManager.getVerificationStatus('org-1');

      expect(status.overallStatus).toBe('in_review');
      expect(status.pendingDocuments).toContain('dni_front');
    });

    it('should return rejected when any document is rejected', async () => {
      const docs = [
        createMockVerificationDocument({ documentType: 'cuit', status: 'approved' }),
        createMockVerificationDocument({ documentType: 'dni_front', status: 'rejected' }),
      ];

      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce(docs);

      const status = await verificationManager.getVerificationStatus('org-1');

      expect(status.overallStatus).toBe('rejected');
      expect(status.rejectedDocuments).toHaveLength(1);
    });
  });

  describe('checkExpiringDocuments', () => {
    it('should return documents expiring within specified days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const expiringDoc = createMockExpiringDocument(5); // Expires in 5 days

      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce([expiringDoc]);

      const result = await verificationManager.checkExpiringDocuments(7);

      expect(result).toHaveLength(1);
      expect(result[0].daysUntilExpiry).toBeLessThanOrEqual(7);
    });

    it('should not return documents expiring after specified days', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      freezeTime(now);

      const doc = createMockExpiringDocument(30); // Expires in 30 days

      mockPrisma.verificationDocument.findMany.mockResolvedValueOnce([]);

      const result = await verificationManager.checkExpiringDocuments(7);

      expect(result).toHaveLength(0);
    });
  });

  describe('markDocumentExpired', () => {
    it('should update document status to expired', async () => {
      const doc = createMockVerificationDocument({
        status: 'approved',
        expiresAt: new Date('2024-01-01'), // Past date
      });

      mockPrisma.verificationDocument.findUnique.mockResolvedValueOnce(doc);
      mockPrisma.verificationDocument.update.mockResolvedValueOnce({
        ...doc,
        status: 'expired',
      });
      mockPrisma.subscriptionEvent.create.mockResolvedValueOnce({});

      const result = await verificationManager.markDocumentExpired(doc.id);

      expect(result.success).toBe(true);
      expect(mockPrisma.verificationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'expired',
          }),
        })
      );
    });
  });

  describe('getTier2Requirements', () => {
    it('should return list of required documents for tier 2', () => {
      const requirements = verificationManager.getTier2Requirements();

      expect(requirements).toContain('cuit');
      expect(requirements).toContain('dni_front');
      expect(requirements).toContain('dni_back');
      expect(requirements).toContain('selfie');
    });
  });

  describe('canReceiveJobs', () => {
    it('should return true when tier 2 verification is complete', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        blockType: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const canReceive = await verificationManager.canReceiveJobs(org.id);

      expect(canReceive).toBe(true);
    });

    it('should return false when verification is incomplete', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'pending',
        subscriptionStatus: 'active',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const canReceive = await verificationManager.canReceiveJobs(org.id);

      expect(canReceive).toBe(false);
    });

    it('should return false when organization is blocked', async () => {
      const org = createMockOrgWithSubscription({
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        blockType: 'soft_block',
      });

      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);

      const canReceive = await verificationManager.canReceiveJobs(org.id);

      expect(canReceive).toBe(false);
    });
  });
});
