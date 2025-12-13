/**
 * WhatsApp Notifications Service
 * ===============================
 *
 * Automated notifications for job lifecycle events.
 * Sends WhatsApp template messages to customers based on business events.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { sendTemplate, getWhatsAppConfig } from '../../integrations/whatsapp/whatsapp.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationTrigger =
  | 'job_scheduled'
  | 'technician_assigned'
  | 'technician_on_the_way'
  | 'technician_arrived'
  | 'job_started'
  | 'job_completed'
  | 'invoice_ready'
  | 'payment_received'
  | 'appointment_reminder';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface JobContext {
  id: string;
  title: string;
  description?: string;
  scheduledDate?: Date;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  technician?: {
    id: string;
    name: string;
    phone?: string;
  };
  location?: {
    address: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

// Map triggers to template names
const TRIGGER_TEMPLATE_MAP: Record<NotificationTrigger, string> = {
  job_scheduled: 'trabajo_programado',
  technician_assigned: 'tecnico_asignado',
  technician_on_the_way: 'tecnico_en_camino',
  technician_arrived: 'tecnico_llegado',
  job_started: 'trabajo_iniciado',
  job_completed: 'trabajo_completado',
  invoice_ready: 'factura_lista',
  payment_received: 'pago_recibido',
  appointment_reminder: 'recordatorio_cita',
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send notification based on trigger
 */
