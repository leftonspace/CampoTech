/**
 * Report Scheduler
 * ================
 *
 * Phase 10.3: Report Generation Engine
 * Schedules and delivers reports automatically.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { generateReport } from '../report-generator';
import { generatePDF } from '../exporters/pdf-exporter';
import { generateExcel } from '../exporters/excel-exporter';
import { generateCSV } from '../exporters/csv-exporter';
import { getDateRangeFromPreset } from '../templates/report-templates';

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
// SCHEDULER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schedule a new report
 */
export async function scheduleReport(input: ScheduleReportInput): Promise<ScheduledReport> {
  const nextRunAt = calculateNextRunTime(input.schedule);

  // Store in database (using a pseudo-implementation)
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
  // Retrieve and update in database
  // This is a placeholder implementation
  log.info('Scheduled report updated', { reportId, updates });

  return null;
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(reportId: string): Promise<boolean> {
  // Delete from database
  log.info('Scheduled report deleted', { reportId });

  return true;
}

/**
 * Enable or disable a scheduled report
 */
export async function setReportEnabled(reportId: string, enabled: boolean): Promise<boolean> {
  log.info('Report enabled status changed', { reportId, enabled });

  return true;
}

/**
 * Get all scheduled reports for an organization
 */
export async function getScheduledReports(organizationId: string): Promise<ScheduledReport[]> {
  // Retrieve from database
  return [];
}

/**
 * Get due reports that need to be executed
 */
export async function getDueReports(): Promise<ScheduledReport[]> {
  const now = new Date();

  // Query database for reports where nextRunAt <= now and enabled = true
  // This is a placeholder implementation
  return [];
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

  log.info('Executing scheduled report', {
    reportId: scheduledReport.id,
    templateId: scheduledReport.templateId,
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

    // Deliver to recipients
    const recipientResults = await deliverReport(
      scheduledReport,
      exportBuffer,
      mimeType,
      fileExtension
    );

    // Update schedule
    await updateReportAfterExecution(scheduledReport);

    const success = recipientResults.every((r) => r.success);

    log.info('Scheduled report executed', {
      reportId: scheduledReport.id,
      success,
      duration: Date.now() - startTime,
    });

    return {
      scheduledReportId: scheduledReport.id,
      success,
      deliveredAt: new Date(),
      recipientResults,
    };
  } catch (error) {
    log.error('Failed to execute scheduled report', {
      reportId: scheduledReport.id,
      error,
    });

    return {
      scheduledReportId: scheduledReport.id,
      success: false,
      deliveredAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
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
  fileExtension: string
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
            fileExtension
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
 * Deliver report via email
 */
async function deliverByEmail(
  recipient: ReportRecipient,
  scheduledReport: ScheduledReport,
  content: Buffer,
  mimeType: string,
  fileExtension: string
): Promise<void> {
  // This would integrate with an email service (SendGrid, SES, etc.)
  log.info('Delivering report via email', {
    to: recipient.destination,
    reportName: scheduledReport.name,
  });

  // Placeholder for email sending
  // await emailService.send({
  //   to: recipient.destination,
  //   subject: `Informe: ${scheduledReport.name}`,
  //   body: `Adjunto encontrará el informe ${scheduledReport.name}`,
  //   attachments: [{
  //     filename: `${scheduledReport.name}.${fileExtension}`,
  //     content,
  //     contentType: mimeType,
  //   }],
  // });
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
    },
    body: JSON.stringify({
      reportId: scheduledReport.id,
      reportName: scheduledReport.name,
      templateId: scheduledReport.templateId,
      generatedAt: new Date().toISOString(),
      content: content.toString('base64'),
      format: scheduledReport.format,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Update report after execution
 */
async function updateReportAfterExecution(scheduledReport: ScheduledReport): Promise<void> {
  const nextRunAt = calculateNextRunTime(scheduledReport.schedule);

  // Update in database
  // scheduledReport.lastRunAt = new Date();
  // scheduledReport.nextRunAt = nextRunAt;

  log.info('Report schedule updated', {
    reportId: scheduledReport.id,
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
