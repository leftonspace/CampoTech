/**
 * Report Templates
 * ================
 *
 * Phase 10.3: Report Generation Engine
 * Predefined report templates for common business needs.
 */

import { DateRange, ReportTemplate, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { TAX_REPORT_TEMPLATES } from './tax-report.template';

export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  // Revenue Reports
  revenue_summary: {
    id: 'revenue_summary',
    name: 'Resumen de Ingresos',
    description: 'Análisis completo de ingresos y facturación',
    category: 'financial',
    sections: [
      {
        id: 'overview',
        title: 'Resumen General',
        type: 'kpi_grid',
        kpis: ['total_revenue', 'collected_amount', 'outstanding_amount', 'avg_invoice_value'],
      },
      {
        id: 'revenue_trend',
        title: 'Tendencia de Ingresos',
        type: 'chart',
        chartType: 'line',
        dataSource: 'revenue_trend',
      },
      {
        id: 'revenue_by_service',
        title: 'Ingresos por Tipo de Servicio',
        type: 'chart',
        chartType: 'pie',
        dataSource: 'revenue_by_service',
      },
      {
        id: 'top_customers',
        title: 'Mejores Clientes',
        type: 'table',
        dataSource: 'top_customers_by_revenue',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'day',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel', 'csv'],
  },

  monthly_financial: {
    id: 'monthly_financial',
    name: 'Informe Financiero Mensual',
    description: 'Estado financiero completo del mes',
    category: 'financial',
    sections: [
      {
        id: 'summary',
        title: 'Resumen Ejecutivo',
        type: 'kpi_grid',
        kpis: ['mrr', 'arr', 'net_cash_flow', 'accounts_receivable'],
      },
      {
        id: 'cash_flow',
        title: 'Flujo de Caja',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'cash_flow_trend',
      },
      {
        id: 'aging',
        title: 'Antigüedad de Cuentas por Cobrar',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'ar_aging',
      },
      {
        id: 'payment_methods',
        title: 'Métodos de Pago',
        type: 'chart',
        chartType: 'pie',
        dataSource: 'payment_breakdown',
      },
      {
        id: 'overdue_invoices',
        title: 'Facturas Vencidas',
        type: 'table',
        dataSource: 'overdue_invoices',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'week',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  // Operations Reports
  operations_summary: {
    id: 'operations_summary',
    name: 'Resumen de Operaciones',
    description: 'Análisis de trabajos y eficiencia operativa',
    category: 'operations',
    sections: [
      {
        id: 'job_overview',
        title: 'Resumen de Trabajos',
        type: 'kpi_grid',
        kpis: ['total_jobs', 'completed_jobs', 'completion_rate', 'avg_duration'],
      },
      {
        id: 'job_trend',
        title: 'Tendencia de Trabajos',
        type: 'chart',
        chartType: 'line',
        dataSource: 'job_trend',
      },
      {
        id: 'jobs_by_service',
        title: 'Trabajos por Tipo de Servicio',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'jobs_by_service',
      },
      {
        id: 'jobs_by_status',
        title: 'Estado de Trabajos',
        type: 'chart',
        chartType: 'pie',
        dataSource: 'jobs_by_status',
      },
      {
        id: 'daily_distribution',
        title: 'Distribución por Día de la Semana',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'jobs_by_day',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'day',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel', 'csv'],
  },

  technician_performance: {
    id: 'technician_performance',
    name: 'Rendimiento de Técnicos',
    description: 'Análisis de eficiencia y productividad del equipo',
    category: 'operations',
    sections: [
      {
        id: 'team_summary',
        title: 'Resumen del Equipo',
        type: 'kpi_grid',
        kpis: ['active_technicians', 'avg_completion_rate', 'avg_jobs_per_tech', 'avg_revenue_per_tech'],
      },
      {
        id: 'ranking',
        title: 'Ranking de Técnicos',
        type: 'table',
        dataSource: 'technician_rankings',
      },
      {
        id: 'efficiency_comparison',
        title: 'Comparación de Eficiencia',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'technician_efficiency',
      },
      {
        id: 'individual_details',
        title: 'Detalle por Técnico',
        type: 'table',
        dataSource: 'technician_details',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'week',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  // Customer Reports
  customer_analysis: {
    id: 'customer_analysis',
    name: 'Análisis de Clientes',
    description: 'Métricas de clientes y segmentación',
    category: 'customers',
    sections: [
      {
        id: 'customer_summary',
        title: 'Resumen de Clientes',
        type: 'kpi_grid',
        kpis: ['total_customers', 'active_customers', 'new_customers', 'churn_rate'],
      },
      {
        id: 'clv_by_segment',
        title: 'CLV por Segmento',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'clv_by_segment',
      },
      {
        id: 'cohort_analysis',
        title: 'Análisis de Cohortes',
        type: 'table',
        dataSource: 'cohort_analysis',
      },
      {
        id: 'top_customers',
        title: 'Mejores Clientes por CLV',
        type: 'table',
        dataSource: 'top_customers_clv',
      },
      {
        id: 'at_risk',
        title: 'Clientes en Riesgo',
        type: 'table',
        dataSource: 'churn_risk_customers',
      },
    ],
    defaultDateRange: 'quarter',
    defaultGranularity: 'month',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  // Executive Reports
  executive_dashboard: {
    id: 'executive_dashboard',
    name: 'Dashboard Ejecutivo',
    description: 'Resumen ejecutivo con las métricas más importantes',
    category: 'executive',
    sections: [
      {
        id: 'key_metrics',
        title: 'Métricas Clave',
        type: 'kpi_grid',
        kpis: ['total_revenue', 'mrr', 'total_jobs', 'active_customers'],
      },
      {
        id: 'revenue_trend',
        title: 'Tendencia de Ingresos',
        type: 'chart',
        chartType: 'area',
        dataSource: 'revenue_trend',
      },
      {
        id: 'operations_trend',
        title: 'Tendencia de Operaciones',
        type: 'chart',
        chartType: 'line',
        dataSource: 'job_trend',
      },
      {
        id: 'performance_summary',
        title: 'Resumen de Rendimiento',
        type: 'kpi_grid',
        kpis: ['completion_rate', 'collection_rate', 'retention_rate', 'avg_clv'],
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'week',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf'],
  },

  weekly_summary: {
    id: 'weekly_summary',
    name: 'Resumen Semanal',
    description: 'Resumen rápido de la actividad de la semana',
    category: 'executive',
    sections: [
      {
        id: 'week_summary',
        title: 'Resumen de la Semana',
        type: 'kpi_grid',
        kpis: ['total_revenue', 'total_jobs', 'completed_jobs', 'new_customers'],
      },
      {
        id: 'daily_breakdown',
        title: 'Desglose Diario',
        type: 'table',
        dataSource: 'daily_breakdown',
      },
      {
        id: 'top_services',
        title: 'Servicios Más Solicitados',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'top_services',
      },
    ],
    defaultDateRange: 'week',
    defaultGranularity: 'day',
    defaultFilters: [],
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  // Tax Reports (merged from tax-report.template.ts)
  ...TAX_REPORT_TEMPLATES,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all available report templates
 */
export function getAvailableTemplates(): ReportTemplate[] {
  return Object.values(REPORT_TEMPLATES);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): ReportTemplate[] {
  return Object.values(REPORT_TEMPLATES).filter((t) => t.category === category);
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templateId: string): ReportTemplate | null {
  return REPORT_TEMPLATES[templateId] || null;
}

/**
 * Get date range from preset
 */
export function getDateRangeFromPreset(preset: string): DateRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  switch (preset) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'mtd':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

/**
 * Get granularity options for a date range
 */
export function getGranularityOptions(dateRange: DateRange): TimeGranularity[] {
  const days = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days <= 1) {
    return ['hour'];
  } else if (days <= 7) {
    return ['hour', 'day'];
  } else if (days <= 31) {
    return ['day', 'week'];
  } else if (days <= 90) {
    return ['day', 'week', 'month'];
  } else if (days <= 365) {
    return ['week', 'month', 'quarter'];
  } else {
    return ['month', 'quarter', 'year'];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const REPORT_CATEGORIES = [
  {
    id: 'financial',
    name: 'Financieros',
    description: 'Informes de ingresos, facturación y flujo de caja',
    icon: 'dollar-sign',
  },
  {
    id: 'operations',
    name: 'Operaciones',
    description: 'Informes de trabajos y eficiencia operativa',
    icon: 'briefcase',
  },
  {
    id: 'customers',
    name: 'Clientes',
    description: 'Análisis de clientes y retención',
    icon: 'users',
  },
  {
    id: 'executive',
    name: 'Ejecutivo',
    description: 'Resúmenes ejecutivos y dashboards',
    icon: 'bar-chart',
  },
  {
    id: 'tax',
    name: 'Impositivos',
    description: 'Informes fiscales y cumplimiento AFIP',
    icon: 'file-text',
  },
];
