/**
 * CampoTech Error Handling Service
 * ==================================
 *
 * Comprehensive error handling for:
 * - AFIP API unavailability (queue for manual verification)
 * - MercadoPago webhook retry with idempotency
 * - Document upload failures with exponential backoff
 * - Network errors during verification (partial progress save)
 * - Timeout handling for external services
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export interface ServiceTimeouts {
  afip: number;
  mercadopago: number;
  fileUpload: number;
  default: number;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface QueuedVerification {
  id: string;
  organizationId: string;
  userId: string;
  cuit: string;
  reason: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface PartialProgress {
  id: string;
  userId: string;
  organizationId: string;
  flowType: 'verification' | 'onboarding' | 'document_upload';
  stepCompleted: string;
  savedData: Record<string, unknown>;
  uploadedFiles: string[];
  expiresAt: Date;
}

export interface ProcessedWebhook {
  webhookId: string;
  action: string;
  processedAt: Date;
  result: 'success' | 'failed' | 'duplicate';
  responseData?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBase: 2,
};

/** Service-specific timeouts in milliseconds */
export const SERVICE_TIMEOUTS: ServiceTimeouts = {
  afip: 30000, // 30 seconds for AFIP
  mercadopago: 15000, // 15 seconds for MercadoPago
  fileUpload: 60000, // 60 seconds for file uploads
  default: 10000, // 10 seconds default
};

/** Partial progress expiration (24 hours) */
const PARTIAL_PROGRESS_TTL_MS = 24 * 60 * 60 * 1000;

