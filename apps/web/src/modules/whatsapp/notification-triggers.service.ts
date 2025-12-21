/**
 * WhatsApp Notification Triggers Service
 *
 * Triggers WhatsApp notifications on various job events.
 * Uses the organization's configured WhatsApp number (personal or BSP).
 */

import { prisma } from '@/lib/prisma';
import { dispatch } from '@/lib/queue';
import {
  generateWhatsAppLink,
  WhatsAppMessageTemplates,
} from '@/lib/whatsapp-links';
import { formatDate } from '@/lib/utils';

type JobStatus = 'PENDING' | 'SCHEDULED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface NotificationOptions {
  technicianId?: string;
  customerId?: string;
}

/**
 * Get the WhatsApp configuration for an organization
 */
async function getOrgWhatsAppConfig(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappIntegrationType: true,
      whatsappPersonalNumber: true,
      whatsappPhoneNumberId: true,
      whatsappAccessToken: true,
      name: true,
    },
  });

  if (!org) return null;

  // Check if WhatsApp is configured
  const hasBspApi = !!(org.whatsappPhoneNumberId && org.whatsappAccessToken);
  const hasPersonalNumber = !!org.whatsappPersonalNumber;

  return {
    integrationType: org.whatsappIntegrationType,
    personalNumber: org.whatsappPersonalNumber,
    hasBspApi,
    hasPersonalNumber,
    canSendMessages: hasBspApi, // Only BSP can send messages programmatically
    businessName: org.name,
  };
}

/**
 * Get job details with customer and technician info
 */
