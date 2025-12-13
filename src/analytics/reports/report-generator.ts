/**
 * Report Generator
 * ================
 *
 * Phase 10.3: Report Generation Engine
 * Orchestrates data collection and report generation.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { DateRange, ReportTemplate, KPIValue, TimeGranularity } from '../analytics.types';
import { getTemplateById, getDateRangeFromPreset } from './templates/report-templates';

// KPI generators
import { generateRevenueKPIs, getRevenueTrend, getRevenueByServiceType } from '../kpis/revenue/revenue-metrics';
import { generateMRRKPIs, getMRRTrend } from '../kpis/revenue/mrr-calculator';
import { generateJobKPIs, getJobTrend, getJobsByServiceType, getJobsByStatus, getJobsByDayOfWeek } from '../kpis/operations/job-metrics';
import { generateTechnicianKPIs, getAllTechnicianPerformance, calculateTechnicianRankings } from '../kpis/operations/technician-efficiency';
import { generateFinancialKPIs, getCashFlowTrend, getAccountsReceivableAging, getPaymentMethodBreakdown, getOverdueInvoices } from '../kpis/financial/cash-flow-analyzer';
import { generateCustomerKPIs, getCLVBySegment, getCohortAnalysis, getChurnRiskCustomers, getTopCustomersByCLV } from '../kpis/customers/customer-lifetime-value';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReportData {
  templateId: string;
  templateName: string;
  organizationId: string;
  dateRange: DateRange;
  granularity: TimeGranularity;
  generatedAt: Date;
  sections: ReportSection[];
  metadata: {
    totalRecords: number;
    generationTimeMs: number;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'kpi_grid' | 'chart' | 'table';
  data: KPIValue[] | ChartData | TableData;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface TableData {
  columns: {
    key: string;
    label: string;
    type: 'string' | 'number' | 'currency' | 'percentage' | 'date';
  }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

export interface GenerateReportOptions {
  templateId: string;
  organizationId: string;
  dateRange?: DateRange;
  dateRangePreset?: string;
  granularity?: TimeGranularity;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete report from a template
 */
export async function generateReport(options: GenerateReportOptions): Promise<ReportData> {
  const startTime = Date.now();

  const template = getTemplateById(options.templateId);
  if (!template) {
    throw new Error(`Template not found: ${options.templateId}`);
  }

  // Determine date range
  const dateRange = options.dateRange ||
    (options.dateRangePreset ? getDateRangeFromPreset(options.dateRangePreset) : getDateRangeFromPreset(template.defaultDateRange));

  const granularity = options.granularity || template.defaultGranularity;

  log.info('Generating report', {
    templateId: options.templateId,
    organizationId: options.organizationId,
    dateRange,
    granularity,
  });

  // Generate sections
  const sections: ReportSection[] = [];
  let totalRecords = 0;

  for (const sectionDef of template.sections) {
    try {
      const sectionData = await generateSectionData(
        sectionDef,
        options.organizationId,
        dateRange,
        granularity
      );

      sections.push({
        id: sectionDef.id,
        title: sectionDef.title,
        type: sectionDef.type,
        data: sectionData,
      });

      // Count records
      if (Array.isArray(sectionData)) {
        totalRecords += sectionData.length;
      } else if ('rows' in sectionData) {
        totalRecords += sectionData.rows.length;
      } else if ('datasets' in sectionData) {
        totalRecords += sectionData.datasets.reduce((sum, ds) => sum + ds.data.length, 0);
      }
    } catch (err) {
      log.error('Error generating section', { sectionId: sectionDef.id, error: err });
      // Continue with other sections
    }
  }

  const generationTimeMs = Date.now() - startTime;

  return {
    templateId: template.id,
    templateName: template.name,
    organizationId: options.organizationId,
    dateRange,
    granularity,
    generatedAt: new Date(),
    sections,
    metadata: {
      totalRecords,
      generationTimeMs,
    },
  };
}

/**
 * Generate data for a single report section
 */
