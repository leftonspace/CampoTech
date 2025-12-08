/**
 * Voice Processing Worker
 * =======================
 *
 * Background worker for processing voice messages from WhatsApp
 */

import { Worker, Queue, Job } from 'bullmq';
import { getRedisConnection } from '../../lib/redis';
import { getVoiceAIService } from '../../integrations/voice-ai';
import { prisma } from '../../lib/prisma';
import { publishEvent } from '../../lib/events';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const QUEUE_NAME = 'voice-processing';

const WORKER_CONFIG = {
  concurrency: 3, // Process 3 voice messages at a time
  limiter: {
    max: 10, // Max 10 jobs per minute (OpenAI rate limiting)
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
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceProcessingJobData {
  waMessageId: string;
  audioUrl: string;
  audioDuration: number;
  customerPhone: string;
  conversationId: string;
  organizationId: string;
  priority?: number;
}

export interface VoiceProcessingJobResult {
  success: boolean;
  voiceMessageId: string;
  route?: string;
  jobId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

let voiceQueue: Queue<VoiceProcessingJobData, VoiceProcessingJobResult> | null = null;

export function getVoiceQueue(): Queue<VoiceProcessingJobData, VoiceProcessingJobResult> {
  if (!voiceQueue) {
    voiceQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: JOB_CONFIG,
    });
  }
  return voiceQueue;
}

/**
 * Add a voice message to the processing queue
 */
export async function queueVoiceMessage(
  data: VoiceProcessingJobData
): Promise<Job<VoiceProcessingJobData, VoiceProcessingJobResult>> {
  const queue = getVoiceQueue();

  // Calculate priority (higher number = lower priority in BullMQ)
  // Urgent messages get priority 1, normal get 5
  const priority = data.priority ?? 5;

  return queue.add(`voice-${data.waMessageId}`, data, {
    priority,
    jobId: data.waMessageId, // Prevent duplicate processing
  });
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
  const queue = getVoiceQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════════════════════════════

let voiceWorker: Worker<VoiceProcessingJobData, VoiceProcessingJobResult> | null = null;

export function startVoiceWorker(): Worker<VoiceProcessingJobData, VoiceProcessingJobResult> {
  if (voiceWorker) {
    return voiceWorker;
  }

  const voiceAI = getVoiceAIService();

  voiceWorker = new Worker<VoiceProcessingJobData, VoiceProcessingJobResult>(
    QUEUE_NAME,
    async (job) => {
      console.log(`[Voice Worker] Processing ${job.id}...`);

      try {
        // Process the voice message
        const result = await voiceAI.processVoiceMessage(
          {
            waMessageId: job.data.waMessageId,
            audioUrl: job.data.audioUrl,
            audioDuration: job.data.audioDuration,
            customerPhone: job.data.customerPhone,
            conversationId: job.data.conversationId,
          },
          job.data.organizationId
        );

        // Update progress
        await job.updateProgress(100);

        console.log(`[Voice Worker] Completed ${job.id}: ${result.route || 'unknown'}`);

        return {
          success: result.success,
          voiceMessageId: result.voiceMessageId,
          route: result.route,
          error: result.error,
        };
      } catch (error) {
        console.error(`[Voice Worker] Failed ${job.id}:`, error);

        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONFIG.concurrency,
      limiter: WORKER_CONFIG.limiter,
    }
  );

  // Event handlers
  voiceWorker.on('completed', async (job, result) => {
    console.log(`[Voice Worker] Job ${job.id} completed:`, result.route);

    await publishEvent('voice.processing_completed', {
      jobId: job.id,
      voiceMessageId: result.voiceMessageId,
      route: result.route,
      organizationId: job.data.organizationId,
    });
  });

  voiceWorker.on('failed', async (job, error) => {
    console.error(`[Voice Worker] Job ${job?.id} failed:`, error.message);

    if (job) {
      await publishEvent('voice.processing_failed', {
        jobId: job.id,
        waMessageId: job.data.waMessageId,
        error: error.message,
        attempts: job.attemptsMade,
        organizationId: job.data.organizationId,
      });
    }
  });

  voiceWorker.on('progress', (job, progress) => {
    console.log(`[Voice Worker] Job ${job.id} progress: ${progress}%`);
  });

  voiceWorker.on('error', (error) => {
    console.error('[Voice Worker] Worker error:', error);
  });

  console.log('[Voice Worker] Started');

  return voiceWorker;
}

export function stopVoiceWorker(): Promise<void> {
  if (voiceWorker) {
    return voiceWorker.close();
  }
  return Promise.resolve();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retry a failed job
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const queue = getVoiceQueue();
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
): Promise<Job<VoiceProcessingJobData, VoiceProcessingJobResult>[]> {
  const queue = getVoiceQueue();
  return queue.getFailed(start, end);
}

/**
 * Clean old jobs
 */
export async function cleanOldJobs(): Promise<{ cleaned: number }> {
  const queue = getVoiceQueue();

  // Clean completed jobs older than 24 hours
  const completedCleaned = await queue.clean(24 * 60 * 60 * 1000, 1000, 'completed');

  // Clean failed jobs older than 7 days
  const failedCleaned = await queue.clean(7 * 24 * 60 * 60 * 1000, 1000, 'failed');

  return { cleaned: completedCleaned.length + failedCleaned.length };
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getVoiceQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getVoiceQueue();
  await queue.resume();
}

/**
 * Drain the queue (remove all jobs)
 */
export async function drainQueue(): Promise<void> {
  const queue = getVoiceQueue();
  await queue.drain();
}