export async function sendNotification(
  trigger: NotificationTrigger,
  jobId: string
): Promise<NotificationResult> {
  try {
    // Get job context
    const job = await getJobContext(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    // Check if WhatsApp is configured
    const config = await getWhatsAppConfig(job.organization.id);
    if (!config) {
      log.info('WhatsApp not configured for notification', {
        trigger,
        jobId,
        organizationId: job.organization.id,
      });
      return { success: false, error: 'WhatsApp not configured' };
    }

    // Check if customer has phone
    if (!job.customer.phone) {
      return { success: false, error: 'Customer has no phone number' };
    }

    // Get template name
    const templateName = TRIGGER_TEMPLATE_MAP[trigger];

    // Build template params based on trigger
    const params = buildTemplateParams(trigger, job);

    // Send template message
    const result = await sendTemplate(
      job.organization.id,
      job.customer.phone,
      templateName,
      params
    );

    // Log the notification
    await logNotification(trigger, job, result);

    return result;
  } catch (error) {
    log.error('Error sending notification', {
      trigger,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send job scheduled notification
 */
export async function notifyJobScheduled(jobId: string): Promise<NotificationResult> {
  return sendNotification('job_scheduled', jobId);
}

/**
 * Send technician assigned notification
 */
export async function notifyTechnicianAssigned(jobId: string): Promise<NotificationResult> {
  return sendNotification('technician_assigned', jobId);
}

/**
 * Send technician on the way notification
 */
export async function notifyTechnicianOnTheWay(jobId: string): Promise<NotificationResult> {
  return sendNotification('technician_on_the_way', jobId);
}

/**
 * Send technician arrived notification
 */
export async function notifyTechnicianArrived(jobId: string): Promise<NotificationResult> {
  return sendNotification('technician_arrived', jobId);
}

/**
 * Send job started notification
 */
export async function notifyJobStarted(jobId: string): Promise<NotificationResult> {
  return sendNotification('job_started', jobId);
}

/**
 * Send job completed notification
 */
export async function notifyJobCompleted(jobId: string): Promise<NotificationResult> {
  return sendNotification('job_completed', jobId);
}

/**
 * Send invoice ready notification
 */
export async function notifyInvoiceReady(
  invoiceId: string,
  customerId: string,
  organizationId: string
): Promise<NotificationResult> {
  try {
    const config = await getWhatsAppConfig(organizationId);
    if (!config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer?.phone) {
      return { success: false, error: 'Customer has no phone' };
    }

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    return sendTemplate(organizationId, customer.phone, 'factura_lista', {
      '1': customer.name,
      '2': invoice.invoiceNumber || invoiceId,
      '3': String(invoice.total),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send payment received notification
 */
export async function notifyPaymentReceived(
  paymentId: string,
  customerId: string,
  organizationId: string
): Promise<NotificationResult> {
  try {
    const config = await getWhatsAppConfig(organizationId);
    if (!config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer?.phone) {
      return { success: false, error: 'Customer has no phone' };
    }

    const payment = await db.payment.findFirst({
      where: { id: paymentId, organizationId },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    return sendTemplate(organizationId, customer.phone, 'pago_recibido', {
      '1': customer.name,
      '2': String(payment.amount),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send appointment reminder (typically called by scheduler)
 */
export async function sendAppointmentReminder(jobId: string): Promise<NotificationResult> {
  return sendNotification('appointment_reminder', jobId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send reminders for tomorrow's appointments
 */
export async function sendTomorrowsReminders(organizationId: string): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: tomorrow,
        lt: dayAfter,
      },
      status: { in: ['PENDING', 'SCHEDULED'] },
    },
    include: {
      customer: true,
    },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    if (!job.customer?.phone) {
      continue;
    }

    const result = await sendAppointmentReminder(job.id);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`Job ${job.id}: ${result.error}`);
    }

    // Rate limiting - wait 100ms between messages
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log.info('Appointment reminders sent', {
    organizationId,
    sent,
    failed,
    totalJobs: jobs.length,
  });

  return { sent, failed, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get job context for notification
 */
async function getJobContext(jobId: string): Promise<JobContext | null> {
  const job = await db.job.findFirst({
    where: { id: jobId },
    include: {
      customer: true,
      location: true,
      organization: true,
      assignments: {
        include: {
          technician: true,
        },
        where: { status: 'ACCEPTED' },
        take: 1,
      },
    },
  });

  if (!job || !job.customer) {
    return null;
  }

  const assignment = job.assignments[0];

  return {
    id: job.id,
    title: job.title,
    description: job.description || undefined,
    scheduledDate: job.scheduledDate || undefined,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone || '',
    },
    technician: assignment?.technician
      ? {
          id: assignment.technician.id,
          name: assignment.technician.name,
          phone: assignment.technician.phone || undefined,
        }
      : undefined,
    location: job.location
      ? {
          address: job.location.address || '',
        }
      : undefined,
    organization: {
      id: job.organization.id,
      name: job.organization.name,
    },
  };
}

/**
 * Build template params based on trigger and job context
 */
function buildTemplateParams(
  trigger: NotificationTrigger,
  job: JobContext
): Record<string, string> {
  const formatDate = (date?: Date) => {
    if (!date) return 'A confirmar';
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  switch (trigger) {
    case 'job_scheduled':
      return {
        '1': job.customer.name,
        '2': job.title,
        '3': formatDate(job.scheduledDate),
        '4': formatTime(job.scheduledDate),
      };

    case 'technician_assigned':
      return {
        '1': job.customer.name,
        '2': job.technician?.name || 'Un tecnico',
        '3': job.title,
        '4': formatDate(job.scheduledDate),
      };

    case 'technician_on_the_way':
      return {
        '1': job.customer.name,
        '2': job.technician?.name || 'El tecnico',
        '3': '15-20', // Estimated time - could be calculated from tracking
      };

    case 'technician_arrived':
      return {
        '1': job.customer.name,
        '2': job.technician?.name || 'El tecnico',
        '3': job.title,
      };

    case 'job_started':
      return {
        '1': job.customer.name,
        '2': job.title,
      };

    case 'job_completed':
      return {
        '1': job.customer.name,
        '2': job.title,
        '3': job.organization.name,
      };

    case 'appointment_reminder':
      return {
        '1': job.customer.name,
        '2': job.title,
        '3': formatDate(job.scheduledDate),
        '4': formatTime(job.scheduledDate),
        '5': job.location?.address || 'Direccion a confirmar',
      };

    default:
      return {
        '1': job.customer.name,
      };
  }
}

/**
 * Log notification for audit
 */
async function logNotification(
  trigger: NotificationTrigger,
  job: JobContext,
  result: NotificationResult
): Promise<void> {
  log.info('WhatsApp notification', {
    trigger,
    jobId: job.id,
    customerId: job.customer.id,
    customerPhone: job.customer.phone,
    organizationId: job.organization.id,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  sendNotification,
  notifyJobScheduled,
  notifyTechnicianAssigned,
  notifyTechnicianOnTheWay,
  notifyTechnicianArrived,
  notifyJobStarted,
  notifyJobCompleted,
  notifyInvoiceReady,
  notifyPaymentReceived,
  sendAppointmentReminder,
  sendTomorrowsReminders,
};
