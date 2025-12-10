/**
 * Notification Dispatch Worker
 * ============================
 *
 * Unified BullMQ worker for dispatching notifications across all channels.
 * Routes notifications to appropriate delivery mechanisms (WhatsApp, SMS, Push, Email).
 */

import { Worker, Queue, Job } from 'bullmq';
import { getRedis } from '../../lib/redis/redis-manager';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';
import { getFairScheduler, createFairProcessor } from '../../../core/queue/fair-scheduler';
import { log } from '../../lib/logging/logger';
import { prisma } from '../../lib/prisma';
import { publishEvent } from '../../lib/events';

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUEUE_NAME = 'notification-dispatch';

const WORKER_CONFIG = {
  concurrency: 20,
  limiter: {
    max: 200, // Max 200 notifications per minute
    duration: 60000,
  },
};

const JOB_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 12 * 60 * 60, // 12 hours
    count: 10000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type NotificationChannel = 'whatsapp' | 'sms' | 'push' | 'email' | 'in_app';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface NotificationDispatchJobData {
  /** Notification type/event */
  type: string;
  /** Target user ID */
  userId?: string;
  /** Target phone number (for WhatsApp/SMS) */
  phone?: string;
  /** Target email address */
  email?: string;
  /** Organization ID */
  orgId: string;
  /** Notification content */
  content: {
    title: string;
    body: string;
    /** Optional template ID */
    templateId?: string;
    /** Template variables */
    variables?: Record<string, string>;
    /** Rich content (for push/email) */
    data?: Record<string, any>;
  };
  /** Preferred channels (in order of preference) */
  channels: NotificationChannel[];
  /** Priority level */
  priority: NotificationPriority;
  /** Related entity */
  entity?: {
    type: string;
    id: string;
  };
  /** Idempotency key */
  idempotencyKey?: string;
  /** Schedule for later */
  scheduledFor?: string;
}

export interface NotificationDispatchJobResult {
  success: boolean;
  deliveredVia: NotificationChannel[];
  failedChannels: NotificationChannel[];
  messageIds: Record<string, string>;
  error?: string;
  processedAt: Date;
}

// =============================================================================
// QUEUE
// =============================================================================

let dispatchQueue: Queue<NotificationDispatchJobData, NotificationDispatchJobResult> | null = null;

export function getNotificationDispatchQueue(): Queue<NotificationDispatchJobData, NotificationDispatchJobResult> {
  if (!dispatchQueue) {
    dispatchQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: JOB_CONFIG,
    });
  }
  return dispatchQueue;
}

/**
 * Queue a notification for dispatch
 */
export async function queueNotification(
  data: NotificationDispatchJobData
): Promise<Job<NotificationDispatchJobData, NotificationDispatchJobResult>> {
  const queue = getNotificationDispatchQueue();

  // Generate idempotency key if not provided
  const idempotencyKey = data.idempotencyKey || `notif:${data.type}:${data.userId || data.phone}:${Date.now()}`;

  // Map priority to BullMQ priority (lower number = higher priority)
  const priorityMap: Record<NotificationPriority, number> = {
    critical: 1,
    high: 2,
    normal: 5,
    low: 10,
  };

  const opts: any = {
    jobId: idempotencyKey,
    priority: priorityMap[data.priority],
  };

  // Handle scheduled notifications
  if (data.scheduledFor) {
    const delay = new Date(data.scheduledFor).getTime() - Date.now();
    if (delay > 0) {
      opts.delay = delay;
    }
  }

  return queue.add(`dispatch-${data.type}`, data, opts);
}

/**
 * Queue multiple notifications in bulk
 */
