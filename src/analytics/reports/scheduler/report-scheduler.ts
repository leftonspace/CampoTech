/**
 * Report Scheduler
 * ================
 *
 * Phase 10.3: Report Generation Engine
 * Schedules and delivers reports automatically using Redis persistence.
 */

import { log } from '../../../lib/logging/logger';
import { getRedis } from '../../../lib/redis/redis-manager';
import { generateReport } from '../report-generator';
import { generatePDF } from '../exporters/pdf-exporter';
import { generateExcel } from '../exporters/excel-exporter';
import { generateCSV } from '../exporters/csv-exporter';
import { sendReportEmail } from '../exporters/email-sender';
import { getDateRangeFromPreset } from '../templates/report-templates';
import { saveReportExecution, updateExecutionStatus } from '../history/report-history';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScheduledReport {
  id: string;
  organizationId: string;
  templateId: string;
  name: string;
  schedule: ReportSchedule;
  dateRangePreset: string;
  format: 'pdf' | 'excel' | 'csv';
  recipients: ReportRecipient[];
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timezone: string;
}

export interface ReportRecipient {
  type: 'email' | 'webhook';
  destination: string;
  name?: string;
}

export interface ScheduleReportInput {
  organizationId: string;
  templateId: string;
  name: string;
  schedule: ReportSchedule;
  dateRangePreset: string;
  format: 'pdf' | 'excel' | 'csv';
  recipients: ReportRecipient[];
  createdBy?: string;
}

export interface ReportDeliveryResult {
  scheduledReportId: string;
  success: boolean;
  deliveredAt: Date;
  error?: string;
  recipientResults: {
    recipient: ReportRecipient;
    success: boolean;
    error?: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════════════════════

const REDIS_KEYS = {
  report: (id: string) => `scheduled_report:${id}`,
  orgReports: (orgId: string) => `scheduled_reports:org:${orgId}`,
  dueQueue: 'scheduled_reports:due_queue',
  allReports: 'scheduled_reports:all',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schedule a new report
 */
export async function scheduleReport(input: ScheduleReportInput): Promise<ScheduledReport> {
  const redis = getRedis();
  const now = new Date();
  const nextRunAt = calculateNextRunTime(input.schedule);

  const scheduledReport: ScheduledReport = {
    id: generateId(),
    organizationId: input.organizationId,
    templateId: input.templateId,
    name: input.name,
    schedule: input.schedule,
    dateRangePreset: input.dateRangePreset,
    format: input.format,
    recipients: input.recipients,
    enabled: true,
    lastRunAt: null,
    nextRunAt,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Serialize dates for Redis storage
  const serialized = serializeReport(scheduledReport);

  // Store in Redis
  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.report(scheduledReport.id), JSON.stringify(serialized));
  pipeline.sadd(REDIS_KEYS.orgReports(input.organizationId), scheduledReport.id);
  pipeline.sadd(REDIS_KEYS.allReports, scheduledReport.id);

  // Add to due queue with next run time as score
  if (nextRunAt) {
    pipeline.zadd(REDIS_KEYS.dueQueue, nextRunAt.getTime(), scheduledReport.id);
  }

  await pipeline.exec();

  log.info('Report scheduled', {
    reportId: scheduledReport.id,
    templateId: input.templateId,
    nextRunAt,
  });

  return scheduledReport;
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(
  reportId: string,
  updates: Partial<ScheduleReportInput>
): Promise<ScheduledReport | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.report(reportId));

  if (!data) {
    log.warn('Scheduled report not found', { reportId });
    return null;
  }

  const existing = deserializeReport(JSON.parse(data));
  const updated: ScheduledReport = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  // Recalculate next run if schedule changed
  if (updates.schedule) {
    updated.nextRunAt = calculateNextRunTime(updates.schedule);
  }

  const serialized = serializeReport(updated);

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.report(reportId), JSON.stringify(serialized));

  // Update due queue if next run changed
  if (updated.enabled && updated.nextRunAt) {
    pipeline.zadd(REDIS_KEYS.dueQueue, updated.nextRunAt.getTime(), reportId);
  } else {
    pipeline.zrem(REDIS_KEYS.dueQueue, reportId);
  }

  await pipeline.exec();

  log.info('Scheduled report updated', { reportId, updates });

  return updated;
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(reportId: string): Promise<boolean> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.report(reportId));