async function generateSectionData(
  sectionDef: ReportTemplate['sections'][0],
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<KPIValue[] | ChartData | TableData> {
  switch (sectionDef.type) {
    case 'kpi_grid':
      return generateKPIData(sectionDef.kpis || [], organizationId, dateRange);

    case 'chart':
      return generateChartData(
        sectionDef.dataSource || '',
        sectionDef.chartType || 'line',
        organizationId,
        dateRange,
        granularity
      );

    case 'table':
      return generateTableData(sectionDef.dataSource || '', organizationId, dateRange);

    default:
      return [];
  }
}

/**
 * Generate KPI data
 */
async function generateKPIData(
  kpiIds: string[],
  organizationId: string,
  dateRange: DateRange
): Promise<KPIValue[]> {
  // Collect all KPIs from different generators
  const [
    revenueKPIs,
    mrrKPIs,
    jobKPIs,
    techKPIs,
    financialKPIs,
    customerKPIs,
  ] = await Promise.all([
    generateRevenueKPIs(organizationId, dateRange),
    generateMRRKPIs(organizationId),
    generateJobKPIs(organizationId, dateRange),
    generateTechnicianKPIs(organizationId, dateRange),
    generateFinancialKPIs(organizationId, dateRange),
    generateCustomerKPIs(organizationId, dateRange),
  ]);

  const allKPIs = [
    ...revenueKPIs,
    ...mrrKPIs,
    ...jobKPIs,
    ...techKPIs,
    ...financialKPIs,
    ...customerKPIs,
  ];

  // Filter to requested KPIs
  return kpiIds.map((id) => {
    const kpi = allKPIs.find((k) => k.id === id);
    if (kpi) return kpi;

    // Return placeholder for missing KPIs
    return {
      id,
      name: id,
      value: 0,
      unit: 'number',
      trend: 'stable' as const,
      period: dateRange,
    };
  });
}

/**
 * Generate chart data
 */
async function generateChartData(
  dataSource: string,
  chartType: 'line' | 'bar' | 'pie' | 'area',
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<ChartData> {
  switch (dataSource) {
    case 'revenue_trend': {
      const data = await getRevenueTrend(organizationId, dateRange, granularity);
      return {
        type: chartType,
        labels: data.map((d) => d.period),
        datasets: [
          {
            label: 'Ingresos',
            data: data.map((d) => d.revenue),
            color: '#16a34a',
          },
        ],
      };
    }

    case 'revenue_by_service': {
      const data = await getRevenueByServiceType(organizationId, dateRange);
      return {
        type: 'pie',
        labels: data.map((d) => d.serviceType),
        datasets: [
          {
            label: 'Ingresos',
            data: data.map((d) => d.revenue),
          },
        ],
      };
    }

    case 'job_trend': {
      const data = await getJobTrend(organizationId, dateRange, granularity);
      return {
        type: chartType,
        labels: data.map((d) => d.period),
        datasets: [
          {
            label: 'Total',
            data: data.map((d) => d.total),
            color: '#3b82f6',
          },
          {
            label: 'Completados',
            data: data.map((d) => d.completed),
            color: '#22c55e',
          },
        ],
      };
    }

    case 'jobs_by_service': {
      const data = await getJobsByServiceType(organizationId, dateRange);
      return {
        type: 'bar',
        labels: data.map((d) => d.serviceType),
        datasets: [
          {
            label: 'Cantidad',
            data: data.map((d) => d.count),
            color: '#8b5cf6',
          },
        ],
      };
    }

    case 'jobs_by_status': {
      const data = await getJobsByStatus(organizationId, dateRange);
      return {
        type: 'pie',
        labels: data.map((d) => d.status),
        datasets: [
          {
            label: 'Cantidad',
            data: data.map((d) => d.count),
          },
        ],
      };
    }

    case 'jobs_by_day': {
      const data = await getJobsByDayOfWeek(organizationId, dateRange);
      return {
        type: 'bar',
        labels: data.map((d) => d.name),
        datasets: [
          {
            label: 'Cantidad',
            data: data.map((d) => d.count),
            color: '#f59e0b',
          },
        ],
      };
    }

    case 'cash_flow_trend': {
      const data = await getCashFlowTrend(organizationId, dateRange, granularity);
      return {
        type: chartType,
        labels: data.map((d) => d.period),
        datasets: [
          {
            label: 'Ingresos',
            data: data.map((d) => d.inflow),
            color: '#22c55e',
          },
          {
            label: 'Neto',
            data: data.map((d) => d.net),
            color: '#3b82f6',
          },
        ],
      };
    }

    case 'ar_aging': {
      const data = await getAccountsReceivableAging(organizationId);
      return {
        type: 'bar',
        labels: ['Corriente', '31-60 días', '61-90 días', '90+ días'],
        datasets: [
          {
            label: 'Monto',
            data: [data.current, data.overdue30, data.overdue60, data.overdue90Plus],
          },
        ],
      };
    }

    case 'payment_breakdown': {
      const data = await getPaymentMethodBreakdown(organizationId, dateRange);
      return {
        type: 'pie',
        labels: data.map((d) => d.method),
        datasets: [
          {
            label: 'Monto',
            data: data.map((d) => d.amount),
          },
        ],
      };
    }

    case 'clv_by_segment': {
      const data = await getCLVBySegment(organizationId);
      return {
        type: 'bar',
        labels: data.map((d) => d.segment),
        datasets: [
          {
            label: 'CLV Promedio',
            data: data.map((d) => d.avgCLV),
            color: '#8b5cf6',
          },
        ],
      };
    }

    case 'technician_efficiency': {
      const performances = await getAllTechnicianPerformance(organizationId, dateRange);
      return {
        type: 'bar',
        labels: performances.map((p) => p.name),
        datasets: [
          {
            label: 'Trabajos Completados',
            data: performances.map((p) => p.completedJobs),
            color: '#22c55e',
          },
          {
            label: 'Eficiencia',
            data: performances.map((p) => p.efficiency * 100),
            color: '#3b82f6',
          },
        ],
      };
    }

    case 'top_services': {
      const data = await getJobsByServiceType(organizationId, dateRange);
      const top5 = data.slice(0, 5);
      return {
        type: 'bar',
        labels: top5.map((d) => d.serviceType),
        datasets: [
          {
            label: 'Cantidad',
            data: top5.map((d) => d.count),
            color: '#16a34a',
          },
        ],
      };
    }

    default:
      return {
        type: chartType,
        labels: [],
        datasets: [],
      };
  }
}

/**
 * Generate table data
 */
async function generateTableData(
  dataSource: string,
  organizationId: string,
  dateRange: DateRange
): Promise<TableData> {
  switch (dataSource) {
    case 'top_customers_by_revenue':
    case 'top_customers_clv': {
      const data = await getTopCustomersByCLV(organizationId, 10);
      return {
        columns: [
          { key: 'name', label: 'Cliente', type: 'string' },
          { key: 'clv', label: 'CLV', type: 'currency' },
          { key: 'totalJobs', label: 'Trabajos', type: 'number' },
          { key: 'avgJobValue', label: 'Ticket Prom.', type: 'currency' },
          { key: 'customerSince', label: 'Cliente desde', type: 'date' },
        ],
        rows: data.map((c) => ({
          name: c.name,
          clv: c.clv,
          totalJobs: c.totalJobs,
          avgJobValue: c.avgJobValue,
          customerSince: c.customerSince,
        })),
        totals: {
          clv: data.reduce((sum, c) => sum + c.clv, 0),
          totalJobs: data.reduce((sum, c) => sum + c.totalJobs, 0),
        },
      };
    }

    case 'overdue_invoices': {
      const data = await getOverdueInvoices(organizationId, 20);
      return {
        columns: [
          { key: 'customerName', label: 'Cliente', type: 'string' },
          { key: 'amount', label: 'Monto', type: 'currency' },
          { key: 'daysOverdue', label: 'Días Vencido', type: 'number' },
          { key: 'dueDate', label: 'Fecha Vencimiento', type: 'date' },
        ],
        rows: data,
        totals: {
          amount: data.reduce((sum, inv) => sum + inv.amount, 0),
        },
      };
    }

    case 'technician_rankings': {
      const performances = await getAllTechnicianPerformance(organizationId, dateRange);
      const rankings = calculateTechnicianRankings(performances);
      return {
        columns: [
          { key: 'rank', label: '#', type: 'number' },
          { key: 'name', label: 'Técnico', type: 'string' },
          { key: 'score', label: 'Puntuación', type: 'number' },
          { key: 'completionRate', label: 'Tasa Completado', type: 'percentage' },
          { key: 'efficiency', label: 'Eficiencia', type: 'number' },
        ],
        rows: rankings.map((r) => ({
          rank: r.rank,
          name: r.name,
          score: Math.round(r.score),
          completionRate: r.metrics.completionRate,
          efficiency: r.metrics.efficiency,
        })),
      };
    }

    case 'technician_details': {
      const data = await getAllTechnicianPerformance(organizationId, dateRange);
      return {
        columns: [
          { key: 'name', label: 'Técnico', type: 'string' },
          { key: 'totalJobs', label: 'Total Trabajos', type: 'number' },
          { key: 'completedJobs', label: 'Completados', type: 'number' },
          { key: 'completionRate', label: 'Tasa Completado', type: 'percentage' },
          { key: 'totalRevenue', label: 'Ingresos', type: 'currency' },
          { key: 'avgJobValue', label: 'Ticket Prom.', type: 'currency' },
        ],
        rows: data.map((p) => ({
          name: p.name,
          totalJobs: p.totalJobs,
          completedJobs: p.completedJobs,
          completionRate: p.completionRate,
          totalRevenue: p.totalRevenue,
          avgJobValue: p.averageJobValue,
        })),
        totals: {
          totalJobs: data.reduce((sum, p) => sum + p.totalJobs, 0),
          completedJobs: data.reduce((sum, p) => sum + p.completedJobs, 0),
          totalRevenue: data.reduce((sum, p) => sum + p.totalRevenue, 0),
        },
      };
    }

    case 'cohort_analysis': {
      const data = await getCohortAnalysis(organizationId, 12);
      return {
        columns: [
          { key: 'cohort', label: 'Cohorte', type: 'string' },
          { key: 'totalCustomers', label: 'Total', type: 'number' },
          { key: 'activeCustomers', label: 'Activos', type: 'number' },
          { key: 'retentionRate', label: 'Retención', type: 'percentage' },
          { key: 'avgRevenuePerCustomer', label: 'Ingreso/Cliente', type: 'currency' },
        ],
        rows: data,
      };
    }

    case 'churn_risk_customers': {
      const data = await getChurnRiskCustomers(organizationId, 10);
      return {
        columns: [
          { key: 'name', label: 'Cliente', type: 'string' },
          { key: 'daysSinceLastJob', label: 'Días sin Actividad', type: 'number' },
          { key: 'totalJobs', label: 'Total Trabajos', type: 'number' },
          { key: 'totalRevenue', label: 'Ingresos Totales', type: 'currency' },
          { key: 'riskScore', label: 'Riesgo', type: 'percentage' },
        ],
        rows: data.map((c) => ({
          name: c.name,
          daysSinceLastJob: c.daysSinceLastJob,
          totalJobs: c.totalJobs,
          totalRevenue: c.totalRevenue,
          riskScore: c.riskScore,
        })),
      };
    }

    case 'daily_breakdown': {
      // Generate last 7 days breakdown
      const jobs = await db.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          status: true,
          createdAt: true,
          invoice: {
            select: { total: true },
          },
        },
      });

      const dayMap = new Map<string, { total: number; completed: number; revenue: number }>();

      for (const job of jobs) {
        const day = job.createdAt.toISOString().slice(0, 10);
        const current = dayMap.get(day) || { total: 0, completed: 0, revenue: 0 };
        current.total++;
        if (job.status === 'COMPLETED') {
          current.completed++;
          current.revenue += job.invoice?.total?.toNumber() || 0;
        }
        dayMap.set(day, current);
      }

      const rows = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, data]) => ({
          day,
          total: data.total,
          completed: data.completed,
          revenue: data.revenue,
        }));

      return {
        columns: [
          { key: 'day', label: 'Fecha', type: 'date' },
          { key: 'total', label: 'Trabajos', type: 'number' },
          { key: 'completed', label: 'Completados', type: 'number' },
          { key: 'revenue', label: 'Ingresos', type: 'currency' },
        ],
        rows,
        totals: {
          total: rows.reduce((sum, r) => sum + r.total, 0),
          completed: rows.reduce((sum, r) => sum + r.completed, 0),
          revenue: rows.reduce((sum, r) => sum + r.revenue, 0),
        },
      };
    }

    default:
      return {
        columns: [],
        rows: [],
      };
  }
}
