/**
 * WhatsApp Notification Triggers
 * ===============================
 *
 * Event handlers that trigger WhatsApp notifications
 * based on job lifecycle events.
 */

import { log } from '../../lib/logging/logger';
import {
  notifyJobScheduled,
  notifyTechnicianAssigned,
  notifyTechnicianOnTheWay,
  notifyJobStarted,
  notifyJobCompleted,
  notifyInvoiceReady,
  notifyPaymentReceived,
} from './notifications.service';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle job scheduled event
 */
export async function onJobScheduled(jobId: string): Promise<void> {
  try {
    log.info('Job scheduled - triggering WhatsApp notification', { jobId });
    const result = await notifyJobScheduled(jobId);
    if (!result.success) {
      log.warn('Failed to send job scheduled notification', {
        jobId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onJobScheduled handler', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle technician assigned event
 */
export async function onTechnicianAssigned(
  jobId: string,
  technicianId: string
): Promise<void> {
  try {
    log.info('Technician assigned - triggering WhatsApp notification', {
      jobId,
      technicianId,
    });
    const result = await notifyTechnicianAssigned(jobId);
    if (!result.success) {
      log.warn('Failed to send technician assigned notification', {
        jobId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onTechnicianAssigned handler', {
      jobId,
      technicianId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle technician en route event
 */
export async function onTechnicianEnRoute(
  jobId: string,
  technicianId: string
): Promise<void> {
  try {
    log.info('Technician en route - triggering WhatsApp notification', {
      jobId,
      technicianId,
    });
    const result = await notifyTechnicianOnTheWay(jobId);
    if (!result.success) {
      log.warn('Failed to send technician en route notification', {
        jobId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onTechnicianEnRoute handler', {
      jobId,
      technicianId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle job started event
 */
export async function onJobStarted(jobId: string): Promise<void> {
  try {
    log.info('Job started - triggering WhatsApp notification', { jobId });
    const result = await notifyJobStarted(jobId);
    if (!result.success) {
      log.warn('Failed to send job started notification', {
        jobId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onJobStarted handler', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle job completed event
 */
export async function onJobCompleted(jobId: string): Promise<void> {
  try {
    log.info('Job completed - triggering WhatsApp notification', { jobId });
    const result = await notifyJobCompleted(jobId);
    if (!result.success) {
      log.warn('Failed to send job completed notification', {
        jobId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onJobCompleted handler', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle invoice created event
 */
export async function onInvoiceCreated(
  invoiceId: string,
  customerId: string,
  organizationId: string
): Promise<void> {
  try {
    log.info('Invoice created - triggering WhatsApp notification', {
      invoiceId,
      customerId,
    });
    const result = await notifyInvoiceReady(invoiceId, customerId, organizationId);
    if (!result.success) {
      log.warn('Failed to send invoice ready notification', {
        invoiceId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onInvoiceCreated handler', {
      invoiceId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle payment received event
 */
export async function onPaymentReceived(
  paymentId: string,
  customerId: string,
  organizationId: string
): Promise<void> {
  try {
    log.info('Payment received - triggering WhatsApp notification', {
      paymentId,
      customerId,
    });
    const result = await notifyPaymentReceived(paymentId, customerId, organizationId);
    if (!result.success) {
      log.warn('Failed to send payment received notification', {
        paymentId,
        error: result.error,
      });
    }
  } catch (error) {
    log.error('Error in onPaymentReceived handler', {
      paymentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS CHANGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

type JobStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Handle job status change - routes to appropriate notification
 */
export async function onJobStatusChange(
  jobId: string,
  oldStatus: JobStatus,
  newStatus: JobStatus,
  metadata?: {
    technicianId?: string;
    reason?: string;
  }
): Promise<void> {
  // Don't notify on cancellation
  if (newStatus === 'CANCELLED') {
    return;
  }

  switch (newStatus) {
    case 'SCHEDULED':
      if (oldStatus === 'PENDING') {
        await onJobScheduled(jobId);
      }
      break;

    case 'ASSIGNED':
      if (metadata?.technicianId) {
        await onTechnicianAssigned(jobId, metadata.technicianId);
      }
      break;

    case 'EN_ROUTE':
      if (metadata?.technicianId) {
        await onTechnicianEnRoute(jobId, metadata.technicianId);
      }
      break;

    case 'IN_PROGRESS':
      await onJobStarted(jobId);
      break;

    case 'COMPLETED':
      await onJobCompleted(jobId);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  onJobScheduled,
  onTechnicianAssigned,
  onTechnicianEnRoute,
  onJobStarted,
  onJobCompleted,
  onInvoiceCreated,
  onPaymentReceived,
  onJobStatusChange,
};
