/**
 * Job Notification Worker
 * =======================
 *
 * BullMQ-based worker for processing job status notifications.
 * Sends notifications to customers and technicians about job updates.
 */

import { Worker, Queue, Job } from 'bullmq';
import { getRedis } from '../../lib/redis/redis-manager';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';
import { getFairScheduler, createFairProcessor } from '../../../core/queue/fair-scheduler';
import { log } from '../../lib/logging/logger';
import { prisma } from '../../lib/prisma';
import { sendNotification } from '../../modules/notifications/notification.service';
import { publishEvent } from '../../lib/events';

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUEUE_NAME = 'job-notification';

const WORKER_CONFIG = {
  concurrency: 10,
  limiter: {
    max: 100, // Max 100 notifications per minute
    duration: 60000,
  },
};

const JOB_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 5000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type JobNotificationType =
  | 'job_created'
  | 'job_assigned'
  | 'job_scheduled'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'tech_en_route'
  | 'tech_arrived'
  | 'payment_received'
  | 'invoice_ready'
  | 'job_rescheduled';

export interface JobNotificationJobData {
  /** Type of notification */
  type: JobNotificationType;
  /** Job ID */
  jobId: string;
  /** Organization ID */
  orgId: string;
  /** Target recipients */
  recipients: {
    customer?: boolean;
    technician?: boolean;
    owner?: boolean;
  };
  /** Additional data for notification content */
  data?: Record<string, any>;
  /** Priority (1-10, lower = higher priority) */
  priority?: number;
  /** Idempotency key */
  idempotencyKey?: string;
}

export interface JobNotificationJobResult {
  success: boolean;
  notificationsSent: number;
  channels: string[];
  error?: string;
  processedAt: Date;
}

// =============================================================================
// QUEUE
// =============================================================================

let notificationQueue: Queue<JobNotificationJobData, JobNotificationJobResult> | null = null;

export function getJobNotificationQueue(): Queue<JobNotificationJobData, JobNotificationJobResult> {
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: JOB_CONFIG,
    });
  }
  return notificationQueue;
}

/**
 * Add a job notification to the processing queue
 */
export async function queueJobNotification(
  data: JobNotificationJobData
): Promise<Job<JobNotificationJobData, JobNotificationJobResult>> {
  const queue = getJobNotificationQueue();

  // Generate idempotency key if not provided
  const idempotencyKey = data.idempotencyKey || `${data.type}:${data.jobId}:${Date.now()}`;

  return queue.add(`notification-${data.type}`, data, {
    jobId: idempotencyKey,
    priority: data.priority || 5,
  });
}

/**
 * Queue multiple notifications in bulk
 */
