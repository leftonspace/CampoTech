/**
 * Reminder Scheduler Service
 * ==========================
 *
 * Phase 9.6: Notification Preferences System
 * Schedules job reminders based on user preferences and job schedules.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { QueueManager } from '../../../lib/queue/queue-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReminderConfig {
  jobId: string;
  userId: string;
  organizationId: string;
  scheduledAt: Date;
  reminderType: 'customer' | 'technician';
  intervals: number[]; // Minutes before job (e.g., [1440, 60, 30] = 24h, 1h, 30min)
}

export interface ScheduledReminder {
  id: string;
  jobId: string;
  userId: string;
  organizationId: string;
  reminderType: string;
  scheduledFor: Date;
  intervalMinutes: number;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT INTERVALS (Argentine business context)
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_REMINDER_INTERVALS = {
  customer: [1440, 60], // 24h and 1h before for customers
  technician: [60, 30, 15], // 1h, 30min, 15min before for technicians
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schedule reminders for a job
 */
export async function scheduleJobReminders(config: ReminderConfig): Promise<ScheduledReminder[]> {
  const { jobId, userId, organizationId, scheduledAt, reminderType, intervals } = config;
  const scheduledReminders: ScheduledReminder[] = [];

  try {
    // Get user's notification preferences for custom intervals
    const prefs = await db.notificationPreferences.findUnique({
      where: { userId },
    });

    const effectiveIntervals = prefs?.reminderIntervals as number[] || intervals;

    for (const intervalMinutes of effectiveIntervals) {
      const reminderTime = new Date(scheduledAt.getTime() - intervalMinutes * 60 * 1000);

      // Don't schedule reminders in the past
      if (reminderTime <= new Date()) {
        log.debug('Skipping past reminder', { jobId, intervalMinutes });
        continue;
      }

      // Check if reminder already exists
      const existing = await db.scheduledReminder.findFirst({
        where: {
          jobId,
          userId,
          intervalMinutes,
          status: 'pending',
        },
      });

      if (existing) {
        log.debug('Reminder already scheduled', { jobId, intervalMinutes });
        continue;
      }

      // Create scheduled reminder record
      const reminder = await db.scheduledReminder.create({
        data: {
          jobId,
          userId,
          organizationId,
          reminderType,
          scheduledFor: reminderTime,
          intervalMinutes,
          status: 'pending',
        },
      });

      // Queue the reminder job
      const delay = reminderTime.getTime() - Date.now();
      await QueueManager.getInstance().addToQueue('REMINDER', {
        type: 'job_reminder',
        reminderId: reminder.id,
        jobId,
        userId,
        organizationId,
        reminderType,
        intervalMinutes,
      }, {
        delay,
        jobId: `reminder-${reminder.id}`,
      });

      scheduledReminders.push({
        id: reminder.id,
        jobId: reminder.jobId,
        userId: reminder.userId,
        organizationId: reminder.organizationId,
        reminderType: reminder.reminderType,
        scheduledFor: reminder.scheduledFor,
        intervalMinutes: reminder.intervalMinutes,
        status: reminder.status as 'pending' | 'sent' | 'cancelled',
        createdAt: reminder.createdAt,
      });

      log.info('Scheduled reminder', {
        jobId,
        userId,
        reminderType,
        intervalMinutes,
        scheduledFor: reminderTime.toISOString(),
      });
    }

    return scheduledReminders;
  } catch (error) {
    log.error('Failed to schedule reminders', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Cancel all pending reminders for a job
 */
export async function cancelJobReminders(jobId: string): Promise<number> {
  try {
    const result = await db.scheduledReminder.updateMany({
      where: {
        jobId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
      },
    });

    // Remove from queue
    const queue = QueueManager.getInstance();
    const pendingReminders = await db.scheduledReminder.findMany({
      where: { jobId, status: 'cancelled' },
    });

    for (const reminder of pendingReminders) {
      try {
        await queue.removeFromQueue('REMINDER', `reminder-${reminder.id}`);
      } catch {
        // Job might already be processed
      }
    }

    log.info('Cancelled job reminders', { jobId, count: result.count });
    return result.count;
  } catch (error) {
    log.error('Failed to cancel reminders', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Reschedule reminders when job time changes
 */
export async function rescheduleJobReminders(
  jobId: string,
  newScheduledAt: Date
): Promise<ScheduledReminder[]> {
  // Cancel existing reminders
  await cancelJobReminders(jobId);

  // Get job details
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      technician: true,
      customer: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const reminders: ScheduledReminder[] = [];

  // Schedule technician reminders
  if (job.technicianId) {
    const techReminders = await scheduleJobReminders({
      jobId,
      userId: job.technicianId,
      organizationId: job.organizationId,
      scheduledAt: newScheduledAt,
      reminderType: 'technician',
      intervals: DEFAULT_REMINDER_INTERVALS.technician,
    });
    reminders.push(...techReminders);
  }

  // Schedule customer reminders (if customer has user account)
  if (job.customer?.userId) {
    const customerReminders = await scheduleJobReminders({
      jobId,
      userId: job.customer.userId,
      organizationId: job.organizationId,
      scheduledAt: newScheduledAt,
      reminderType: 'customer',
      intervals: DEFAULT_REMINDER_INTERVALS.customer,
    });
    reminders.push(...customerReminders);
  }

  return reminders;
}

/**
 * Get pending reminders for a user
 */
export async function getUserPendingReminders(userId: string): Promise<ScheduledReminder[]> {
  const reminders = await db.scheduledReminder.findMany({
    where: {
      userId,
      status: 'pending',
      scheduledFor: { gte: new Date() },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  return reminders.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    userId: r.userId,
    organizationId: r.organizationId,
    reminderType: r.reminderType,
    scheduledFor: r.scheduledFor,
    intervalMinutes: r.intervalMinutes,
    status: r.status as 'pending' | 'sent' | 'cancelled',
    createdAt: r.createdAt,
  }));
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(reminderId: string): Promise<void> {
  await db.scheduledReminder.update({
    where: { id: reminderId },
    data: {
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Get reminders due for processing
 */
export async function getDueReminders(limit: number = 100): Promise<ScheduledReminder[]> {
  const reminders = await db.scheduledReminder.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
  });

  return reminders.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    userId: r.userId,
    organizationId: r.organizationId,
    reminderType: r.reminderType,
    scheduledFor: r.scheduledFor,
    intervalMinutes: r.intervalMinutes,
    status: r.status as 'pending' | 'sent' | 'cancelled',
    createdAt: r.createdAt,
  }));
}
