/**
 * Reminder Worker
 * ===============
 *
 * Phase 9.6: Notification Preferences System
 * Processes scheduled job reminders and sends notifications.
 */

import { Job, Worker } from 'bullmq';
import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import { sendNotification } from '../../modules/notifications/notification.service';
import { markReminderSent } from '../../modules/notifications/reminders/reminder-scheduler';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ReminderJobData {
  type: 'job_reminder';
  reminderId: string;
  jobId: string;
  userId: string;
  organizationId: string;
  reminderType: 'customer' | 'technician';
  intervalMinutes: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════════════════════════════

const QUEUE_NAME = 'reminder';

export async function startReminderWorker(): Promise<Worker> {
  const connection = await getRedisConnection();

  const worker = new Worker<ReminderJobData>(
    QUEUE_NAME,
    async (job: Job<ReminderJobData>) => {
      const { reminderId, jobId, userId, organizationId, reminderType, intervalMinutes } = job.data;

      log.info('Processing reminder', { reminderId, jobId, reminderType });

      try {
        // Check capability system first
        const capabilityService = getCapabilityService();
        const notificationQueueEnabled = await capabilityService.ensure('services.notification_queue' as CapabilityPath, organizationId);
        const schedulingEnabled = await capabilityService.ensure('domain.scheduling' as CapabilityPath, organizationId);

        if (!notificationQueueEnabled || !schedulingEnabled) {
          log.warn('Notification/Scheduling capability disabled, skipping reminder', {
            reminderId,
            notificationQueueEnabled,
            schedulingEnabled,
          });
          return { success: false, error: 'Capability disabled' };
        }

        // Verify reminder still pending
        const reminder = await db.scheduledReminder.findUnique({
          where: { id: reminderId },
        });

        if (!reminder || reminder.status !== 'pending') {
          log.debug('Reminder already processed or cancelled', { reminderId });
          return { success: true, skipped: true };
        }

        // Get job details
        const jobRecord = await db.job.findUnique({
          where: { id: jobId },
          include: {
            customer: true,
            technician: true,
            organization: true,
          },
        });

        if (!jobRecord) {
          log.warn('Job not found for reminder', { jobId, reminderId });
          await markReminderSent(reminderId);
          return { success: false, error: 'Job not found' };
        }

        // Check if job is still scheduled (not completed/cancelled)
        if (['COMPLETED', 'CANCELLED'].includes(jobRecord.status)) {
          log.debug('Job already completed/cancelled', { jobId, status: jobRecord.status });
          await markReminderSent(reminderId);
          return { success: true, skipped: true };
        }

        // Build notification content
        const { title, body } = buildReminderContent(jobRecord, reminderType, intervalMinutes);

        // Send notification
        await sendNotification({
          eventType: 'job_reminder',
          userId,
          organizationId,
          title,
          body,
          entityType: 'job',
          entityId: jobId,
          data: {
            jobId,
            reminderType,
            intervalMinutes,
            scheduledDate: jobRecord.scheduledDate?.toISOString(),
          },
        });

        // Mark as sent
        await markReminderSent(reminderId);

        log.info('Reminder sent successfully', {
          reminderId,
          jobId,
          userId,
          reminderType,
        });

        return { success: true };
      } catch (error) {
        log.error('Reminder processing failed', {
          reminderId,
          jobId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    log.debug('Reminder job completed', { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    log.error('Reminder job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  log.info('Reminder worker started');
  return worker;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildReminderContent(
  job: any,
  reminderType: 'customer' | 'technician',
  intervalMinutes: number
): { title: string; body: string } {
  const timeLabel = formatIntervalLabel(intervalMinutes);
  const scheduledTime = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const scheduledDateStr = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  if (reminderType === 'customer') {
    return {
      title: `Recordatorio: Visita en ${timeLabel}`,
      body: `Tu visita de ${job.serviceType || 'servicio'} está programada para ${scheduledDateStr} a las ${scheduledTime}. Dirección: ${job.address || 'A confirmar'}`,
    };
  }

  // Technician reminder
  return {
    title: `Trabajo en ${timeLabel}`,
    body: `Tenés un trabajo programado: ${job.serviceType || 'Servicio'} - ${job.customer?.name || 'Cliente'}. ${scheduledDateStr} ${scheduledTime}. Dirección: ${job.address || 'Ver detalles'}`,
  };
}

function formatIntervalLabel(minutes: number): string {
  if (minutes >= 1440) {
    const hours = Math.round(minutes / 60);
    return hours === 24 ? '24 horas' : `${hours} horas`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  return `${minutes} minutos`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB FOR MISSED REMINDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process any reminders that might have been missed
 * Run this periodically (e.g., every 5 minutes)
 */
export async function processMissedReminders(): Promise<number> {
  const { getDueReminders } = await import('../../modules/notifications/reminders/reminder-scheduler');

  const dueReminders = await getDueReminders(50);
  let processed = 0;

  for (const reminder of dueReminders) {
    try {
      // Re-queue the reminder for immediate processing
      const { QueueManager } = await import('../../lib/queue/queue-manager');
      await QueueManager.getInstance().addToQueue('REMINDER', {
        type: 'job_reminder',
        reminderId: reminder.id,
        jobId: reminder.jobId,
        userId: reminder.userId,
        organizationId: reminder.organizationId,
        reminderType: reminder.reminderType as 'customer' | 'technician',
        intervalMinutes: reminder.intervalMinutes,
      });
      processed++;
    } catch (error) {
      log.error('Failed to requeue missed reminder', {
        reminderId: reminder.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  if (processed > 0) {
    log.info('Processed missed reminders', { count: processed });
  }

  return processed;
}
