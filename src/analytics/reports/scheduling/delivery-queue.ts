/**
 * Delivery Queue for Reports
 * ==========================
 *
 * Phase 10.3: Report Generation Engine
 * Redis-based queue for reliable report delivery.
 */

import { log } from '../../../lib/logging/logger';
import { getRedis } from '../../../lib/redis/redis-manager';
import { sendReportEmail } from '../exporters/email-sender';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeliveryJob {
  id: string;
  type: 'email' | 'webhook';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: EmailDeliveryPayload | WebhookDeliveryPayload;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string;
  completedAt?: string;
}

export interface EmailDeliveryPayload {
  reportId: string;
  reportName: string;
  organizationId: string;
  recipient: string;
  format: string;
  reportBuffer: string; // Base64 encoded
  period: string;
}

export interface WebhookDeliveryPayload {
  reportId: string;
  reportName: string;
  organizationId: string;
  webhookUrl: string;
  format: string;
  reportBuffer: string; // Base64 encoded
}

export interface DeliveryResult {
  jobId: string;
  success: boolean;
  error?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════════════════════

const REDIS_KEYS = {
  job: (id: string) => `delivery:job:${id}`,
  pendingQueue: 'delivery:queue:pending',
  processingSet: 'delivery:set:processing',
  completedList: 'delivery:list:completed',
  failedList: 'delivery:list:failed',
  stats: 'delivery:stats',
};

const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateJobId(): string {
  return `dj_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function queueDelivery(
  type: 'email' | 'webhook',
  payload: EmailDeliveryPayload | WebhookDeliveryPayload,
  scheduledFor?: Date
): Promise<DeliveryJob> {
  const redis = getRedis();
  const now = new Date();

  const job: DeliveryJob = {
    id: generateJobId(),
    type,
    status: 'pending',
    payload,
    attempts: 0,
    maxAttempts: 3,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    scheduledFor: scheduledFor?.toISOString(),
  };

  const score = scheduledFor ? scheduledFor.getTime() : now.getTime();

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.job(job.id), JSON.stringify(job));
  pipeline.zadd(REDIS_KEYS.pendingQueue, score, job.id);
  pipeline.hincrby(REDIS_KEYS.stats, 'pending', 1);
  pipeline.hincrby(REDIS_KEYS.stats, 'total', 1);
  await pipeline.exec();

  log.info('Delivery job queued', { jobId: job.id, type, scheduledFor });

  return job;
}

export async function queueEmailDelivery(input: {
  reportId: string;
  reportName: string;
  organizationId: string;
  recipient: string;
  format: string;
  reportBuffer: Buffer;
  period: string;
}): Promise<DeliveryJob> {
  const payload: EmailDeliveryPayload = {
    reportId: input.reportId,
    reportName: input.reportName,
    organizationId: input.organizationId,
    recipient: input.recipient,
    format: input.format,
    reportBuffer: input.reportBuffer.toString('base64'),
    period: input.period,
  };

  return queueDelivery('email', payload);
}

export async function queueWebhookDelivery(input: {
  reportId: string;
  reportName: string;
  organizationId: string;
  webhookUrl: string;
  format: string;
  reportBuffer: Buffer;
}): Promise<DeliveryJob> {
  const payload: WebhookDeliveryPayload = {
    reportId: input.reportId,
    reportName: input.reportName,
    organizationId: input.organizationId,
    webhookUrl: input.webhookUrl,
    format: input.format,
    reportBuffer: input.reportBuffer.toString('base64'),
  };

  return queueDelivery('webhook', payload);
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

async function processEmailJob(job: DeliveryJob): Promise<boolean> {
  const payload = job.payload as EmailDeliveryPayload;

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  };

  const result = await sendReportEmail({
    to: payload.recipient,
    subject: `Informe: ${payload.reportName}`,
    reportName: payload.reportName,
    reportPeriod: payload.period,
    organizationName: 'CampoTech',
    attachment: {
      filename: `${payload.reportName}.${payload.format}`,
      content: Buffer.from(payload.reportBuffer, 'base64'),
      contentType: mimeTypes[payload.format] || 'application/octet-stream',
    },
  });

  return result.success;
}

async function processWebhookJob(job: DeliveryJob): Promise<boolean> {
  const payload = job.payload as WebhookDeliveryPayload;

  const response = await fetch(payload.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reportId: payload.reportId,
      reportName: payload.reportName,
      organizationId: payload.organizationId,
      format: payload.format,
      content: payload.reportBuffer,
      generatedAt: new Date().toISOString(),
    }),
  });

  return response.ok;
}

async function processJob(job: DeliveryJob): Promise<DeliveryResult> {
  const redis = getRedis();
  const startTime = Date.now();

  job.status = 'processing';
  job.attempts++;
  job.updatedAt = new Date().toISOString();

  await redis.set(REDIS_KEYS.job(job.id), JSON.stringify(job));
  await redis.sadd(REDIS_KEYS.processingSet, job.id);

  log.info('Processing delivery job', { jobId: job.id, type: job.type, attempt: job.attempts });

  try {
    let success: boolean;

    if (job.type === 'email') {
      success = await processEmailJob(job);
    } else {
      success = await processWebhookJob(job);
    }

    if (success) {
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      const pipeline = redis.pipeline();
      pipeline.set(REDIS_KEYS.job(job.id), JSON.stringify(job));
      pipeline.srem(REDIS_KEYS.processingSet, job.id);
      pipeline.lpush(REDIS_KEYS.completedList, job.id);
      pipeline.hincrby(REDIS_KEYS.stats, 'pending', -1);
      pipeline.hincrby(REDIS_KEYS.stats, 'completed', 1);
      await pipeline.exec();

      log.info('Delivery job completed', { jobId: job.id, duration: Date.now() - startTime });

      return { jobId: job.id, success: true };
    } else {
      throw new Error('Delivery failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    job.lastError = errorMessage;
    job.updatedAt = new Date().toISOString();

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';

      const pipeline = redis.pipeline();
      pipeline.set(REDIS_KEYS.job(job.id), JSON.stringify(job));
      pipeline.srem(REDIS_KEYS.processingSet, job.id);
      pipeline.lpush(REDIS_KEYS.failedList, job.id);
      pipeline.hincrby(REDIS_KEYS.stats, 'pending', -1);
      pipeline.hincrby(REDIS_KEYS.stats, 'failed', 1);
      await pipeline.exec();

      log.error('Delivery job failed permanently', { jobId: job.id, attempts: job.attempts, error: errorMessage });
    } else {
      job.status = 'pending';
      const retryDelay = RETRY_DELAYS[job.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const retryAt = Date.now() + retryDelay;

      const pipeline = redis.pipeline();
      pipeline.set(REDIS_KEYS.job(job.id), JSON.stringify(job));
      pipeline.srem(REDIS_KEYS.processingSet, job.id);
      pipeline.zadd(REDIS_KEYS.pendingQueue, retryAt, job.id);
      await pipeline.exec();

      log.warn('Delivery job scheduled for retry', { jobId: job.id, attempts: job.attempts, retryAt: new Date(retryAt) });
    }

    return { jobId: job.id, success: false, error: errorMessage };
  }
}

export async function processDeliveryQueue(batchSize: number = 10): Promise<DeliveryResult[]> {
  const redis = getRedis();
  const now = Date.now();

  const jobIds = await redis.zrangebyscore(REDIS_KEYS.pendingQueue, '-inf', now, 'LIMIT', 0, batchSize);

  if (jobIds.length === 0) return [];

  await redis.zrem(REDIS_KEYS.pendingQueue, ...jobIds);

  const results: DeliveryResult[] = [];

  for (const jobId of jobIds) {
    const data = await redis.get(REDIS_KEYS.job(jobId));
    if (!data) continue;

    const job: DeliveryJob = JSON.parse(data);
    const result = await processJob(job);
    results.push(result);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function getQueueStats(): Promise<QueueStats> {
  const redis = getRedis();
  const stats = await redis.hgetall(REDIS_KEYS.stats);

  return {
    pending: parseInt(stats.pending || '0', 10),
    processing: parseInt(stats.processing || '0', 10),
    completed: parseInt(stats.completed || '0', 10),
    failed: parseInt(stats.failed || '0', 10),
    total: parseInt(stats.total || '0', 10),
  };
}

export async function getJobStatus(jobId: string): Promise<DeliveryJob | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.job(jobId));
  return data ? JSON.parse(data) : null;
}

export async function retryJob(jobId: string): Promise<boolean> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.job(jobId));
  if (!data) return false;

  const job: DeliveryJob = JSON.parse(data);
  if (job.status !== 'failed') return false;

  job.status = 'pending';
  job.attempts = 0;
  job.lastError = undefined;
  job.updatedAt = new Date().toISOString();

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.job(jobId), JSON.stringify(job));
  pipeline.lrem(REDIS_KEYS.failedList, 1, jobId);
  pipeline.zadd(REDIS_KEYS.pendingQueue, Date.now(), jobId);
  pipeline.hincrby(REDIS_KEYS.stats, 'failed', -1);
  pipeline.hincrby(REDIS_KEYS.stats, 'pending', 1);
  await pipeline.exec();

  log.info('Delivery job scheduled for retry', { jobId });

  return true;
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.job(jobId));
  if (!data) return false;

  const job: DeliveryJob = JSON.parse(data);
  if (job.status !== 'pending') return false;

  const pipeline = redis.pipeline();
  pipeline.del(REDIS_KEYS.job(jobId));
  pipeline.zrem(REDIS_KEYS.pendingQueue, jobId);
  pipeline.hincrby(REDIS_KEYS.stats, 'pending', -1);
  pipeline.hincrby(REDIS_KEYS.stats, 'total', -1);
  await pipeline.exec();

  log.info('Delivery job cancelled', { jobId });

  return true;
}

export async function cleanupOldJobs(maxAgeDays: number = 30): Promise<number> {
  const redis = getRedis();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const listKey of [REDIS_KEYS.completedList, REDIS_KEYS.failedList]) {
    const jobIds = await redis.lrange(listKey, 0, -1);

    for (const jobId of jobIds) {
      const data = await redis.get(REDIS_KEYS.job(jobId));
      if (!data) continue;

      const job: DeliveryJob = JSON.parse(data);
      const jobTime = new Date(job.completedAt || job.updatedAt).getTime();

      if (jobTime < cutoff) {
        await redis.del(REDIS_KEYS.job(jobId));
        await redis.lrem(listKey, 1, jobId);
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    log.info('Old delivery jobs cleaned up', { cleaned, maxAgeDays });
  }

  return cleaned;
}
