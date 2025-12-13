/**
 * Analytics Types
 * ================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Type definitions for the analytics system.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIME DIMENSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeDimension {
  date: Date;
  dayOfWeek: number;
  dayOfMonth: number;
  weekOfYear: number;
  month: number;
  quarter: number;
  year: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACT TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobFact {
  id: string;
  organizationId: string;
  jobId: string;
  customerId: string;
  technicianId: string | null;
  serviceType: string;
  locationId: string | null;
  createdAt: Date;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
  durationMinutes: number | null;
  travelTimeMinutes: number | null;
  estimatedAmount: number;
  actualAmount: number;
  isFirstTimeCustomer: boolean;
  isRepeatJob: boolean;
  satisfactionScore: number | null;
}

export interface InvoiceFact {
  id: string;
  organizationId: string;
  invoiceId: string;
  customerId: string;
  jobId: string | null;
  invoiceType: 'A' | 'B' | 'C' | 'E';
  createdAt: Date;
  dueDate: Date;
  paidAt: Date | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: string;
  daysToPayment: number | null;
  paymentMethod: string | null;
}

export interface PaymentFact {
  id: string;
  organizationId: string;
  paymentId: string;
  invoiceId: string;
  customerId: string;
  receivedAt: Date;
  amount: number;
  method: string;
  processingFee: number;
  netAmount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerDimension {
  customerId: string;
  organizationId: string;
  name: string;
  taxCondition: string;
  city: string | null;
  province: string | null;
  customerSince: Date;
  totalJobs: number;
  totalRevenue: number;
  averageJobValue: number;
  lastJobAt: Date | null;
  segment: 'new' | 'active' | 'loyal' | 'at_risk' | 'churned';
}

export interface TechnicianDimension {
  technicianId: string;
  organizationId: string;
  name: string;
  role: string;
  specialty: string | null;
  skillLevel: string | null;
  hiredAt: Date;
  totalJobs: number;
  completedJobs: number;
  averageRating: number | null;
  efficiency: number; // Jobs per day
}

export interface ServiceDimension {
  serviceType: string;
  organizationId: string;
  displayName: string;
  category: string;
  averagePrice: number;
  averageDuration: number;
  popularityRank: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface KPIValue {
  value: number;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  trend: 'up' | 'down' | 'stable';
  updatedAt: Date;
  name?: string;
  unit?: 'number' | 'currency' | 'percentage' | 'duration';
}

export interface KPIResult {
  id: string;
  name: string;
  value: number;
  unit: 'number' | 'currency' | 'percentage' | 'duration';
  trend: 'up' | 'down' | 'stable';
  changePercent?: number;
  period: DateRange;
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: 'revenue' | 'operations' | 'financial' | 'customer';
  format: 'number' | 'currency' | 'percent' | 'duration';
  higherIsBetter: boolean;
  targetValue?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

// Revenue KPIs
export interface RevenueKPIs {
  totalRevenue: KPIValue;
  monthlyRecurringRevenue: KPIValue;
  averageRevenuePerUser: KPIValue;
  revenueByServiceType: Record<string, KPIValue>;
  revenueGrowthRate: KPIValue;
}

// Operations KPIs
export interface OperationsKPIs {
  jobsCompleted: KPIValue;
  jobsPerDay: KPIValue;
  completionRate: KPIValue;
  averageTimeOnSite: KPIValue;
  averageResponseTime: KPIValue;
  firstTimeFixRate: KPIValue;
}

// Financial KPIs
export interface FinancialKPIs {
  grossMargin: KPIValue;
  collectionRate: KPIValue;
  daysSalesOutstanding: KPIValue;
  cashFlow: KPIValue;
  overdueAmount: KPIValue;
}

// Customer KPIs
export interface CustomerKPIs {
  totalCustomers: KPIValue;
  newCustomers: KPIValue;
  customerRetentionRate: KPIValue;
  repeatCustomerRate: KPIValue;
  averageCustomerLifetimeValue: KPIValue;
  customerSatisfactionScore: KPIValue;
  churnRate: KPIValue;
}

// Technician KPIs
export interface TechnicianKPIs {
  technicianId: string;
  name: string;
  jobsCompleted: number;
  averageJobDuration: number;
  efficiency: number;
  onTimeArrivalRate: number;
  customerRating: number | null;
  revenue: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AggregatedMetric {
  period: string;
  granularity: TimeGranularity;
  organizationId: string;
  metric: string;
  value: number;
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  metric: string;
  granularity: TimeGranularity;
  data: TimeSeriesDataPoint[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ReportFormat = 'pdf' | 'excel' | 'csv';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'once';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: ReportSection[];
  defaultFilters: ReportFilter[];
  supportedFormats: ReportFormat[];
  defaultDateRange?: 'week' | 'month' | 'quarter' | 'year';
  defaultGranularity?: 'day' | 'week' | 'month';
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'kpi_cards' | 'kpi_grid' | 'table' | 'chart' | 'text';
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'doughnut';
  dataSource?: string;
  kpis?: string[];
  config?: Record<string, unknown>;
}

export interface ReportFilter {
  field: string;
  label: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text';
  required: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
}

export interface ScheduledReport {
  id: string;
  organizationId: string;
  templateId: string;
  name: string;
  frequency: ReportFrequency;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  hour: number; // 0-23
  timezone: string;
  format: ReportFormat;
  recipients: string[];
  filters: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  createdBy: string;
}

export interface GeneratedReport {
  id: string;
  organizationId: string;
  templateId: string;
  scheduledReportId: string | null;
  name: string;
  format: ReportFormat;
  filters: Record<string, unknown>;
  fileUrl: string;
  fileSizeBytes: number;
  generatedAt: Date;
  generatedBy: string | null;
  expiresAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DemandForecast {
  date: Date;
  expectedJobs: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  factors: string[];
}

export interface RevenueProjection {
  month: Date;
  projectedRevenue: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  growthRate: number;
}

export interface ChurnRiskScore {
  customerId: string;
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  lastUpdated: Date;
}

export interface ChurnFactor {
  name: string;
  impact: number; // -1 to 1
  description: string;
}

export interface Anomaly {
  id: string;
  type: 'revenue' | 'operations' | 'operational' | 'payment' | 'behavior';
  severity: 'critical' | 'warning' | 'info' | 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  affectedEntity?: string;
  metric?: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  isResolved?: boolean;
  possibleCauses?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyticsDashboardData {
  period: DateRange;
  revenue: RevenueKPIs;
  operations: OperationsKPIs;
  financial: FinancialKPIs;
  customers: CustomerKPIs;
  topTechnicians: TechnicianKPIs[];
  revenueTimeSeries: TimeSeriesData;
  jobsTimeSeries: TimeSeriesData;
}

export interface AnalyticsQueryParams {
  organizationId: string;
  dateRange: DateRange;
  granularity?: TimeGranularity;
  technicianIds?: string[];
  serviceTypes?: string[];
  locationIds?: string[];
  compareWithPrevious?: boolean;
}
