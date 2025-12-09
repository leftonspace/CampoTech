/**
 * KPI Definitions
 * ===============
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Central registry of KPI definitions with calculation methods.
 */

import { KPIDefinition, KPIValue, DateRange } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface KPIConfig extends KPIDefinition {
  calculationMethod: 'direct' | 'derived' | 'ratio' | 'comparison';
  sourceMetrics?: string[];
  formula?: string;
  thresholds: {
    excellent?: number;
    good?: number;
    warning?: number;
    critical?: number;
  };
  benchmarks?: {
    industry?: number;
    topPerformers?: number;
  };
  refreshInterval: number; // seconds
}

export interface KPIGroup {
  id: string;
  name: string;
  description: string;
  kpis: string[];
  order: number;
}

export interface KPICalculationContext {
  organizationId: string;
  dateRange: DateRange;
  previousDateRange?: DateRange;
  includeComparison?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const KPI_REGISTRY: Record<string, KPIConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE KPIs
  // ═══════════════════════════════════════════════════════════════════════════
  total_revenue: {
    id: 'total_revenue',
    name: 'Ingresos Totales',
    description: 'Suma total de todos los ingresos facturados en el período',
    category: 'revenue',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 1000000,
      good: 500000,
      warning: 100000,
      critical: 50000,
    },
    refreshInterval: 300, // 5 minutes
  },

  mrr: {
    id: 'mrr',
    name: 'MRR',
    description: 'Monthly Recurring Revenue - Ingreso mensual recurrente',
    category: 'revenue',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'derived',
    sourceMetrics: ['revenue_from_recurring', 'revenue_from_contracts'],
    thresholds: {
      excellent: 500000,
      good: 200000,
      warning: 50000,
      critical: 10000,
    },
    refreshInterval: 3600, // 1 hour
  },

  arr: {
    id: 'arr',
    name: 'ARR',
    description: 'Annual Recurring Revenue - Ingreso anual recurrente',
    category: 'revenue',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'derived',
    formula: 'mrr * 12',
    thresholds: {
      excellent: 6000000,
      good: 2400000,
      warning: 600000,
      critical: 120000,
    },
    refreshInterval: 3600,
  },

  arpu: {
    id: 'arpu',
    name: 'ARPU',
    description: 'Average Revenue Per User - Ingreso promedio por cliente',
    category: 'revenue',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'total_revenue / active_customers',
    thresholds: {
      excellent: 50000,
      good: 25000,
      warning: 10000,
      critical: 5000,
    },
    benchmarks: {
      industry: 15000,
      topPerformers: 35000,
    },
    refreshInterval: 3600,
  },

  avg_invoice_value: {
    id: 'avg_invoice_value',
    name: 'Ticket Promedio',
    description: 'Valor promedio de cada factura emitida',
    category: 'revenue',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'total_revenue / invoice_count',
    thresholds: {
      excellent: 30000,
      good: 15000,
      warning: 8000,
      critical: 5000,
    },
    refreshInterval: 300,
  },

  revenue_growth_rate: {
    id: 'revenue_growth_rate',
    name: 'Crecimiento de Ingresos',
    description: 'Tasa de crecimiento de ingresos vs período anterior',
    category: 'revenue',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'comparison',
    formula: '(current_revenue - previous_revenue) / previous_revenue * 100',
    thresholds: {
      excellent: 20,
      good: 10,
      warning: 0,
      critical: -10,
    },
    refreshInterval: 86400, // Daily
  },

  collection_rate: {
    id: 'collection_rate',
    name: 'Tasa de Cobro',
    description: 'Porcentaje de facturas efectivamente cobradas',
    category: 'revenue',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'collected_revenue / total_revenue * 100',
    thresholds: {
      excellent: 95,
      good: 85,
      warning: 70,
      critical: 50,
    },
    benchmarks: {
      industry: 82,
      topPerformers: 95,
    },
    refreshInterval: 3600,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATIONS KPIs
  // ═══════════════════════════════════════════════════════════════════════════
  total_jobs: {
    id: 'total_jobs',
    name: 'Total Trabajos',
    description: 'Número total de trabajos en el período',
    category: 'operations',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 500,
      good: 200,
      warning: 50,
      critical: 20,
    },
    refreshInterval: 300,
  },

  completed_jobs: {
    id: 'completed_jobs',
    name: 'Trabajos Completados',
    description: 'Número de trabajos finalizados exitosamente',
    category: 'operations',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 450,
      good: 180,
      warning: 40,
      critical: 15,
    },
    refreshInterval: 300,
  },

  completion_rate: {
    id: 'completion_rate',
    name: 'Tasa de Completado',
    description: 'Porcentaje de trabajos completados vs total',
    category: 'operations',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'completed_jobs / total_jobs * 100',
    thresholds: {
      excellent: 95,
      good: 85,
      warning: 70,
      critical: 50,
    },
    benchmarks: {
      industry: 80,
      topPerformers: 92,
    },
    refreshInterval: 300,
  },

  cancellation_rate: {
    id: 'cancellation_rate',
    name: 'Tasa de Cancelación',
    description: 'Porcentaje de trabajos cancelados',
    category: 'operations',
    format: 'percent',
    higherIsBetter: false,
    calculationMethod: 'ratio',
    formula: 'cancelled_jobs / total_jobs * 100',
    thresholds: {
      excellent: 2,
      good: 5,
      warning: 10,
      critical: 20,
    },
    refreshInterval: 300,
  },

  avg_job_duration: {
    id: 'avg_job_duration',
    name: 'Duración Promedio',
    description: 'Tiempo promedio de cada trabajo en minutos',
    category: 'operations',
    format: 'duration',
    higherIsBetter: false,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 60,
      good: 90,
      warning: 150,
      critical: 240,
    },
    benchmarks: {
      industry: 120,
      topPerformers: 75,
    },
    refreshInterval: 3600,
  },

  jobs_per_day: {
    id: 'jobs_per_day',
    name: 'Trabajos por Día',
    description: 'Promedio de trabajos completados por día',
    category: 'operations',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'total_jobs / working_days',
    thresholds: {
      excellent: 25,
      good: 15,
      warning: 5,
      critical: 2,
    },
    refreshInterval: 86400,
  },

  first_time_fix_rate: {
    id: 'first_time_fix_rate',
    name: 'Resolución Primera Visita',
    description: 'Porcentaje de trabajos resueltos en la primera visita',
    category: 'operations',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'single_visit_jobs / total_jobs * 100',
    thresholds: {
      excellent: 90,
      good: 80,
      warning: 65,
      critical: 50,
    },
    benchmarks: {
      industry: 72,
      topPerformers: 88,
    },
    refreshInterval: 86400,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL KPIs
  // ═══════════════════════════════════════════════════════════════════════════
  gross_margin: {
    id: 'gross_margin',
    name: 'Margen Bruto',
    description: 'Porcentaje de ganancia bruta sobre ingresos',
    category: 'financial',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: '(revenue - costs) / revenue * 100',
    thresholds: {
      excellent: 50,
      good: 35,
      warning: 20,
      critical: 10,
    },
    benchmarks: {
      industry: 32,
      topPerformers: 45,
    },
    refreshInterval: 86400,
  },

  days_sales_outstanding: {
    id: 'days_sales_outstanding',
    name: 'DSO',
    description: 'Días promedio para cobrar facturas',
    category: 'financial',
    format: 'number',
    higherIsBetter: false,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 15,
      good: 30,
      warning: 45,
      critical: 60,
    },
    benchmarks: {
      industry: 35,
      topPerformers: 18,
    },
    refreshInterval: 86400,
  },

  overdue_amount: {
    id: 'overdue_amount',
    name: 'Monto Vencido',
    description: 'Total de facturas vencidas sin cobrar',
    category: 'financial',
    format: 'currency',
    higherIsBetter: false,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 0,
      good: 50000,
      warning: 150000,
      critical: 300000,
    },
    refreshInterval: 3600,
  },

  cash_flow: {
    id: 'cash_flow',
    name: 'Flujo de Caja',
    description: 'Flujo neto de efectivo en el período',
    category: 'financial',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'derived',
    formula: 'collections - payments',
    thresholds: {
      excellent: 500000,
      good: 200000,
      warning: 0,
      critical: -100000,
    },
    refreshInterval: 3600,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER KPIs
  // ═══════════════════════════════════════════════════════════════════════════
  active_customers: {
    id: 'active_customers',
    name: 'Clientes Activos',
    description: 'Número de clientes con actividad en el período',
    category: 'customer',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 200,
      good: 100,
      warning: 30,
      critical: 10,
    },
    refreshInterval: 3600,
  },

  new_customers: {
    id: 'new_customers',
    name: 'Clientes Nuevos',
    description: 'Clientes que realizaron su primer trabajo',
    category: 'customer',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'direct',
    thresholds: {
      excellent: 50,
      good: 20,
      warning: 5,
      critical: 1,
    },
    refreshInterval: 86400,
  },

  customer_retention_rate: {
    id: 'customer_retention_rate',
    name: 'Tasa de Retención',
    description: 'Porcentaje de clientes que repiten',
    category: 'customer',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'returning_customers / total_customers * 100',
    thresholds: {
      excellent: 80,
      good: 60,
      warning: 40,
      critical: 20,
    },
    benchmarks: {
      industry: 55,
      topPerformers: 75,
    },
    refreshInterval: 86400,
  },

  customer_churn_rate: {
    id: 'customer_churn_rate',
    name: 'Tasa de Abandono',
    description: 'Porcentaje de clientes perdidos',
    category: 'customer',
    format: 'percent',
    higherIsBetter: false,
    calculationMethod: 'ratio',
    formula: 'churned_customers / total_customers * 100',
    thresholds: {
      excellent: 5,
      good: 10,
      warning: 20,
      critical: 35,
    },
    refreshInterval: 86400,
  },

  customer_lifetime_value: {
    id: 'customer_lifetime_value',
    name: 'CLV',
    description: 'Valor promedio de un cliente durante su relación',
    category: 'customer',
    format: 'currency',
    higherIsBetter: true,
    calculationMethod: 'derived',
    formula: 'arpu * avg_customer_lifespan_months',
    thresholds: {
      excellent: 200000,
      good: 100000,
      warning: 40000,
      critical: 15000,
    },
    benchmarks: {
      industry: 60000,
      topPerformers: 150000,
    },
    refreshInterval: 86400,
  },

  repeat_customer_rate: {
    id: 'repeat_customer_rate',
    name: 'Clientes Repetidores',
    description: 'Porcentaje de clientes con múltiples trabajos',
    category: 'customer',
    format: 'percent',
    higherIsBetter: true,
    calculationMethod: 'ratio',
    formula: 'repeat_customers / total_customers * 100',
    thresholds: {
      excellent: 70,
      good: 50,
      warning: 30,
      critical: 15,
    },
    refreshInterval: 86400,
  },

  nps: {
    id: 'nps',
    name: 'NPS',
    description: 'Net Promoter Score - Índice de recomendación',
    category: 'customer',
    format: 'number',
    higherIsBetter: true,
    calculationMethod: 'derived',
    formula: 'promoters_pct - detractors_pct',
    thresholds: {
      excellent: 70,
      good: 50,
      warning: 20,
      critical: 0,
    },
    benchmarks: {
      industry: 35,
      topPerformers: 65,
    },
    refreshInterval: 86400,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GROUPS
// ═══════════════════════════════════════════════════════════════════════════════

export const KPI_GROUPS: KPIGroup[] = [
  {
    id: 'revenue',
    name: 'Ingresos',
    description: 'KPIs relacionados con ingresos y facturación',
    kpis: [
      'total_revenue',
      'mrr',
      'arr',
      'arpu',
      'avg_invoice_value',
      'revenue_growth_rate',
      'collection_rate',
    ],
    order: 1,
  },
  {
    id: 'operations',
    name: 'Operaciones',
    description: 'KPIs relacionados con la operación diaria',
    kpis: [
      'total_jobs',
      'completed_jobs',
      'completion_rate',
      'cancellation_rate',
      'avg_job_duration',
      'jobs_per_day',
      'first_time_fix_rate',
    ],
    order: 2,
  },
  {
    id: 'financial',
    name: 'Financieros',
    description: 'KPIs de salud financiera',
    kpis: [
      'gross_margin',
      'days_sales_outstanding',
      'overdue_amount',
      'cash_flow',
    ],
    order: 3,
  },
  {
    id: 'customer',
    name: 'Clientes',
    description: 'KPIs de gestión de clientes',
    kpis: [
      'active_customers',
      'new_customers',
      'customer_retention_rate',
      'customer_churn_rate',
      'customer_lifetime_value',
      'repeat_customer_rate',
      'nps',
    ],
    order: 4,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get KPI definition by ID
 */
export function getKPIDefinition(kpiId: string): KPIConfig | undefined {
  return KPI_REGISTRY[kpiId];
}

/**
 * Get all KPIs for a category
 */
export function getKPIsByCategory(
  category: 'revenue' | 'operations' | 'financial' | 'customer'
): KPIConfig[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.category === category);
}

/**
 * Get KPIs for a group
 */
export function getKPIsForGroup(groupId: string): KPIConfig[] {
  const group = KPI_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];

  return group.kpis
    .map((kpiId) => KPI_REGISTRY[kpiId])
    .filter((kpi): kpi is KPIConfig => kpi !== undefined);
}

/**
 * Get all KPI groups
 */
export function getAllKPIGroups(): KPIGroup[] {
  return KPI_GROUPS.sort((a, b) => a.order - b.order);
}

/**
 * Get all KPI IDs
 */
export function getAllKPIIds(): string[] {
  return Object.keys(KPI_REGISTRY);
}

/**
 * Evaluate KPI value against thresholds
 */
export function evaluateKPIStatus(
  kpiId: string,
  value: number
): 'excellent' | 'good' | 'warning' | 'critical' | 'unknown' {
  const kpi = KPI_REGISTRY[kpiId];
  if (!kpi) return 'unknown';

  const { thresholds, higherIsBetter } = kpi;

  if (higherIsBetter) {
    if (thresholds.excellent !== undefined && value >= thresholds.excellent) return 'excellent';
    if (thresholds.good !== undefined && value >= thresholds.good) return 'good';
    if (thresholds.warning !== undefined && value >= thresholds.warning) return 'warning';
    return 'critical';
  } else {
    if (thresholds.excellent !== undefined && value <= thresholds.excellent) return 'excellent';
    if (thresholds.good !== undefined && value <= thresholds.good) return 'good';
    if (thresholds.warning !== undefined && value <= thresholds.warning) return 'warning';
    return 'critical';
  }
}

/**
 * Calculate trend from current and previous values
 */
export function calculateTrend(
  current: number,
  previous: number | null
): { trend: 'up' | 'down' | 'stable'; change: number | null; changePercent: number | null } {
  if (previous === null || previous === 0) {
    return { trend: 'stable', change: null, changePercent: null };
  }

  const change = current - previous;
  const changePercent = (change / previous) * 100;

  let trend: 'up' | 'down' | 'stable';
  if (Math.abs(changePercent) < 1) {
    trend = 'stable';
  } else if (change > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }

  return { trend, change, changePercent };
}

/**
 * Format KPI value based on its format type
 */
export function formatKPIValue(kpiId: string, value: number): string {
  const kpi = KPI_REGISTRY[kpiId];
  if (!kpi) return value.toString();

  switch (kpi.format) {
    case 'currency':
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    case 'percent':
      return `${value.toFixed(1)}%`;

    case 'duration':
      const hours = Math.floor(value / 60);
      const minutes = Math.round(value % 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    case 'number':
    default:
      return new Intl.NumberFormat('es-AR').format(Math.round(value));
  }
}

/**
 * Get benchmark comparison
 */
export function getBenchmarkComparison(
  kpiId: string,
  value: number
): { vsIndustry: number | null; vsTopPerformers: number | null } {
  const kpi = KPI_REGISTRY[kpiId];
  if (!kpi || !kpi.benchmarks) {
    return { vsIndustry: null, vsTopPerformers: null };
  }

  const vsIndustry = kpi.benchmarks.industry
    ? ((value - kpi.benchmarks.industry) / kpi.benchmarks.industry) * 100
    : null;

  const vsTopPerformers = kpi.benchmarks.topPerformers
    ? ((value - kpi.benchmarks.topPerformers) / kpi.benchmarks.topPerformers) * 100
    : null;

  return { vsIndustry, vsTopPerformers };
}
