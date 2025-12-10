/**
 * Analytics Reports Module
 * ========================
 *
 * Phase 10.3: Report Generation Engine
 * Consolidated exports for all report-related functionality.
 */

// Report Generator
export { generateReport } from './report-generator';
export type {
  ReportData,
  ReportSection,
  ChartData,
  TableData,
  GenerateReportOptions,
} from './report-generator';

// Exporters
export { generatePDF } from './exporters/pdf-exporter';
export { generateExcel } from './exporters/excel-exporter';
export { generateCSV } from './exporters/csv-exporter';
export { sendReportEmail, configureEmailSender } from './exporters/email-sender';

// Scheduler
export {
  scheduleReport,
  updateScheduledReport,
  deleteScheduledReport,
  setReportEnabled,
  getScheduledReportById,
  getScheduledReports,
  getDueReports,
  executeScheduledReport,
  processScheduledReports,
  calculateNextRunTime,
  getScheduleDescription,
} from './scheduler/report-scheduler';

// Re-export scheduler types
export type {
  ScheduledReport,
  ReportSchedule,
  ReportRecipient,
  ScheduleReportInput,
  ReportDeliveryResult,
} from './scheduler/report-scheduler';

// Scheduling
export {
  initializeCronJobs,
  registerCronJob,
  startCronScheduler,
  stopCronScheduler,
  runJob,
  setJobEnabled,
  getRegisteredJobs,
  getJobStatus,
  calculateNextRun,
  isValidCronExpression,
  getCronDescription,
  CRON_JOBS,
} from './scheduling/cron-jobs';

export {
  queueDelivery,
  queueEmailDelivery,
  queueWebhookDelivery,
  processDeliveryQueue,
  getQueueStats,
  retryJob,
  cancelJob,
  cleanupOldJobs,
} from './scheduling/delivery-queue';

// History
export {
  saveReportExecution,
  updateExecutionStatus,
  getReportExecution,
  getReportHistory,
  getLatestExecution,
  getExecutionStats,
  cleanupOldExecutions,
  cleanupOldReportHistory,
} from './history/report-history';

// Templates
export {
  REPORT_TEMPLATES,
  REPORT_CATEGORIES,
  getAvailableTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getDateRangeFromPreset,
  getGranularityOptions,
} from './templates/report-templates';

export {
  TAX_REPORT_TEMPLATES,
  TAX_KPI_DEFINITIONS,
  AFIP_DOCUMENT_TYPES,
  IVA_RATES,
  IIBB_JURISDICTIONS,
  getTaxReportTemplates,
  getTaxReportTemplateById,
  formatCUIT,
  validateCUIT,
  getFiscalPeriod,
  formatTaxAmount,
} from './templates/tax-report.template';
