/**
 * Analytics Module
 * ================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Main entry point for the analytics module.
 */

// Types
export * from './analytics.types';

// Infrastructure
export * from './infrastructure/data-warehouse';
export * from './infrastructure/etl-pipeline';

// KPIs - Revenue
export {
  calculateRevenueMetrics,
  getRevenueTrend,
  getRevenueByServiceType,
  getRevenueByCustomerSegment,
  generateRevenueKPIs,
} from './kpis/revenue/revenue-metrics';

export {
  calculateMRR,
  getMRRTrend,
  calculateARPU,
  generateMRRKPIs,
} from './kpis/revenue/mrr-calculator';

// KPIs - Operations
export {
  calculateJobMetrics,
  getJobTrend,
  getJobsByServiceType,
  getJobsByStatus,
  getJobsByDayOfWeek,
  getJobsByHourOfDay,
  generateJobKPIs,
} from './kpis/operations/job-metrics';

export {
  calculateTechnicianPerformance,
  getAllTechnicianPerformance,
  calculateTeamEfficiency,
  calculateTechnicianRankings,
  generateTechnicianKPIs,
} from './kpis/operations/technician-efficiency';

// KPIs - Financial
export {
  calculateCashFlowMetrics,
  getCashFlowTrend,
  getAccountsReceivableAging,
  getOverdueInvoices,
  getPaymentMethodBreakdown,
  calculateDSO,
  generateFinancialKPIs,
} from './kpis/financial/cash-flow-analyzer';

// KPIs - Customers
export {
  calculateCustomerMetrics,
  calculateIndividualCLV,
  getCLVBySegment,
  getCohortAnalysis,
  getChurnRiskCustomers,
  getTopCustomersByCLV,
  generateCustomerKPIs,
} from './kpis/customers/customer-lifetime-value';

// Reports
export { generateReport } from './reports/report-generator';
export { generatePDF } from './reports/exporters/pdf-exporter';
export { generateExcel } from './reports/exporters/excel-exporter';
export { generateCSV } from './reports/exporters/csv-exporter';
export {
  REPORT_TEMPLATES,
  REPORT_CATEGORIES,
  getAvailableTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getDateRangeFromPreset,
} from './reports/templates/report-templates';

export {
  scheduleReport,
  updateScheduledReport,
  deleteScheduledReport,
  setReportEnabled,
  getScheduledReports,
  getDueReports,
  executeScheduledReport,
  processScheduledReports,
} from './reports/scheduler/report-scheduler';

// Predictions
export {
  forecastDemand,
  getPeakDemandPeriods,
} from './predictions/demand/demand-forecaster';

export {
  projectRevenue,
  getRevenueMilestones,
} from './predictions/revenue/revenue-projector';

export {
  predictChurn,
  getHighRiskCustomers,
} from './predictions/churn/churn-predictor';

export {
  detectAnomalies,
} from './predictions/anomaly/anomaly-detector';
