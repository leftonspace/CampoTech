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
  getAggregationJobStatuses,
  runAllAggregationJobs,
  cleanupOldAggregatedData,
  type AggregationJobConfig,
  type AggregationJobStatus,
  type AggregationJobResult,
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
  collectCustomerFirstJob,
  flushEvents,
  processEventQueue,
  getEventCollectorStats,
  type AnalyticsEvent,
  type EventType,
} from './collectors/event-collector';

// Metrics Aggregator
export {
  aggregateMetrics,
  getMetricDefinition,
  getMetricsByCategory,
  getAllMetricNames,
  METRIC_DEFINITIONS,
  type MetricDefinition,
  type AggregatedResult,
  type AggregationOptions,
} from './collectors/metrics-aggregator';

// Time Series Storage
export {
  writePoint,
  writePoints,
  writeAggregatedPoint,
  queryTimeSeries,
  downsample,
  getLatestValue,
  getDataForPeriod,
  getDataRange,
  runAutoDownsample,
  cleanupExpiredData,
  getStorageStats,
  type TimeSeriesPoint,
  type TimeSeriesQuery,
  type TimeSeriesConfig,
  type TimeSeriesWriteResult,
  type TimeSeriesDownsampleResult,
} from './collectors/time-series-storage';

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS - Phase 10.1 Star Schema Models
// ═══════════════════════════════════════════════════════════════════════════════

// KPI Definitions
export {
  KPI_REGISTRY,
  KPI_GROUPS,
  getKPIDefinition,
  getKPIsByCategory,
  getKPIsForGroup,
  getAllKPIGroups,
  getAllKPIIds,
  evaluateKPIStatus,
  calculateTrend,
  formatKPIValue,
  getBenchmarkComparison,
  type KPIConfig,
  type KPIGroup,
  type KPICalculationContext,
} from './models/kpi-definitions';

// Dimension Tables
export {
  generateTimeDimension,
  getTimeDimensionForDate,
  getCustomerDimension,
  getCustomerById,
  getCustomersBySegment,
  getTechnicianDimension,
  getTechnicianById,
  getTechniciansByEfficiency,
  getServiceDimension,
  getServiceByType,
  getLocationDimension,
  refreshAllDimensions,
  clearDimensionCache,
  type LocationDimension,
  type DimensionRefreshResult,
} from './models/dimension-tables';

// Fact Tables
export {
  getJobFacts,
  getJobFactsCount,
  getJobFactsByPeriod,
  getInvoiceFacts,
  getInvoiceFactsCount,
  getInvoiceFactsByPeriod,
  getPaymentFacts,
  getPaymentFactsCount,
  getPaymentFactsByPeriod,
  getRevenueSummary,
  getOperationsSummary,
  getCollectionSummary,
  syncAllFacts,
  type FactQueryOptions,
  type FactSyncResult,
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

// Report Generator
export { generateReport } from './reports/report-generator';
export type {
  ReportData,
  ReportSection,
  ChartData,
  TableData,
  GenerateReportOptions,
} from './reports/report-generator';

// Exporters
export { generatePDF } from './reports/exporters/pdf-exporter';
export { generateExcel } from './reports/exporters/excel-exporter';
export { generateCSV } from './reports/exporters/csv-exporter';
export { sendReportEmail, configureEmailSender } from './reports/exporters/email-sender';

// Templates
export {
  REPORT_TEMPLATES,
  REPORT_CATEGORIES,
  getAvailableTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getDateRangeFromPreset,
  getGranularityOptions,
} from './reports/templates/report-templates';

export {
  TAX_REPORT_TEMPLATES,
  getTaxReportTemplates,
  getTaxReportTemplateById,
  formatCUIT,
  validateCUIT,
  getFiscalPeriod,
  formatTaxAmount,
} from './reports/templates/tax-report.template';

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
} from './reports/scheduler/report-scheduler';

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
} from './reports/scheduling/cron-jobs';

// Delivery Queue
export {
  queueDelivery,
  queueEmailDelivery,
  queueWebhookDelivery,
  processDeliveryQueue,
  getQueueStats,
  retryJob as retryDeliveryJob,
  cancelJob as cancelDeliveryJob,
  cleanupOldJobs as cleanupOldDeliveryJobs,
} from './reports/scheduling/delivery-queue';

// Report History
export {
  saveReportExecution,
  updateExecutionStatus,
  getReportExecution,
  getReportHistory,
  getLatestExecution,
  getExecutionStats,
  cleanupOldExecutions,
  cleanupOldReportHistory,
} from './reports/history/report-history';

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTIONS - Phase 10.5
// ═══════════════════════════════════════════════════════════════════════════════

// Demand Forecasting
export {
  forecastDemand,
  getPeakDemandPeriods,
} from './predictions/demand/demand-forecaster';
export type {
  DemandForecast,
  DemandPattern,
  SeasonalPattern,
  ForecastResult,
} from './predictions/demand/demand-forecaster';

// Revenue Projections
export {
  projectRevenue,
  getRevenueMilestones,
} from './predictions/revenue/revenue-projector';
export type {
  RevenueProjection,
  GrowthScenario,
  ProjectionResult,
  ProjectionFactor,
} from './predictions/revenue/revenue-projector';

// Churn Prediction
export {
  predictChurn,
  getHighRiskCustomers,
} from './predictions/churn/churn-predictor';
export type {
  ChurnPrediction,
  ChurnFactor,
  ChurnAnalysis,
} from './predictions/churn/churn-predictor';

// Anomaly Detection
export {
  detectAnomalies,
} from './predictions/anomaly/anomaly-detector';
export type {
  AnomalyDetectionResult,
  MetricBaseline,
} from './predictions/anomaly/anomaly-detector';

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION ANALYTICS - Phase 11.6
// ═══════════════════════════════════════════════════════════════════════════════

// Location Performance
export {
  calculateLocationKPIs,
  getLocationPerformanceTrend,
  getLocationDailyMetrics,
  getLocationServiceTypeBreakdown,
  generateLocationKPIValues,
} from './locations/location-performance';
export type {
  LocationKPIs,
  LocationPerformanceTrend,
  LocationDailyMetrics,
  LocationServiceTypeBreakdown,
} from './locations/location-performance';

// Location Comparison
export {
  generateLocationComparisonReport,
  getLocationBenchmarks,
  compareLocations,
} from './locations/location-comparison';
export type {
  LocationComparisonReport,
  LocationComparisonEntry,
  LocationRankings,
  RankingEntry,
  ComparisonInsight,
  LocationBenchmark,
} from './locations/location-comparison';

// Geographic Analytics
export {
  generateJobsHeatmap,
  generateRevenueHeatmap,
  generateResponseTimeHeatmap,
  getGeographicPerformance,
  generateServiceDensityMap,
  analyzeCoverage,
} from './locations/geographic-analytics';
export type {
  GeoCoordinate,
  GeoBounds,
  HeatmapPoint,
  HeatmapData,
  GeographicPerformance,
  ZonePerformance,
  ServiceDensityMap,
  DensityCell,
  CoverageAnalysis,
  CoverageGap,
  OverlappingArea,
} from './locations/geographic-analytics';

// Expansion Analysis
export {
  analyzeExpansionOpportunities,
  calculateLocationSaturation,
  identifyMarketPotential,
} from './locations/expansion-analyzer';
export type {
  ExpansionOpportunity,
  ExpansionAnalysis,
  ExpansionAction,
  RiskAssessment,
  RiskFactor,
  MarketPotential,
  LocationSaturation,
} from './locations/expansion-analyzer';