  if (!data) {
    return false;
  }

  const report = deserializeReport(JSON.parse(data));

  const pipeline = redis.pipeline();
  pipeline.del(REDIS_KEYS.report(reportId));
  pipeline.srem(REDIS_KEYS.orgReports(report.organizationId), reportId);
  pipeline.srem(REDIS_KEYS.allReports, reportId);
  pipeline.zrem(REDIS_KEYS.dueQueue, reportId);
  await pipeline.exec();

  log.info('Scheduled report deleted', { reportId });

  return true;
}

/**
 * Enable or disable a scheduled report
 */
export async function setReportEnabled(reportId: string, enabled: boolean): Promise<boolean> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.report(reportId));

  if (!data) {
    return false;
  }

  const report = deserializeReport(JSON.parse(data));
  report.enabled = enabled;
  report.updatedAt = new Date();

  // Recalculate next run if enabling
  if (enabled) {
    report.nextRunAt = calculateNextRunTime(report.schedule);
  }

  const serialized = serializeReport(report);

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.report(reportId), JSON.stringify(serialized));

  if (enabled && report.nextRunAt) {
    pipeline.zadd(REDIS_KEYS.dueQueue, report.nextRunAt.getTime(), reportId);
  } else {
    pipeline.zrem(REDIS_KEYS.dueQueue, reportId);
  }

  await pipeline.exec();

  log.info('Report enabled status changed', { reportId, enabled });

  return true;
}

/**
 * Get a scheduled report by ID
 */
export async function getScheduledReportById(reportId: string): Promise<ScheduledReport | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.report(reportId));

  if (!data) {
    return null;
  }

  return deserializeReport(JSON.parse(data));
}

/**
 * Get all scheduled reports for an organization
 */