/** Webhook idempotency cache TTL (24 hours) */
const WEBHOOK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory caches
const webhookCache = new Map<string, ProcessedWebhook>();
const partialProgressCache = new Map<string, PartialProgress>();

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class ErrorHandlingService {
  // ─────────────────────────────────────────────────────────────────────────────
  // AFIP API Unavailability
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Queue CUIT verification for manual processing when AFIP is unavailable
   */
  async queueForManualVerification(
    organizationId: string,
    userId: string,
    cuit: string,
    error: Error
  ): Promise<{
    queued: boolean;
    queueId?: string;
    userMessage: string;
    userMessageEs: string;
  }> {
    try {
      // Log to Sentry with context
      Sentry.captureException(error, {
        tags: {
          service: 'afip',
          action: 'cuit_verification',
        },
        extra: {
          organizationId,
          userId,
          cuit: cuit.slice(0, 2) + '***', // Partially masked
        },
      });

      // Create queue entry in database
      const queueEntry = await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: 'manual_verification_queue',
          eventType: 'afip.manual_verification_queued',
          eventData: {
            userId,
            cuit,
            reason: error.message,
            queuedAt: new Date().toISOString(),
            status: 'pending',
            attemptCount: 1,
          } as Prisma.InputJsonValue,
          actorType: 'system',
        },
      });

      // Notify admin
      await this.notifyAdmin({
        type: 'manual_verification_needed',
        organizationId,
        userId,
        message: `AFIP unavailable. CUIT verification queued: ${cuit.slice(0, 2)}***`,
        severity: 'medium',
      });

      console.log(`[ErrorHandling] Queued CUIT ${cuit.slice(0, 2)}*** for manual verification`);

      return {
        queued: true,
        queueId: queueEntry.id,
        userMessage: 'Automatic verification is temporarily unavailable. Your verification has been queued for manual review.',
        userMessageEs: 'La verificación automática no está disponible temporalmente. Tu verificación fue enviada para revisión manual.',
      };
    } catch (queueError) {
      console.error('[ErrorHandling] Failed to queue for manual verification:', queueError);
      Sentry.captureException(queueError);

      return {
        queued: false,
        userMessage: 'Verification service is temporarily unavailable. Please try again later.',
        userMessageEs: 'El servicio de verificación no está disponible temporalmente. Por favor intentá más tarde.',
      };
    }
  }

  /**
   * Get pending manual verifications for admin
   */
  async getPendingManualVerifications(): Promise<QueuedVerification[]> {
    const pending = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: 'afip.manual_verification_queued',
        eventData: {
          path: ['status'],
          equals: 'pending',
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    type PendingEventEntry = (typeof pending)[number];
    return pending.map((event: PendingEventEntry) => {
      const data = event.eventData as Record<string, unknown>;
      return {
        id: event.id,
        organizationId: event.organizationId,
        userId: data.userId as string,
        cuit: data.cuit as string,
        reason: data.reason as string,
        attemptCount: (data.attemptCount as number) || 1,
        lastAttemptAt: data.lastAttemptAt ? new Date(data.lastAttemptAt as string) : null,
        status: data.status as 'pending' | 'processing' | 'completed' | 'failed',
        createdAt: event.createdAt,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MercadoPago Webhook Retry with Idempotency
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if webhook was already processed (idempotency)
   */
  async isWebhookProcessed(webhookId: string, action: string): Promise<boolean> {
    const cacheKey = `${webhookId}:${action}`;

    // Check in-memory cache first
    const cached = webhookCache.get(cacheKey);
    if (cached) {
      // Check TTL
      if (Date.now() - cached.processedAt.getTime() < WEBHOOK_CACHE_TTL_MS) {
        return true;
      }
      webhookCache.delete(cacheKey);
    }

    // Check database
    const existing = await prisma.subscriptionEvent.findFirst({
      where: {
        eventType: `webhook.${action}`,
        eventData: {
          path: ['webhookId'],
          equals: webhookId,
        },
      },
      select: { id: true },
    });

    return !!existing;
  }

  /**
   * Mark webhook as processed
   */
  markWebhookProcessed(
    webhookId: string,
    action: string,
    result: 'success' | 'failed' | 'duplicate',
    responseData?: Record<string, unknown>
  ): void {
    const cacheKey = `${webhookId}:${action}`;
    webhookCache.set(cacheKey, {
      webhookId,
      action,
      processedAt: new Date(),
      result,
      responseData,
    });

    // Cleanup old cache entries periodically
    if (webhookCache.size > 1000) {
      this.cleanupWebhookCache();
    }
  }

  /**
   * Process webhook with retry logic
   */
  async processWebhookWithRetry<T>(
    webhookId: string,
    action: string,
    processor: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<{
    success: boolean;
    result?: T;
    error?: string;
    attempts: number;
    wasDuplicate: boolean;
  }> {
    // Check idempotency first
    const alreadyProcessed = await this.isWebhookProcessed(webhookId, action);
    if (alreadyProcessed) {
      console.log(`[ErrorHandling] Webhook ${webhookId} already processed, skipping`);
      return {
        success: true,
        attempts: 0,
        wasDuplicate: true,
      };
    }

    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      attempts = attempt;

      try {
        const result = await processor();

        this.markWebhookProcessed(webhookId, action, 'success');

        return {
          success: true,
          result,
          attempts,
          wasDuplicate: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(
          `[ErrorHandling] Webhook ${webhookId} attempt ${attempt}/${config.maxAttempts} failed:`,
          lastError.message
        );

        // Don't retry on validation errors
        if (this.isValidationError(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        if (attempt < config.maxAttempts) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1),
            config.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.markWebhookProcessed(webhookId, action, 'failed', {
      error: lastError?.message,
      attempts,
    });

    Sentry.captureException(lastError, {
      tags: {
        service: 'mercadopago',
        action: 'webhook_processing',
      },
      extra: {
        webhookId,
        action,
        attempts,
      },
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts,
      wasDuplicate: false,
    };
  }

  /**
   * Handle out-of-order webhooks by checking sequence
   */
  async handleOutOfOrderWebhook(
    organizationId: string,
    webhookId: string,
    action: string,
    expectedPreviousAction?: string
  ): Promise<{
    shouldProcess: boolean;
    reason?: string;
  }> {
    if (!expectedPreviousAction) {
      return { shouldProcess: true };
    }

    // Check if expected previous action was received
    const previousExists = await prisma.subscriptionEvent.findFirst({
      where: {
        organizationId,
        eventType: `webhook.${expectedPreviousAction}`,
        createdAt: { lt: new Date() },
      },
    });

    if (!previousExists) {
      console.warn(
        `[ErrorHandling] Out-of-order webhook detected: ${action} received before ${expectedPreviousAction}`
      );

      // Queue for delayed processing
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: 'webhook_queue',
          eventType: 'webhook.out_of_order',
          eventData: {
            webhookId,
            action,
            expectedPreviousAction,
            queuedAt: new Date().toISOString(),
            processAfter: new Date(Date.now() + 30000).toISOString(), // 30 seconds
          } as Prisma.InputJsonValue,
          actorType: 'system',
        },
      });

      return {
        shouldProcess: false,
        reason: `Waiting for ${expectedPreviousAction} webhook`,
      };
    }

    return { shouldProcess: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document Upload Failures
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upload file with exponential backoff retry
   */
  async uploadWithRetry(
    uploadFn: () => Promise<{ url: string; key: string }>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<{
    success: boolean;
    url?: string;
    key?: string;
    error?: string;
    errorEs?: string;
    attempts: number;
  }> {
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      attempts = attempt;

      try {
        const result = await Promise.race([
          uploadFn(),
          this.createTimeout(SERVICE_TIMEOUTS.fileUpload, 'File upload timed out'),
        ]) as { url: string; key: string };

        return {
          success: true,
          url: result.url,
          key: result.key,
          attempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(
          `[ErrorHandling] Upload attempt ${attempt}/${config.maxAttempts} failed:`,
          lastError.message
        );

        // Calculate delay with exponential backoff
        if (attempt < config.maxAttempts) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1),
            config.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    // Log to Sentry
    Sentry.captureException(lastError, {
      tags: {
        service: 'file_upload',
        action: 'document_upload',
      },
      extra: { attempts },
    });

    return {
      success: false,
      error: 'File upload failed after multiple attempts. Please try again.',
      errorEs: 'La carga del archivo falló después de varios intentos. Por favor intentá de nuevo.',
      attempts,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Network Errors & Partial Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save partial progress during verification flow
   */
  async savePartialProgress(
    userId: string,
    organizationId: string,
    flowType: 'verification' | 'onboarding' | 'document_upload',
    stepCompleted: string,
    savedData: Record<string, unknown>,
    uploadedFiles: string[] = []
  ): Promise<{ saved: boolean; progressId?: string }> {
    try {
      const progressId = `${userId}:${flowType}`;
      const expiresAt = new Date(Date.now() + PARTIAL_PROGRESS_TTL_MS);

      const progress: PartialProgress = {
        id: progressId,
        userId,
        organizationId,
        flowType,
        stepCompleted,
        savedData,
        uploadedFiles,
        expiresAt,
      };

      // Save to cache
      partialProgressCache.set(progressId, progress);

      // Persist to database for durability
      await prisma.subscriptionEvent.upsert({
        where: {
          id: progressId,
        },
        create: {
          id: progressId,
          organizationId,
          subscriptionId: 'partial_progress',
          eventType: `progress.${flowType}`,
          eventData: {
            userId,
            stepCompleted,
            savedData,
            uploadedFiles,
            expiresAt: expiresAt.toISOString(),
          } as Prisma.InputJsonValue,
          actorType: 'system',
        },
        update: {
          eventData: {
            userId,
            stepCompleted,
            savedData,
            uploadedFiles,
            expiresAt: expiresAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      console.log(`[ErrorHandling] Saved progress for ${flowType} at step ${stepCompleted}`);

      return { saved: true, progressId };
    } catch (error) {
      console.error('[ErrorHandling] Failed to save partial progress:', error);
      return { saved: false };
    }
  }

  /**
   * Restore partial progress for resumption
   */
  async restorePartialProgress(
    userId: string,
    flowType: 'verification' | 'onboarding' | 'document_upload'
  ): Promise<{
    found: boolean;
    progress?: PartialProgress;
  }> {
    const progressId = `${userId}:${flowType}`;

    // Check cache first
    const cached = partialProgressCache.get(progressId);
    if (cached && cached.expiresAt > new Date()) {
      return { found: true, progress: cached };
    }

    // Check database
    try {
      const stored = await prisma.subscriptionEvent.findFirst({
        where: {
          id: progressId,
          eventType: `progress.${flowType}`,
        },
      });

      if (stored) {
        const data = stored.eventData as Record<string, unknown>;
        const expiresAt = new Date(data.expiresAt as string);

        if (expiresAt > new Date()) {
          const progress: PartialProgress = {
            id: progressId,
            userId: data.userId as string,
            organizationId: stored.organizationId,
            flowType,
            stepCompleted: data.stepCompleted as string,
            savedData: data.savedData as Record<string, unknown>,
            uploadedFiles: (data.uploadedFiles as string[]) || [],
            expiresAt,
          };

          // Update cache
          partialProgressCache.set(progressId, progress);

          return { found: true, progress };
        }
      }
    } catch (error) {
      console.error('[ErrorHandling] Failed to restore partial progress:', error);
    }

    return { found: false };
  }

  /**
   * Clear partial progress after successful completion
   */
  async clearPartialProgress(
    userId: string,
    flowType: 'verification' | 'onboarding' | 'document_upload'
  ): Promise<void> {
    const progressId = `${userId}:${flowType}`;

    partialProgressCache.delete(progressId);

    try {
      await prisma.subscriptionEvent.deleteMany({
        where: {
          id: progressId,
          eventType: `progress.${flowType}`,
        },
      });
    } catch (error) {
      console.error('[ErrorHandling] Failed to clear partial progress:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Timeout Handling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<{
    success: boolean;
    result?: T;
    timedOut: boolean;
    error?: string;
    errorEs?: string;
  }> {
    try {
      const result = await Promise.race([
        operation(),
        this.createTimeout(timeoutMs, `${operationName} timed out`),
      ]) as T;

      return { success: true, result, timedOut: false };
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out');

      if (isTimeout) {
        Sentry.captureMessage(`Timeout: ${operationName}`, {
          level: 'warning',
          tags: { type: 'timeout', operation: operationName },
          extra: { timeoutMs },
        });

        return {
          success: false,
          timedOut: true,
          error: `Operation timed out. Please try again.`,
          errorEs: `La operación tardó demasiado. Por favor intentá de nuevo.`,
        };
      }

      return {
        success: false,
        timedOut: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorEs: 'Ocurrió un error. Por favor intentá de nuevo.',
      };
    }
  }

  /**
   * Execute AFIP call with timeout
   */
  async withAFIPTimeout<T>(operation: () => Promise<T>): Promise<{
    success: boolean;
    result?: T;
    timedOut: boolean;
    error?: string;
    errorEs?: string;
  }> {
    return this.withTimeout(operation, SERVICE_TIMEOUTS.afip, 'AFIP verification');
  }

  /**
   * Execute MercadoPago call with timeout
   */
  async withMercadoPagoTimeout<T>(operation: () => Promise<T>): Promise<{
    success: boolean;
    result?: T;
    timedOut: boolean;
    error?: string;
    errorEs?: string;
  }> {
    return this.withTimeout(operation, SERVICE_TIMEOUTS.mercadopago, 'Payment processing');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Notify admin of critical issues
   */
  async notifyAdmin(params: {
    type: string;
    organizationId?: string;
    userId?: string;
    message: string;
    severity: ErrorSeverity;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Find admin users
      const admins = await prisma.user.findMany({
        where: {
          role: 'admin',
        },
        select: { id: true },
      });

      // Create notifications for all admins
      type AdminEntry = (typeof admins)[number];
      await Promise.all(
        admins.map((admin: AdminEntry) =>
          prisma.notification.create({
            data: {
              userId: admin.id,
              type: `admin_alert.${params.type}`,
              title: `[${params.severity.toUpperCase()}] ${params.type}`,
              message: params.message,
              data: {
                organizationId: params.organizationId,
                userId: params.userId,
                severity: params.severity,
                ...params.metadata,
              } as unknown as Prisma.InputJsonValue,
            },
          })
        )
      );

      // Log critical errors to Sentry
      if (params.severity === 'critical' || params.severity === 'high') {
        Sentry.captureMessage(params.message, {
          level: params.severity === 'critical' ? 'fatal' : 'error',
          tags: { type: params.type, severity: params.severity },
          extra: params.metadata,
        });
      }
    } catch (error) {
      console.error('[ErrorHandling] Failed to notify admin:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isValidationError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('malformed') ||
      message.includes('required')
    );
  }

  private cleanupWebhookCache(): void {
    const now = Date.now();
    for (const [key, value] of webhookCache.entries()) {
      if (now - value.processedAt.getTime() > WEBHOOK_CACHE_TTL_MS) {
        webhookCache.delete(key);
      }
    }
  }
}

// Export singleton
export const errorHandling = new ErrorHandlingService();

// Export utility functions for direct use
export const { withTimeout, withAFIPTimeout, withMercadoPagoTimeout } = new ErrorHandlingService();