export async function queueBulkNotifications(
  notifications: NotificationDispatchJobData[]
): Promise<Job<NotificationDispatchJobData, NotificationDispatchJobResult>[]> {
  const queue = getNotificationDispatchQueue();

  const priorityMap: Record<NotificationPriority, number> = {
    critical: 1,
    high: 2,
    normal: 5,
    low: 10,
  };

  const bulkJobs = notifications.map((data) => {
    const idempotencyKey = data.idempotencyKey || `notif:${data.type}:${data.userId || data.phone}:${Date.now()}`;

    return {
      name: `dispatch-${data.type}`,
      data,
      opts: {
        jobId: idempotencyKey,
        priority: priorityMap[data.priority],
      },
    };
  });

  return queue.addBulk(bulkJobs);
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getNotificationDispatchQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// =============================================================================
// WORKER
// =============================================================================

let dispatchWorker: Worker<NotificationDispatchJobData, NotificationDispatchJobResult> | null = null;

export function startNotificationDispatchWorker(): Worker<NotificationDispatchJobData, NotificationDispatchJobResult> {
  if (dispatchWorker) {
    return dispatchWorker;
  }

  const scheduler = getFairScheduler();

  dispatchWorker = new Worker<NotificationDispatchJobData, NotificationDispatchJobResult>(
    QUEUE_NAME,
    createFairProcessor(scheduler, async (job) => {
      const { type, userId, phone, email, orgId, content, channels, priority, entity } = job.data;

      log.info('Processing notification dispatch', {
        jobId: job.id,
        type,
        userId,
        channels,
        priority,
        orgId,
      });

      try {
        // Check capability system
        const capabilityService = getCapabilityService();
        const notificationsEnabled = await capabilityService.ensure(
          'services.notification_queue' as CapabilityPath,
          orgId
        );

        if (!notificationsEnabled) {
          log.warn('Notification queue capability disabled', { type, orgId });
          return {
            success: false,
            deliveredVia: [],
            failedChannels: channels,
            messageIds: {},
            error: 'Notification capability is disabled',
            processedAt: new Date(),
          };
        }

        const deliveredVia: NotificationChannel[] = [];
        const failedChannels: NotificationChannel[] = [];
        const messageIds: Record<string, string> = {};

        // Try each channel in order until one succeeds (or all fail for critical)
        for (const channel of channels) {
          try {
            const result = await deliverToChannel(channel, job.data, capabilityService);

            if (result.success) {
              deliveredVia.push(channel);
              if (result.messageId) {
                messageIds[channel] = result.messageId;
              }

              // For non-critical, stop after first success
              if (priority !== 'critical') {
                break;
              }
            } else {
              failedChannels.push(channel);
            }
          } catch (error) {
            log.warn(`Channel ${channel} failed`, {
              type,
              error: error instanceof Error ? error.message : 'Unknown',
            });
            failedChannels.push(channel);
          }
        }

        // Log delivery result
        await prisma.notificationLog?.create?.({
          data: {
            type,
            userId,
            organizationId: orgId,
            channels: deliveredVia,
            success: deliveredVia.length > 0,
            entityType: entity?.type,
            entityId: entity?.id,
            content: content as any,
            messageIds,
          },
        }).catch(() => {});

        const success = deliveredVia.length > 0;

        log.info('Notification dispatch completed', {
          type,
          success,
          deliveredVia,
          failedChannels,
        });

        return {
          success,
          deliveredVia,
          failedChannels,
          messageIds,
          error: !success ? 'All channels failed' : undefined,
          processedAt: new Date(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        log.error('Notification dispatch failed', {
          type,
          error: errorMessage,
          attempt: job.attemptsMade + 1,
        });

        throw error;
      }
    }),
    {
      connection: getRedis(),
      concurrency: WORKER_CONFIG.concurrency,
      limiter: WORKER_CONFIG.limiter,
    }
  );

  // Event handlers
  dispatchWorker.on('completed', async (job, result) => {
    log.debug('Notification dispatch completed', {
      jobId: job.id,
      deliveredVia: result.deliveredVia,
    });

    await publishEvent('queue.notification_dispatch.completed', {
      jobId: job.id,
      type: job.data.type,
      orgId: job.data.orgId,
      deliveredVia: result.deliveredVia,
    });
  });

  dispatchWorker.on('failed', async (job, error) => {
    log.error('Notification dispatch failed', {
      jobId: job?.id,
      type: job?.data.type,
      error: error.message,
      attempts: job?.attemptsMade,
    });

    if (job) {
      await publishEvent('queue.notification_dispatch.failed', {
        jobId: job.id,
        type: job.data.type,
        orgId: job.data.orgId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  });

  dispatchWorker.on('error', (error) => {
    log.error('Notification dispatch worker error', { error: error.message });
  });

  log.info('Notification dispatch worker started');

  return dispatchWorker;
}

export function stopNotificationDispatchWorker(): Promise<void> {
  if (dispatchWorker) {
    return dispatchWorker.close();
  }
  return Promise.resolve();
}

// =============================================================================
// CHANNEL DELIVERY
// =============================================================================

interface ChannelDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function deliverToChannel(
  channel: NotificationChannel,
  data: NotificationDispatchJobData,
  capabilityService: any
): Promise<ChannelDeliveryResult> {
  switch (channel) {
    case 'whatsapp':
      return deliverWhatsApp(data, capabilityService);
    case 'sms':
      return deliverSMS(data, capabilityService);
    case 'push':
      return deliverPush(data, capabilityService);
    case 'email':
      return deliverEmail(data, capabilityService);
    case 'in_app':
      return deliverInApp(data);
    default:
      return { success: false, error: `Unknown channel: ${channel}` };
  }
}

async function deliverWhatsApp(
  data: NotificationDispatchJobData,
  capabilityService: any
): Promise<ChannelDeliveryResult> {
  const enabled = await capabilityService.ensure('external.whatsapp' as CapabilityPath, data.orgId);

  if (!enabled) {
    return { success: false, error: 'WhatsApp capability disabled' };
  }

  if (!data.phone) {
    return { success: false, error: 'No phone number provided' };
  }

  try {
    // Import WhatsApp service dynamically
    const { sendWhatsAppMessage } = await import('../../integrations/whatsapp');

    const result = await sendWhatsAppMessage({
      to: data.phone,
      organizationId: data.orgId,
      message: data.content.body,
      templateId: data.content.templateId,
      variables: data.content.variables,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp delivery failed',
    };
  }
}

async function deliverSMS(
  data: NotificationDispatchJobData,
  capabilityService: any
): Promise<ChannelDeliveryResult> {
  // SMS is a fallback for critical notifications
  if (!data.phone) {
    return { success: false, error: 'No phone number provided' };
  }

  try {
    // Import SMS service dynamically (if available)
    const { sendSMS } = await import('../../integrations/sms').catch(() => ({ sendSMS: null }));

    if (!sendSMS) {
      return { success: false, error: 'SMS service not configured' };
    }

    const result = await sendSMS({
      to: data.phone,
      body: `${data.content.title}: ${data.content.body}`,
      organizationId: data.orgId,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS delivery failed',
    };
  }
}

async function deliverPush(
  data: NotificationDispatchJobData,
  capabilityService: any
): Promise<ChannelDeliveryResult> {
  const enabled = await capabilityService.ensure('external.push_notifications' as CapabilityPath, data.orgId);

  if (!enabled) {
    return { success: false, error: 'Push notifications capability disabled' };
  }

  if (!data.userId) {
    return { success: false, error: 'No user ID provided' };
  }

  try {
    // Import push notification service dynamically
    const { sendPushNotification } = await import('../../integrations/push');

    const result = await sendPushNotification({
      userId: data.userId,
      title: data.content.title,
      body: data.content.body,
      data: data.content.data,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push delivery failed',
    };
  }
}

async function deliverEmail(
  data: NotificationDispatchJobData,
  capabilityService: any
): Promise<ChannelDeliveryResult> {
  if (!data.email) {
    return { success: false, error: 'No email address provided' };
  }

  try {
    // Import email service dynamically
    const { sendEmail } = await import('../../integrations/email').catch(() => ({ sendEmail: null }));

    if (!sendEmail) {
      return { success: false, error: 'Email service not configured' };
    }

    const result = await sendEmail({
      to: data.email,
      subject: data.content.title,
      body: data.content.body,
      templateId: data.content.templateId,
      variables: data.content.variables,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email delivery failed',
    };
  }
}

async function deliverInApp(
  data: NotificationDispatchJobData
): Promise<ChannelDeliveryResult> {
  if (!data.userId) {
    return { success: false, error: 'No user ID provided' };
  }

  try {
    // Store in-app notification in database
    const notification = await prisma.notification?.create?.({
      data: {
        userId: data.userId,
        organizationId: data.orgId,
        type: data.type,
        title: data.content.title,
        body: data.content.body,
        data: data.content.data as any,
        entityType: data.entity?.type,
        entityId: data.entity?.id,
        read: false,
      },
    });

    return {
      success: !!notification,
      messageId: notification?.id,
      error: !notification ? 'Failed to create notification' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'In-app delivery failed',
    };
  }
}

// =============================================================================
// MANAGEMENT
// =============================================================================

/**
 * Retry a failed job
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const queue = getNotificationDispatchQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.retry();
}

/**
 * Get failed jobs for review
 */
export async function getFailedJobs(
  start: number = 0,
  end: number = 20
): Promise<Job<NotificationDispatchJobData, NotificationDispatchJobResult>[]> {
  const queue = getNotificationDispatchQueue();
  return queue.getFailed(start, end);
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getNotificationDispatchQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getNotificationDispatchQueue();
  await queue.resume();
}
