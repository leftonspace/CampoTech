/**
 * WhatsApp Notifications Tests
 * ============================
 *
 * Integration tests for WhatsApp notification triggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the services
vi.mock('@/src/integrations/whatsapp/whatsapp.service', () => ({
  getWhatsAppConfig: vi.fn(),
  sendTemplate: vi.fn(),
}));

vi.mock('@/src/lib/db', () => ({
  db: {
    job: {
      findFirst: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from '@/src/lib/db';
import { getWhatsAppConfig, sendTemplate } from '@/src/integrations/whatsapp/whatsapp.service';
import {
  notifyJobScheduled,
  notifyTechnicianAssigned,
  notifyJobCompleted,
  notifyInvoiceReady,
  notifyPaymentReceived,
} from '@/src/modules/whatsapp/notifications.service';

describe('WhatsApp Notifications Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyJobScheduled', () => {
    it('should send job scheduled notification', async () => {
      const mockJob = {
        id: 'job_123',
        title: 'Fix plumbing',
        description: 'Kitchen sink leak',
        scheduledDate: new Date('2024-12-15T10:00:00'),
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          phone: '5491112345678',
        },
        location: {
          address: '123 Main St',
        },
        organization: {
          id: 'org_123',
          name: 'Plumbing Co',
        },
        assignments: [],
      };

      (db.job.findFirst as any).mockResolvedValueOnce(mockJob);
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (sendTemplate as any).mockResolvedValueOnce({ success: true, messageId: 'wamid.123' });

      const result = await notifyJobScheduled('job_123');

      expect(getWhatsAppConfig).toHaveBeenCalledWith('org_123');
      expect(sendTemplate).toHaveBeenCalledWith(
        'org_123',
        '5491112345678',
        'trabajo_programado',
        expect.objectContaining({
          '1': 'John Doe',
          '2': 'Fix plumbing',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should return error if job not found', async () => {
      (db.job.findFirst as any).mockResolvedValueOnce(null);

      const result = await notifyJobScheduled('invalid_job');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });

    it('should return error if WhatsApp not configured', async () => {
      const mockJob = {
        id: 'job_123',
        title: 'Fix plumbing',
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          phone: '5491112345678',
        },
        organization: {
          id: 'org_123',
          name: 'Test Org',
        },
        assignments: [],
      };

      (db.job.findFirst as any).mockResolvedValueOnce(mockJob);
      (getWhatsAppConfig as any).mockResolvedValueOnce(null);

      const result = await notifyJobScheduled('job_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('WhatsApp not configured');
    });

    it('should return error if customer has no phone', async () => {
      const mockJob = {
        id: 'job_123',
        title: 'Fix plumbing',
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          phone: null, // No phone
        },
        organization: {
          id: 'org_123',
          name: 'Test Org',
        },
        assignments: [],
      };

      (db.job.findFirst as any).mockResolvedValueOnce(mockJob);
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });

      const result = await notifyJobScheduled('job_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer has no phone number');
    });
  });

  describe('notifyTechnicianAssigned', () => {
    it('should send technician assigned notification with technician name', async () => {
      const mockJob = {
        id: 'job_123',
        title: 'Fix plumbing',
        scheduledDate: new Date('2024-12-15T10:00:00'),
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          phone: '5491112345678',
        },
        organization: {
          id: 'org_123',
          name: 'Plumbing Co',
        },
        assignments: [
          {
            technician: {
              id: 'tech_123',
              name: 'Mike Smith',
              phone: '5491187654321',
            },
          },
        ],
      };

      (db.job.findFirst as any).mockResolvedValueOnce(mockJob);
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (sendTemplate as any).mockResolvedValueOnce({ success: true, messageId: 'wamid.124' });

      const result = await notifyTechnicianAssigned('job_123');

      expect(sendTemplate).toHaveBeenCalledWith(
        'org_123',
        '5491112345678',
        'tecnico_asignado',
        expect.objectContaining({
          '1': 'John Doe',
          '2': 'Mike Smith',
          '3': 'Fix plumbing',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('notifyJobCompleted', () => {
    it('should send job completed notification', async () => {
      const mockJob = {
        id: 'job_123',
        title: 'Fix plumbing',
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          phone: '5491112345678',
        },
        organization: {
          id: 'org_123',
          name: 'Plumbing Co',
        },
        assignments: [],
      };

      (db.job.findFirst as any).mockResolvedValueOnce(mockJob);
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (sendTemplate as any).mockResolvedValueOnce({ success: true, messageId: 'wamid.125' });

      const result = await notifyJobCompleted('job_123');

      expect(sendTemplate).toHaveBeenCalledWith(
        'org_123',
        '5491112345678',
        'trabajo_completado',
        expect.objectContaining({
          '1': 'John Doe',
          '2': 'Fix plumbing',
          '3': 'Plumbing Co',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('notifyInvoiceReady', () => {
    it('should send invoice ready notification', async () => {
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (db.customer.findFirst as any).mockResolvedValueOnce({
        id: 'cust_123',
        name: 'John Doe',
        phone: '5491112345678',
      });
      (db.invoice.findFirst as any).mockResolvedValueOnce({
        id: 'inv_123',
        invoiceNumber: 'INV-001',
        total: 15000.5,
      });
      (sendTemplate as any).mockResolvedValueOnce({ success: true, messageId: 'wamid.126' });

      const result = await notifyInvoiceReady('inv_123', 'cust_123', 'org_123');

      expect(sendTemplate).toHaveBeenCalledWith(
        'org_123',
        '5491112345678',
        'factura_lista',
        {
          '1': 'John Doe',
          '2': 'INV-001',
          '3': '15000.5',
        }
      );
      expect(result.success).toBe(true);
    });

    it('should return error if customer not found', async () => {
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (db.customer.findFirst as any).mockResolvedValueOnce(null);

      const result = await notifyInvoiceReady('inv_123', 'cust_123', 'org_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer has no phone');
    });
  });

  describe('notifyPaymentReceived', () => {
    it('should send payment received notification', async () => {
      (getWhatsAppConfig as any).mockResolvedValueOnce({ phoneNumberId: 'PHONE_ID' });
      (db.customer.findFirst as any).mockResolvedValueOnce({
        id: 'cust_123',
        name: 'John Doe',
        phone: '5491112345678',
      });
      (db.payment.findFirst as any).mockResolvedValueOnce({
        id: 'pay_123',
        amount: 5000,
      });
      (sendTemplate as any).mockResolvedValueOnce({ success: true, messageId: 'wamid.127' });

      const result = await notifyPaymentReceived('pay_123', 'cust_123', 'org_123');

      expect(sendTemplate).toHaveBeenCalledWith(
        'org_123',
        '5491112345678',
        'pago_recibido',
        {
          '1': 'John Doe',
          '2': '5000',
        }
      );
      expect(result.success).toBe(true);
    });
  });
});