export async function getScheduledReports(organizationId: string): Promise<ScheduledReport[]> {
  const redis = getRedis();
  const reportIds = await redis.smembers(REDIS_KEYS.orgReports(organizationId));

  if (reportIds.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();
  for (const id of reportIds) {
    pipeline.get(REDIS_KEYS.report(id));
  }
  const results = await pipeline.exec();

  const reports: ScheduledReport[] = [];
  for (const [err, data] of results || []) {
    if (!err && data) {
      reports.push(deserializeReport(JSON.parse(data as string)));
    }
  }

  return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get due reports that need to be executed
 */
export async function getDueReports(): Promise<ScheduledReport[]> {
  const redis = getRedis();
  const now = Date.now();

  // Get all reports due before now
  const reportIds = await redis.zrangebyscore(REDIS_KEYS.dueQueue, '-inf', now);

  if (reportIds.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();
  for (const id of reportIds) {
    pipeline.get(REDIS_KEYS.report(id));
  }
  const results = await pipeline.exec();

  const reports: ScheduledReport[] = [];
  for (const [err, data] of results || []) {
    if (!err && data) {
      const report = deserializeReport(JSON.parse(data as string));
      if (report.enabled) {
        reports.push(report);
      }
    }
  }

  return reports;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a scheduled report
 */
export async function executeScheduledReport(
  scheduledReport: ScheduledReport
): Promise<ReportDeliveryResult> {
  const startTime = Date.now();
  const redis = getRedis();

  log.info('Executing scheduled report', {
    reportId: scheduledReport.id,
    templateId: scheduledReport.templateId,
  });

  // Record execution start
  const execution = await saveReportExecution({
    scheduledReportId: scheduledReport.id,
    organizationId: scheduledReport.organizationId,
    templateId: scheduledReport.templateId,
    status: 'processing',
    format: scheduledReport.format,
  });

  try {
    // Generate the report
    const dateRange = getDateRangeFromPreset(scheduledReport.dateRangePreset);
    const reportData = await generateReport({
      templateId: scheduledReport.templateId,
      organizationId: scheduledReport.organizationId,
      dateRange,
    });

    // Export to requested format
    let exportBuffer: Buffer;
    let mimeType: string;
    let fileExtension: string;

    switch (scheduledReport.format) {
      case 'pdf':
        exportBuffer = await generatePDF(reportData);
        mimeType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      case 'excel':
        exportBuffer = await generateExcel(reportData);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;
      case 'csv':
        exportBuffer = await generateCSV(reportData);
        mimeType = 'text/csv';
        fileExtension = 'csv';
        break;
    }

    // Format period string for email
    const periodStr = `${formatDateForEmail(dateRange.start)} - ${formatDateForEmail(dateRange.end)}`;

    // Deliver to recipients
    const recipientResults = await deliverReport(
      scheduledReport,
      exportBuffer,
      mimeType,
      fileExtension,
      periodStr
    );

    // Update schedule
    await updateReportAfterExecution(scheduledReport);

    const successCount = recipientResults.filter((r) => r.success).length;
    const allSuccess = recipientResults.every((r) => r.success);
    const generationTimeMs = Date.now() - startTime;

    // Update execution status
    await updateExecutionStatus(execution.id, allSuccess ? 'completed' : 'partial', {
      generationTimeMs,
      fileSize: exportBuffer.length,
      recipientResults: recipientResults.map(r => ({
        recipient: { type: r.recipient.type, destination: r.recipient.destination },
        success: r.success,
        error: r.error,
      })),
    });

    log.info('Scheduled report executed', {
      reportId: scheduledReport.id,
      success: allSuccess,
      successCount,
      totalRecipients: recipientResults.length,
      duration: generationTimeMs,
    });

    return {
      scheduledReportId: scheduledReport.id,
      success: allSuccess,
      deliveredAt: new Date(),
      recipientResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update execution status to failed
    await updateExecutionStatus(execution.id, 'failed', {
      generationTimeMs: Date.now() - startTime,
      error: errorMessage,
    });

    log.error('Failed to execute scheduled report', {
      reportId: scheduledReport.id,
      error: errorMessage,
    });

    return {
      scheduledReportId: scheduledReport.id,
      success: false,
      deliveredAt: new Date(),
      error: errorMessage,
      recipientResults: [],
    };
  }
}

/**
 * Deliver report to all recipients
 */
async function deliverReport(
  scheduledReport: ScheduledReport,
  content: Buffer,
  mimeType: string,
  fileExtension: string,
  periodStr: string
): Promise<{ recipient: ReportRecipient; success: boolean; error?: string }[]> {
  const results: { recipient: ReportRecipient; success: boolean; error?: string }[] = [];

  for (const recipient of scheduledReport.recipients) {
    try {
      switch (recipient.type) {
        case 'email':
          await deliverByEmail(
            recipient,
            scheduledReport,
            content,
            mimeType,
            fileExtension,
            periodStr
          );
          break;
        case 'webhook':
          await deliverByWebhook(recipient, scheduledReport, content);
          break;
      }

      results.push({ recipient, success: true });
    } catch (error) {
      results.push({
        recipient,
        success: false,
        error: error instanceof Error ? error.message : 'Delivery failed',
      });
    }
  }

  return results;
}

/**
 * Deliver report via email using the email sender service
 */
async function deliverByEmail(
  recipient: ReportRecipient,
  scheduledReport: ScheduledReport,
  content: Buffer,
  mimeType: string,
  fileExtension: string,
  periodStr: string
): Promise<void> {
  log.info('Delivering report via email', {
    to: recipient.destination,
    reportName: scheduledReport.name,
  });

  const result = await sendReportEmail({
    to: recipient.destination,
    subject: `Informe: ${scheduledReport.name}`,
    reportName: scheduledReport.name,
    reportPeriod: periodStr,
    organizationName: 'CampoTech', // TODO: Get from organization settings
    attachment: {
      filename: `${sanitizeFilename(scheduledReport.name)}.${fileExtension}`,
      content,
      contentType: mimeType,
    },
  });

  if (!result.success) {
    throw new Error(result.error || 'Email delivery failed');
  }

  log.info('Email delivered successfully', {
    to: recipient.destination,
    messageId: result.messageId,
    provider: result.provider,
  });
}

/**
 * Deliver report via webhook
 */
async function deliverByWebhook(
  recipient: ReportRecipient,
  scheduledReport: ScheduledReport,
  content: Buffer
): Promise<void> {
  log.info('Delivering report via webhook', {
    url: recipient.destination,
    reportName: scheduledReport.name,
  });

  // POST to webhook URL
  const response = await fetch(recipient.destination, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CampoTech-Report-Id': scheduledReport.id,
      'X-CampoTech-Template-Id': scheduledReport.templateId,
    },
    body: JSON.stringify({
      reportId: scheduledReport.id,
      reportName: scheduledReport.name,
      templateId: scheduledReport.templateId,
      organizationId: scheduledReport.organizationId,
      generatedAt: new Date().toISOString(),
      content: content.toString('base64'),
      format: scheduledReport.format,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }

  log.info('Webhook delivered successfully', {
    url: recipient.destination,
    status: response.status,
  });
}

/**
 * Update report after execution
 */
async function updateReportAfterExecution(scheduledReport: ScheduledReport): Promise<void> {
  const redis = getRedis();
  const nextRunAt = calculateNextRunTime(scheduledReport.schedule);
  const now = new Date();

  // Update the scheduled report
  scheduledReport.lastRunAt = now;
  scheduledReport.nextRunAt = nextRunAt;
  scheduledReport.updatedAt = now;

  const serialized = serializeReport(scheduledReport);

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.report(scheduledReport.id), JSON.stringify(serialized));

  // Update due queue with new next run time
  if (nextRunAt) {
    pipeline.zadd(REDIS_KEYS.dueQueue, nextRunAt.getTime(), scheduledReport.id);
  } else {
    pipeline.zrem(REDIS_KEYS.dueQueue, scheduledReport.id);
  }

  await pipeline.exec();

  log.info('Report schedule updated after execution', {
    reportId: scheduledReport.id,
    lastRunAt: now,
    nextRunAt,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate next run time based on schedule
 */
export function calculateNextRunTime(schedule: ReportSchedule): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.type) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      // Set to the specified day of week
      const targetDay = schedule.dayOfWeek ?? 1; // Default to Monday
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;

      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }

      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      // Set to the specified day of month
      const targetDate = schedule.dayOfMonth ?? 1;
      next.setDate(targetDate);

      // If date has passed this month, move to next month
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
      }

      // Handle months with fewer days
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      if (targetDate > maxDay) {
        next.setDate(maxDay);
      }
      break;
  }

  return next;
}

/**
 * Get schedule description
 */
export function getScheduleDescription(schedule: ReportSchedule): string {
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  switch (schedule.type) {
    case 'daily':
      return `Diario a las ${schedule.time}`;
    case 'weekly':
      const dayName = dayNames[schedule.dayOfWeek ?? 1];
      return `Semanal, cada ${dayName} a las ${schedule.time}`;
    case 'monthly':
      return `Mensual, día ${schedule.dayOfMonth ?? 1} a las ${schedule.time}`;
    default:
      return 'Personalizado';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process all due scheduled reports
 * This should be called by a cron job every minute
 */
export async function processScheduledReports(): Promise<void> {
  log.info('Processing scheduled reports');

  const dueReports = await getDueReports();

  for (const report of dueReports) {
    try {
      await executeScheduledReport(report);
    } catch (error) {
      log.error('Error processing scheduled report', {
        reportId: report.id,
        error,
      });
    }
  }

  log.info('Scheduled reports processing complete', {
    processed: dueReports.length,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function generateId(): string {
  return `sr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Serialize report for Redis storage (convert dates to ISO strings)
 */
function serializeReport(report: ScheduledReport): Record<string, unknown> {
  return {
    ...report,
    lastRunAt: report.lastRunAt?.toISOString() || null,
    nextRunAt: report.nextRunAt?.toISOString() || null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

/**
 * Deserialize report from Redis storage (convert ISO strings to dates)
 */
function deserializeReport(data: Record<string, unknown>): ScheduledReport {
  return {
    ...data,
    lastRunAt: data.lastRunAt ? new Date(data.lastRunAt as string) : null,
    nextRunAt: data.nextRunAt ? new Date(data.nextRunAt as string) : null,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
  } as ScheduledReport;
}

/**
 * Format date for email display
 */
function formatDateForEmail(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Sanitize filename for safe file system usage
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}
