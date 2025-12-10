/**
 * Analytics Module
 * ================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Main entry point for the analytics module.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export * from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE - Phase 10.1 Data Infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

// Data Warehouse (Star Schema)
export {
  getJobFacts,
  getInvoiceFacts,
  getPaymentFacts,
  getCustomerDimension,
  getTechnicianDimension,
  getServiceDimension,
  getAggregatedRevenue,
  getAggregatedJobs,
} from './infrastructure/data-warehouse';

// ETL Pipeline
export {
  runFullETL,
  runIncrementalETL,
  getETLStatus,
  getLastAnalyticsUpdate,
  getCachedDimension,
  getFactSummary,
  cleanupOldData,
  ETL_CONFIG,
  type ETLStatus,
} from './infrastructure/etl-pipeline';

// Aggregation Jobs
export {
  AGGREGATION_JOBS,
  runAggregationJob,
  getAggregationJobStatus,
  scheduleAggregationJobs,
  runDueAggregationJobs,
  type AggregationJob,
  type AggregationJobStatus,
} from './infrastructure/aggregation-jobs';

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTORS - Phase 10.1 Data Collection
// ═══════════════════════════════════════════════════════════════════════════════

// Event Collector
export {
  collectEvent,
  collectJobCreated,
  collectJobCompleted,
  collectInvoiceCreated,
  collectInvoicePaid,
  collectPaymentReceived,
  collectCustomerCreated,
  collectCustomerUpdated,
  flushEvents,
  processEventQueue,
  getEventQueueStats,
  type AnalyticsEvent,
  type EventType,
} from './collectors/event-collector';

// Metrics Aggregator
export {
  aggregateMetrics,
  getAggregatedMetric,
  getAllAggregatedMetrics,
  METRIC_DEFINITIONS,
  type MetricDefinition,
  type AggregatedMetricResult,
} from './collectors/metrics-aggregator';

// Time Series Storage
export {
  writePoint,
  writePoints,
  queryTimeSeries,
  downsample,
  getLatestValue,
  deleteTimeSeries,
  type TimeSeriesPoint,
  type TimeSeriesQuery,
  type TimeSeriesResult,
  type DownsampleConfig,
} from './collectors/time-series-storage';

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS - Phase 10.1 Star Schema Models
// ═══════════════════════════════════════════════════════════════════════════════

// KPI Definitions
export {
  KPI_REGISTRY,
  getKPIDefinition,
  getKPIsByCategory,
  getAllKPIs,
  calculateKPIStatus,
  formatKPIValue,
  type KPIDefinition,
  type KPICategory,
  type KPIStatus,
} from './models/kpi-definitions';

// Dimension Tables
export {
  getCustomerDimensionById,
  getAllCustomerDimensions,
  getTechnicianDimensionById,
  getAllTechnicianDimensions,
  getServiceDimensionByType,
  getAllServiceDimensions,
  getLocationDimensionById,
  getAllLocationDimensions,
  getTimeDimension,
  refreshAllDimensions,
  type CachedCustomerDimension,
  type CachedTechnicianDimension,
  type CachedServiceDimension,
  type CachedLocationDimension,
  type TimeDimension,
} from './models/dimension-tables';

// Fact Tables
export {
  queryJobFacts,
  queryInvoiceFacts,
  queryPaymentFacts,
  getJobFactsSummary,
  getInvoiceFactsSummary,
  getPaymentFactsSummary,
  getRevenueByDimension,
  getJobsByDimension,
  type JobFactQuery,
  type InvoiceFactQuery,
  type PaymentFactQuery,
  type FactSummary,
  type DimensionalBreakdown,
} from './models/fact-tables';

// ═══════════════════════════════════════════════════════════════════════════════
// KPIs - Revenue (Phase 10.2)
// ═══════════════════════════════════════════════════════════════════════════════

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

export {
  calculateARPUMetrics,
  getARPUBySegment,
  getARPUByServiceType,
  getARPUTrend,
  getCustomerRevenueDistribution,
  generateARPUKPIs,
} from './kpis/revenue/arpu-calculator';

// ═══════════════════════════════════════════════════════════════════════════════
// KPIs - Operations (Phase 10.2)
// ═══════════════════════════════════════════════════════════════════════════════

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

export {
  DEFAULT_SLAS,
  calculateSLACompliance,
  getSLAByUrgency,
  getSLAByServiceType,
  getSLAViolations,
  getSLATrend,
  generateSLAKPIs,
} from './kpis/operations/sla-compliance';

// ═══════════════════════════════════════════════════════════════════════════════
// KPIs - Financial (Phase 10.2)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  calculateCashFlowMetrics,
  getCashFlowTrend,
  getAccountsReceivableAging,
  getOverdueInvoices,
  getPaymentMethodBreakdown,
  calculateDSO,
  generateFinancialKPIs,
} from './kpis/financial/cash-flow-analyzer';

export {
  calculateProfitability,
  getProfitabilityByServiceType,
  getProfitabilityByTechnician,
  getProfitabilityByCustomer,
  getProfitabilityTrend,
  getCostBreakdown,
  generateProfitabilityKPIs,
} from './kpis/financial/profitability-calculator';

export {
  IVA_RATES,
  calculateTaxSummary,
  generateLibroIVA,
  formatLibroIVAForExport,
  getMonthlyTaxTrend,
  getTaxConditionBreakdown,
  generateCITIVentas,
  generateTaxKPIs,
} from './kpis/financial/tax-summary';

// ═══════════════════════════════════════════════════════════════════════════════
// KPIs - Customers (Phase 10.2)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  calculateCustomerMetrics,
  calculateIndividualCLV,
  getCLVBySegment,
  getCohortAnalysis,
  getChurnRiskCustomers,
  getTopCustomersByCLV,
  generateCustomerKPIs,
} from './kpis/customers/customer-lifetime-value';

export {
  calculateSatisfactionMetrics,
  getSatisfactionByCategory,
  getSatisfactionByServiceType,
  getSatisfactionByTechnician,
  getSatisfactionTrend,
  generateSatisfactionKPIs,
} from './kpis/customers/satisfaction-scorer';

export {
  SEGMENT_DEFINITIONS,
  segmentCustomers,
  calculateRFMScores,
  getSegmentTrend,
  getCustomerProfiles,
  getSegmentRecommendations,
  generateSegmentKPIs,
} from './kpis/customers/segment-analyzer';

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS - Phase 10.3
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTIONS - Phase 10.5
// ═══════════════════════════════════════════════════════════════════════════════

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