async function getJobDetails(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappIntegrationType: true,
          whatsappPersonalNumber: true,
          whatsappPhoneNumberId: true,
          whatsappAccessToken: true,
        },
      },
      technician: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      assignments: {
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Triggered when a job status changes
 * Sends appropriate WhatsApp notification to customer/technician
 */
export async function onJobStatusChange(
  jobId: string,
  oldStatus: JobStatus,
  newStatus: JobStatus,
  options: NotificationOptions = {}
): Promise<void> {
  console.log(`[WhatsApp] Job ${jobId} status changed: ${oldStatus} -> ${newStatus}`, options);

  try {
    const job = await getJobDetails(jobId);
    if (!job || !job.organization) {
      console.log(`[WhatsApp] Job ${jobId} not found or no organization`);
      return;
    }

    const hasBspApi = !!(job.organization.whatsappPhoneNumberId && job.organization.whatsappAccessToken);
    const customerPhone = job.customer?.phone;
    const customerName = job.customer?.name || 'Cliente';
    const jobNumber = job.jobNumber || `#${job.id.slice(0, 8)}`;
    const scheduledDate = job.scheduledDate ? formatDate(job.scheduledDate) : undefined;

    // Only send automated messages if BSP API is configured
    if (!hasBspApi) {
      // Log the message that would be sent (for debugging/future implementation)
      console.log(`[WhatsApp] BSP not configured - notification logged only`);
      return;
    }

    if (!customerPhone) {
      console.log(`[WhatsApp] No customer phone for job ${jobId}`);
      return;
    }

    let message: string | undefined;

    switch (newStatus) {
      case 'ASSIGNED': {
        // Job has been assigned to a technician
        const technicianName = job.technician?.name ||
          job.assignments?.[0]?.technician?.name ||
          'un técnico';
        const timeSlot = job.scheduledTimeStart && job.scheduledTimeEnd
          ? `${job.scheduledTimeStart} - ${job.scheduledTimeEnd}`
          : job.scheduledTimeStart || 'horario a confirmar';

        message = `Hola ${customerName}, su turno ${jobNumber} ha sido confirmado para el ${scheduledDate || 'próximamente'} (${timeSlot}). ${technicianName} lo/la atenderá. ¡Gracias por confiar en ${job.organization.name}!`;
        break;
      }

      case 'EN_ROUTE': {
        // Technician is on the way
        const technicianName = job.technician?.name ||
          job.assignments?.[0]?.technician?.name ||
          'Nuestro técnico';

        message = WhatsAppMessageTemplates.job.onTheWay(
          technicianName,
          '30-45 minutos' // Could be calculated based on location
        );
        break;
      }

      case 'COMPLETED': {
        // Job is completed - send thank you message
        message = WhatsAppMessageTemplates.job.completed(jobNumber);

        // Add rating link if available
        const review = await prisma.review.findFirst({
          where: { jobId },
          select: { token: true },
        });

        if (review?.token) {
          const ratingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.campo.tech'}/rate/${review.token}`;
          message += `\n\n¿Cómo fue tu experiencia? Dejanos tu opinión: ${ratingUrl}`;
        }
        break;
      }

      case 'CANCELLED': {
        message = `Hola ${customerName}, lamentablemente el turno ${jobNumber} ${scheduledDate ? `del ${scheduledDate}` : ''} ha sido cancelado. Por favor contáctenos para reprogramar. Disculpe las molestias.`;
        break;
      }

      default:
        // No message for other status changes
        return;
    }

    if (message) {
      // Queue the WhatsApp message for sending
      await dispatch(
        'whatsapp.send',
        {
          to: customerPhone,
          message,
          organizationId: job.organizationId,
        },
        { priority: 'high' }
      );

      console.log(`[WhatsApp] Queued ${newStatus} notification for job ${jobId}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Error sending notification for job ${jobId}:`, error);
    // Don't throw - notifications failing shouldn't fail the main operation
  }
}

/**
 * Triggered when a new job is assigned
 */
export async function onJobAssigned(
  jobId: string,
  technicianId: string
): Promise<void> {
  console.log(`[WhatsApp] Job ${jobId} assigned to technician ${technicianId}`);

  try {
    const job = await getJobDetails(jobId);
    if (!job || !job.organization) return;

    const hasBspApi = !!(job.organization.whatsappPhoneNumberId && job.organization.whatsappAccessToken);
    if (!hasBspApi) return;

    // Notify technician about new assignment
    const technician = job.technician || job.assignments?.find((a: { technicianId: string }) => a.technicianId === technicianId)?.technician;
    if (technician?.phone) {
      const customerName = job.customer?.name || 'Cliente';
      const scheduledDate = job.scheduledDate ? formatDate(job.scheduledDate) : 'fecha a confirmar';
      const address = job.address || job.customer?.address || 'dirección a confirmar';
      const timeSlot = job.scheduledTimeStart || 'horario a confirmar';

      const message = `Hola ${technician.name}, te asignaron un nuevo trabajo:\n\n` +
        `Cliente: ${customerName}\n` +
        `Fecha: ${scheduledDate}\n` +
        `Hora: ${timeSlot}\n` +
        `Dirección: ${typeof address === 'string' ? address : JSON.stringify(address)}\n` +
        `Servicio: ${job.serviceType || 'Ver detalles en la app'}`;

      await dispatch(
        'whatsapp.send',
        {
          to: technician.phone,
          message,
          organizationId: job.organizationId,
        },
        { priority: 'normal' }
      );

      console.log(`[WhatsApp] Queued assignment notification for technician ${technicianId}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Error sending assignment notification:`, error);
  }
}

/**
 * Triggered when a job is created
 */
export async function onJobCreated(jobId: string): Promise<void> {
  console.log(`[WhatsApp] Job ${jobId} created`);
  // For now, we don't send automatic notifications on job creation
  // This could be enabled in the future for customer confirmation
}

/**
 * Send a job confirmation message via wa.me link (for manual sending)
 * Returns the wa.me link that the user can click to send the message
 */
export function getJobConfirmationWhatsAppLink(
  customerPhone: string,
  customerName: string,
  jobNumber: string,
  scheduledDate: string,
  businessName: string
): string {
  const message = `Hola ${customerName}, confirmamos su turno ${jobNumber} para el ${scheduledDate}. Gracias por confiar en ${businessName}.`;
  return generateWhatsAppLink(customerPhone, message);
}

/**
 * Send a job reminder message via wa.me link (for manual sending)
 */
export function getJobReminderWhatsAppLink(
  customerPhone: string,
  customerName: string,
  jobNumber: string,
  scheduledDate: string
): string {
  const message = WhatsAppMessageTemplates.job.reminder(jobNumber, scheduledDate);
  return generateWhatsAppLink(customerPhone, message);
}
