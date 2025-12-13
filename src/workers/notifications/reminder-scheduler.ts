/**
 * Reminder Scheduler Worker
 * =========================
 *
 * Phase 9.6: Notification Preferences System
 * Schedules and processes job reminders based on user preferences.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { sendNotification, getUserPreferences } from '../../modules/notifications/notification.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ScheduledReminder {
  id: string;
  jobId: string;
  userId: string;
  organizationId: string;
  reminderType: string;
  scheduledFor: Date;
}

interface JobWithDetails {
  id: string;
  description: string | null;
  scheduledDate: Date | null;
  customer: {
    name: string;
  } | null;
  technician: {
    id: string;
    name: string;
  } | null;
  organization: {
    id: string;
    businessName: string | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schedule reminders for a job based on technician preferences
 */
export async function scheduleJobReminders(jobId: string): Promise<void> {
  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: {
        technician: { select: { id: true, name: true } },
        organization: { select: { id: true, businessName: true } },
      },
    });

    if (!job || !job.technicianId || !job.scheduledDate) {
      log.debug('Job not eligible for reminders', { jobId });
      return;
    }

    // Get technician's reminder preferences
    const preferences = await getUserPreferences(job.technicianId);
    const intervals = preferences.reminderIntervals || [1440, 60, 30]; // Default: 24h, 1h, 30min

    // Cancel any existing reminders for this job
    await cancelJobReminders(jobId);

    const scheduledAt = new Date(job.scheduledDate);
    const now = new Date();

    // Schedule reminders for each interval
    for (const minutesBefore of intervals) {
      const reminderTime = new Date(scheduledAt.getTime() - minutesBefore * 60 * 1000);

      // Only schedule if reminder time is in the future
      if (reminderTime > now) {
        await db.scheduledReminder.create({
          data: {
            organizationId: job.organizationId,
            jobId: job.id,
            userId: job.technicianId,
            reminderType: getReminderType(minutesBefore),
            scheduledFor: reminderTime,
            status: 'pending',
          },
        });

        log.debug('Scheduled reminder', {
          jobId,
          userId: job.technicianId,
          reminderType: getReminderType(minutesBefore),
          scheduledFor: reminderTime,
        });
      }
    }

    log.info('Job reminders scheduled', { jobId, intervals });
  } catch (error) {
    log.error('Error scheduling job reminders', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Cancel all pending reminders for a job
 */
export async function cancelJobReminders(jobId: string): Promise<void> {
  await db.scheduledReminder.updateMany({
    where: { jobId, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

/**
 * Process due reminders
 * Called periodically by a cron job or scheduler
 */
export async function processDueReminders(): Promise<number> {
  const now = new Date();
  let processedCount = 0;

  try {
    // Get all due reminders
    const dueReminders = await db.scheduledReminder.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: now },
      },
      take: 100, // Process in batches
    });

    for (const reminder of dueReminders) {
      try {
        await processReminder(reminder);
        processedCount++;
      } catch (error) {
        log.error('Error processing reminder', {
          reminderId: reminder.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    if (processedCount > 0) {
      log.info('Processed due reminders', { count: processedCount });
    }

    return processedCount;
  } catch (error) {
    log.error('Error in processDueReminders', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

/**
 * Process a single reminder
 */
async function processReminder(reminder: ScheduledReminder): Promise<void> {
  // Get job details
  const job = await db.job.findUnique({
    where: { id: reminder.jobId },
    include: {
      customer: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      organization: { select: { id: true, businessName: true } },
    },
  });

  if (!job || job.status !== 'scheduled') {
    // Job no longer needs reminder (completed, cancelled, etc.)
    await db.scheduledReminder.update({
      where: { id: reminder.id },
      data: { status: 'cancelled' },
    });
    return;
  }

  // Determine template based on reminder type
  const templateName = getTemplateForReminder(reminder.reminderType);
  const timeDescription = getTimeDescription(reminder.reminderType);

  // Send notification
  await sendNotification({
    eventType: 'job_reminder',
    userId: reminder.userId,
    organizationId: reminder.organizationId,
    title: `Recordatorio: Trabajo en ${timeDescription}`,
    body: `Tenés un trabajo programado ${timeDescription}: ${job.description || 'Sin descripción'} - ${job.customer?.name || 'Cliente'}`,
    entityType: 'job',
    entityId: job.id,
    templateName,
    templateParams: {
      '1': job.assignedTo?.name || 'Técnico',
      '2': job.customer?.name || 'Cliente',
      '3': job.description || 'Servicio técnico',
      '4': formatJobTime(job.scheduledAt),
    },
  });

  // Mark reminder as sent
  await db.scheduledReminder.update({
    where: { id: reminder.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getReminderType(minutesBefore: number): string {
  if (minutesBefore >= 1440) return '24h';
  if (minutesBefore >= 60) return '1h';
  if (minutesBefore >= 30) return '30min';
  return `${minutesBefore}min`;
}

function getTemplateForReminder(reminderType: string): string {
  switch (reminderType) {
    case '24h':
      return 'job_reminder_tech_24h';
    case '1h':
      return 'job_reminder_tech_1h';
    case '30min':
      return 'job_reminder_tech_30m';
    default:
      return 'job_reminder_tech_1h';
  }
}

function getTimeDescription(reminderType: string): string {
  switch (reminderType) {
    case '24h':
      return 'mañana';
    case '1h':
      return '1 hora';
    case '30min':
      return '30 minutos';
    default:
      return 'pronto';
  }
}

function formatJobTime(scheduledAt: Date | null): string {
  if (!scheduledAt) return 'Hora no definida';

  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(scheduledAt);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the reminder scheduler worker
 * Runs every minute to check for due reminders
 */
export async function startReminderWorker(): Promise<void> {
  log.info('Starting reminder scheduler worker');

  const POLL_INTERVAL = 60 * 1000; // 1 minute

  const runCycle = async () => {
    try {
      await processDueReminders();
    } catch (error) {
      log.error('Reminder worker cycle error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  };

  // Initial run
  await runCycle();

  // Schedule periodic runs
  setInterval(runCycle, POLL_INTERVAL);
}

/**
 * Cleanup old completed reminders (run daily)
 */
export async function cleanupOldReminders(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await db.scheduledReminder.deleteMany({
    where: {
      status: { in: ['sent', 'cancelled'] },
      scheduledFor: { lt: cutoffDate },
    },
  });

  log.info('Cleaned up old reminders', { deleted: result.count });
  return result.count;
}