export async function queueBulkJobNotifications(
  notifications: JobNotificationJobData[]
): Promise<Job<JobNotificationJobData, JobNotificationJobResult>[]> {
  const queue = getJobNotificationQueue();

  const bulkJobs = notifications.map((data) => ({
    name: `notification-${data.type}`,
    data,
    opts: {
      jobId: data.idempotencyKey || `${data.type}:${data.jobId}:${Date.now()}`,
      priority: data.priority || 5,
    },
  }));

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
  const queue = getJobNotificationQueue();

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

let notificationWorker: Worker<JobNotificationJobData, JobNotificationJobResult> | null = null;

export function startJobNotificationWorker(): Worker<JobNotificationJobData, JobNotificationJobResult> {
  if (notificationWorker) {
    return notificationWorker;
  }

  const scheduler = getFairScheduler();

  notificationWorker = new Worker<JobNotificationJobData, JobNotificationJobResult>(
    QUEUE_NAME,
    createFairProcessor(scheduler, async (job) => {
      const { type, jobId, orgId, recipients, data } = job.data;

      log.info('Processing job notification', {
        jobId: job.id,
        type,
        jobId: jobId,
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
          log.warn('Notification queue capability disabled', { jobId, orgId });
          return {
            success: false,
            notificationsSent: 0,
            channels: [],
            error: 'Notification capability is disabled',
            processedAt: new Date(),
          };
        }

        // Get job details
        const jobRecord = await prisma.job.findUnique({
          where: { id: jobId },
          include: {
            customer: true,
            technician: true,
            organization: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!jobRecord) {
          throw new Error(`Job ${jobId} not found`);
        }

        // Build notification content
        const { title, body } = buildNotificationContent(type, jobRecord, data);

        const sentChannels: string[] = [];
        let notificationsSent = 0;

        // Send to customer
        if (recipients.customer && jobRecord.customer) {
          const customerResult = await sendNotification({
            eventType: type,
            userId: jobRecord.customer.userId || undefined,
            phone: jobRecord.customer.phone,
            organizationId: orgId,
            title,
            body,
            entityType: 'job',
            entityId: jobId,
            data: {
              ...data,
              jobId,
              type,
            },
          });

          if (customerResult.success) {
            notificationsSent++;
            sentChannels.push(...customerResult.channels);
          }
        }

        // Send to technician
        if (recipients.technician && jobRecord.technician) {
          const techResult = await sendNotification({
            eventType: type,
            userId: jobRecord.technician.id,
            organizationId: orgId,
            title,
            body,
            entityType: 'job',
            entityId: jobId,
            data: {
              ...data,
              jobId,
              type,
            },
          });

          if (techResult.success) {
            notificationsSent++;
            sentChannels.push(...techResult.channels);
          }
        }

        // Note: Owner notifications skipped - Organization model doesn't have ownerId
        // To send to owners, query for users with role=OWNER in the organization

        log.info('Job notification processed', {
          type,
          jobId,
          notificationsSent,
          channels: [...new Set(sentChannels)],
        });

        return {
          success: true,
          notificationsSent,
          channels: [...new Set(sentChannels)],
          processedAt: new Date(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        log.error('Job notification processing failed', {
          type,
          jobId,
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
  notificationWorker.on('completed', async (job, result) => {
    log.debug('Job notification job completed', {
      jobId: job.id,
      notificationsSent: result.notificationsSent,
    });

    await publishEvent('queue.job_notification.completed', {
      jobId: job.id,
      type: job.data.type,
      orgId: job.data.orgId,
      notificationsSent: result.notificationsSent,
    });
  });

  notificationWorker.on('failed', async (job, error) => {
    log.error('Job notification job failed', {
      jobId: job?.id,
      type: job?.data.type,
      error: error.message,
      attempts: job?.attemptsMade,
    });

    if (job) {
      await publishEvent('queue.job_notification.failed', {
        jobId: job.id,
        type: job.data.type,
        orgId: job.data.orgId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  });

  notificationWorker.on('error', (error) => {
    log.error('Job notification worker error', { error: error.message });
  });

  log.info('Job notification worker started');

  return notificationWorker;
}

export function stopJobNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    return notificationWorker.close();
  }
  return Promise.resolve();
}

// =============================================================================
// NOTIFICATION CONTENT
// =============================================================================

interface NotificationContent {
  title: string;
  body: string;
}

function buildNotificationContent(
  type: JobNotificationType,
  job: any,
  data?: Record<string, any>
): NotificationContent {
  const customerName = job.customer?.name || 'Cliente';
  const techName = job.technician?.name || 'Tecnico';
  const serviceType = job.serviceType || 'servicio';
  const scheduledDateStr = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Buenos_Aires',
    })
    : '';
  const scheduledTime = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Buenos_Aires',
    })
    : '';

  const contentMap: Record<JobNotificationType, NotificationContent> = {
    job_created: {
      title: 'Nuevo trabajo creado',
      body: `Se ha creado un nuevo trabajo de ${serviceType} para ${customerName}`,
    },
    job_assigned: {
      title: 'Trabajo asignado',
      body: `Se te ha asignado un trabajo de ${serviceType} para ${customerName}`,
    },
    job_scheduled: {
      title: 'Visita programada',
      body: `Tu visita de ${serviceType} ha sido programada para ${scheduledDateStr} a las ${scheduledTime}`,
    },
    job_started: {
      title: 'Trabajo iniciado',
      body: `El tecnico ${techName} ha comenzado el trabajo de ${serviceType}`,
    },
    job_completed: {
      title: 'Trabajo completado',
      body: `El trabajo de ${serviceType} ha sido completado`,
    },
    job_cancelled: {
      title: 'Trabajo cancelado',
      body: `El trabajo de ${serviceType} ha sido cancelado`,
    },
    tech_en_route: {
      title: 'Tecnico en camino',
      body: `${techName} esta en camino. Tiempo estimado: ${data?.eta || 'Pronto'}`,
    },
    tech_arrived: {
      title: 'Tecnico llego',
      body: `${techName} ha llegado a tu ubicacion`,
    },
    payment_received: {
      title: 'Pago recibido',
      body: `Recibimos tu pago por el trabajo de ${serviceType}. Gracias!`,
    },
    invoice_ready: {
      title: 'Factura disponible',
      body: `Tu factura por el trabajo de ${serviceType} esta lista`,
    },
    job_rescheduled: {
      title: 'Visita reprogramada',
      body: `Tu visita ha sido reprogramada para ${scheduledDateStr} a las ${scheduledTime}`,
    },
  };

  return contentMap[type] || {
    title: 'Actualizacion de trabajo',
    body: `Hay una actualizacion sobre tu trabajo de ${serviceType}`,
  };
}

// =============================================================================
// MANAGEMENT
// =============================================================================

/**
 * Retry a failed job
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const queue = getJobNotificationQueue();
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
): Promise<Job<JobNotificationJobData, JobNotificationJobResult>[]> {
  const queue = getJobNotificationQueue();
  return queue.getFailed(start, end);
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getJobNotificationQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getJobNotificationQueue();
  await queue.resume();
}

/**
 * Drain the queue
 */
export async function drainQueue(): Promise<void> {
  const queue = getJobNotificationQueue();
  await queue.drain();
}
