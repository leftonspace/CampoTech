/**
 * Customer Segment Analyzer
 * =========================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Customer segmentation and analysis.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, CustomerDimension } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CustomerSegment = 'new' | 'active' | 'loyal' | 'at_risk' | 'churned' | 'vip';

export interface SegmentDefinition {
  id: CustomerSegment;
  name: string;
  description: string;
  criteria: string;
  color: string;
}

export interface SegmentMetrics {
  segment: CustomerSegment;
  name: string;
  customerCount: number;
  percentOfTotal: number;
  totalRevenue: number;
  percentOfRevenue: number;
  averageJobValue: number;
  averageJobsPerCustomer: number;
  lifetimeValue: number;
  color: string;
}

export interface SegmentTrend {
  period: string;
  segments: {
    segment: CustomerSegment;
    count: number;
    revenue: number;
  }[];
}

export interface SegmentMovement {
  fromSegment: CustomerSegment;
  toSegment: CustomerSegment;
  customerCount: number;
  direction: 'upgrade' | 'downgrade' | 'lateral';
  percentChange: number;
}

export interface CustomerSegmentProfile {
  customerId: string;
  customerName: string;
  segment: CustomerSegment;
  totalJobs: number;
  totalRevenue: number;
  averageJobValue: number;
  lastJobAt: Date | null;
  daysSinceLastJob: number;
  customerSince: Date;
  riskScore: number;
  nextBestAction: string;
}

export interface RFMScores {
  recency: number; // 1-5
  frequency: number; // 1-5
  monetary: number; // 1-5
  totalScore: number;
  segment: CustomerSegment;
}

export interface SegmentRecommendation {
  segment: CustomerSegment;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
  suggestedActions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  {
    id: 'new',
    name: 'Nuevos',
    description: 'Clientes con primer trabajo en los últimos 30 días',
    criteria: 'Primera compra < 30 días',
    color: '#3b82f6', // Blue
  },
  {
    id: 'active',
    name: 'Activos',
    description: 'Clientes con actividad reciente y buen historial',
    criteria: 'Última actividad < 30 días, 2-4 trabajos',
    color: '#22c55e', // Green
  },
  {
    id: 'loyal',
    name: 'Leales',
    description: 'Clientes frecuentes con alto valor',
    criteria: '5+ trabajos, activo en últimos 60 días',
    color: '#a855f7', // Purple
  },
  {
    id: 'vip',
    name: 'VIP',
    description: 'Clientes de mayor valor',
    criteria: 'Top 10% en ingresos, activo',
    color: '#f59e0b', // Amber
  },
  {
    id: 'at_risk',
    name: 'En Riesgo',
    description: 'Clientes que muestran señales de abandono',
    criteria: 'Sin actividad 30-90 días',
    color: '#ef4444', // Red
  },
  {
    id: 'churned',
    name: 'Perdidos',
    description: 'Clientes sin actividad prolongada',
    criteria: 'Sin actividad > 90 días',
    color: '#6b7280', // Gray
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Segment customers based on behavior and value
 */
export async function segmentCustomers(
  organizationId: string,
  dateRange: DateRange
): Promise<SegmentMetrics[]> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          id: true,
          completedAt: true,
          createdAt: true,
        },
      },
      invoices: {
        where: {
          status: { in: ['paid', 'partial'] },
        },
        select: {
          total: true,
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Calculate revenue percentiles for VIP identification
  const customerRevenues = customers.map((c) => ({
    id: c.id,
    revenue: c.invoices.reduce((sum, inv) => sum + (inv.total?.toNumber() || 0), 0),
  }));
  const sortedRevenues = customerRevenues.map((c) => c.revenue).sort((a, b) => b - a);
  const vipThreshold = sortedRevenues[Math.floor(sortedRevenues.length * 0.1)] || Infinity;

  // Segment each customer
  const segmentData = new Map<CustomerSegment, {
    customers: string[];
    revenue: number;
    totalJobs: number;
  }>();

  // Initialize segments
  for (const def of SEGMENT_DEFINITIONS) {
    segmentData.set(def.id, { customers: [], revenue: 0, totalJobs: 0 });
  }

  for (const customer of customers) {
    const totalJobs = customer.jobs.length;
    const totalRevenue = customer.invoices.reduce(
      (sum, inv) => sum + (inv.total?.toNumber() || 0),
      0
    );

    const lastJobAt = customer.jobs
      .filter((j) => j.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt;

    const firstJobAt = customer.jobs
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      ?.createdAt;

    // Determine segment
    let segment: CustomerSegment;

    if (totalJobs === 0) {
      segment = 'new';
    } else if (totalRevenue >= vipThreshold && lastJobAt && lastJobAt >= sixtyDaysAgo) {
      segment = 'vip';
    } else if (!lastJobAt || lastJobAt < ninetyDaysAgo) {
      segment = 'churned';
    } else if (lastJobAt < thirtyDaysAgo) {
      segment = 'at_risk';
    } else if (totalJobs >= 5 && lastJobAt >= sixtyDaysAgo) {
      segment = 'loyal';
    } else if (firstJobAt && firstJobAt >= thirtyDaysAgo) {
      segment = 'new';
    } else {
      segment = 'active';
    }

    const data = segmentData.get(segment)!;
    data.customers.push(customer.id);
    data.revenue += totalRevenue;
    data.totalJobs += totalJobs;
  }

  // Calculate totals for percentages
  const totalCustomers = customers.length;
  const totalRevenue = Array.from(segmentData.values()).reduce(
    (sum, d) => sum + d.revenue,
    0
  );

  // Format results
  const results: SegmentMetrics[] = [];

  for (const def of SEGMENT_DEFINITIONS) {
    const data = segmentData.get(def.id)!;
    const customerCount = data.customers.length;

    results.push({
      segment: def.id,
      name: def.name,
      customerCount,
      percentOfTotal: totalCustomers > 0 ? (customerCount / totalCustomers) * 100 : 0,
      totalRevenue: data.revenue,
      percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      averageJobValue: data.totalJobs > 0 ? data.revenue / data.totalJobs : 0,
      averageJobsPerCustomer: customerCount > 0 ? data.totalJobs / customerCount : 0,
      lifetimeValue: customerCount > 0 ? data.revenue / customerCount : 0,
      color: def.color,
    });
  }

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RFM ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate RFM (Recency, Frequency, Monetary) scores for customers
 */
export async function calculateRFMScores(
  organizationId: string
): Promise<Map<string, RFMScores>> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          completedAt: true,
        },
      },
      invoices: {
        where: {
          status: { in: ['paid', 'partial'] },
        },
        select: {
          total: true,
          createdAt: true,
        },
      },
    },
  });

  const now = new Date();

  // Calculate raw RFM values
  const rfmData = customers.map((customer) => {
    const lastInvoice = customer.invoices
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    const recencyDays = lastInvoice
      ? (now.getTime() - lastInvoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 365;

    const frequency = customer.invoices.length;
    const monetary = customer.invoices.reduce(
      (sum, inv) => sum + (inv.total?.toNumber() || 0),
      0
    );

    return {
      customerId: customer.id,
      recencyDays,
      frequency,
      monetary,
    };
  });

  // Calculate quintiles for scoring
  const recencyValues = rfmData.map((d) => d.recencyDays).sort((a, b) => a - b);
  const frequencyValues = rfmData.map((d) => d.frequency).sort((a, b) => b - a);
  const monetaryValues = rfmData.map((d) => d.monetary).sort((a, b) => b - a);

  const getQuintile = (value: number, sortedValues: number[], ascending: boolean): number => {
    const index = sortedValues.findIndex((v) => v >= value);
    const percentile = index >= 0 ? index / sortedValues.length : 1;
    const score = ascending
      ? Math.ceil((1 - percentile) * 5)
      : Math.ceil(percentile * 5);
    return Math.max(1, Math.min(5, score));
  };

  // Generate RFM scores
  const rfmScores = new Map<string, RFMScores>();

  for (const data of rfmData) {
    const recency = getQuintile(data.recencyDays, recencyValues, true);
    const frequency = getQuintile(data.frequency, frequencyValues, false);
    const monetary = getQuintile(data.monetary, monetaryValues, false);
    const totalScore = recency + frequency + monetary;

    // Determine segment from RFM
    let segment: CustomerSegment;
    if (totalScore >= 13) {
      segment = 'vip';
    } else if (totalScore >= 10 && recency >= 4) {
      segment = 'loyal';
    } else if (recency >= 4) {
      segment = 'active';
    } else if (recency <= 2 && totalScore >= 8) {
      segment = 'at_risk';
    } else if (recency === 1) {
      segment = 'churned';
    } else {
      segment = 'new';
    }

    rfmScores.set(data.customerId, {
      recency,
      frequency,
      monetary,
      totalScore,
      segment,
    });
  }

  return rfmScores;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get segment distribution trend over time
 */
export async function getSegmentTrend(
  organizationId: string,
  months: number = 6
): Promise<SegmentTrend[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      customer: {
        include: {
          jobs: {
            select: {
              completedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month and calculate segment at that point
  const monthlyData = new Map<string, Map<CustomerSegment, { count: number; revenue: number }>>();

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7);
    const invoiceDate = invoice.createdAt;

    if (!monthlyData.has(month)) {
      monthlyData.set(
        month,
        new Map(SEGMENT_DEFINITIONS.map((d) => [d.id, { count: 0, revenue: 0 }]))
      );
    }

    if (!invoice.customer) continue;

    // Determine segment at invoice time (simplified)
    const customer = invoice.customer;
    const jobsBeforeInvoice = customer.jobs.filter(
      (j) => j.createdAt && j.createdAt <= invoiceDate
    ).length;

    const thirtyDaysBeforeInvoice = new Date(invoiceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastJobBefore = customer.jobs
      .filter((j) => j.completedAt && j.completedAt <= invoiceDate)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

    let segment: CustomerSegment;
    if (jobsBeforeInvoice <= 1) {
      segment = 'new';
    } else if (jobsBeforeInvoice >= 5) {
      segment = 'loyal';
    } else if (lastJobBefore?.completedAt && lastJobBefore.completedAt < thirtyDaysBeforeInvoice) {
      segment = 'at_risk';
    } else {
      segment = 'active';
    }

    const data = monthlyData.get(month)!.get(segment)!;
    data.count++;
    data.revenue += invoice.total?.toNumber() || 0;
  }

  // Convert to output format
  const sortedMonths = Array.from(monthlyData.keys()).sort();

  return sortedMonths.map((period) => ({
    period,
    segments: SEGMENT_DEFINITIONS.map((def) => ({
      segment: def.id,
      count: monthlyData.get(period)!.get(def.id)!.count,
      revenue: monthlyData.get(period)!.get(def.id)!.revenue,
    })),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get detailed profiles for customers in a segment
 */
export async function getCustomerProfiles(
  organizationId: string,
  segment?: CustomerSegment,
  limit: number = 50
): Promise<CustomerSegmentProfile[]> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          completedAt: true,
          createdAt: true,
        },
      },
      invoices: {
        where: {
          status: { in: ['paid', 'partial'] },
        },
        select: {
          total: true,
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Calculate VIP threshold
  const revenues = customers.map((c) =>
    c.invoices.reduce((sum, inv) => sum + (inv.total?.toNumber() || 0), 0)
  );
  const sortedRevenues = revenues.sort((a, b) => b - a);
  const vipThreshold = sortedRevenues[Math.floor(sortedRevenues.length * 0.1)] || Infinity;

  const profiles: CustomerSegmentProfile[] = [];

  for (const customer of customers) {
    const totalJobs = customer.jobs.length;
    const totalRevenue = customer.invoices.reduce(
      (sum, inv) => sum + (inv.total?.toNumber() || 0),
      0
    );

    const lastJobAt = customer.jobs
      .filter((j) => j.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    const firstJobAt = customer.jobs
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      ?.createdAt;

    const daysSinceLastJob = lastJobAt
      ? Math.floor((now.getTime() - lastJobAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Determine segment
    let customerSegment: CustomerSegment;
    if (totalJobs === 0) {
      customerSegment = 'new';
    } else if (totalRevenue >= vipThreshold && lastJobAt && lastJobAt >= sixtyDaysAgo) {
      customerSegment = 'vip';
    } else if (!lastJobAt || lastJobAt < ninetyDaysAgo) {
      customerSegment = 'churned';
    } else if (lastJobAt < thirtyDaysAgo) {
      customerSegment = 'at_risk';
    } else if (totalJobs >= 5 && lastJobAt >= sixtyDaysAgo) {
      customerSegment = 'loyal';
    } else if (firstJobAt && firstJobAt >= thirtyDaysAgo) {
      customerSegment = 'new';
    } else {
      customerSegment = 'active';
    }

    // Filter by segment if specified
    if (segment && customerSegment !== segment) continue;

    // Calculate risk score (0-100, higher = more at risk)
    let riskScore = 0;
    riskScore += Math.min(50, daysSinceLastJob * 0.5);
    if (totalJobs === 1) riskScore += 20;
    if (totalRevenue < 10000) riskScore += 15;
    if (customerSegment === 'at_risk') riskScore += 25;
    if (customerSegment === 'churned') riskScore = 100;
    riskScore = Math.min(100, riskScore);

    // Determine next best action
    const nextBestAction = getNextBestAction(customerSegment, riskScore, daysSinceLastJob);

    profiles.push({
      customerId: customer.id,
      customerName: customer.name,
      segment: customerSegment,
      totalJobs,
      totalRevenue,
      averageJobValue: totalJobs > 0 ? totalRevenue / totalJobs : 0,
      lastJobAt,
      daysSinceLastJob,
      customerSince: customer.createdAt,
      riskScore,
      nextBestAction,
    });
  }

  return profiles
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get segment-specific recommendations
 */
export function getSegmentRecommendations(): SegmentRecommendation[] {
  return [
    {
      segment: 'new',
      recommendation: 'Programa de bienvenida',
      priority: 'high',
      expectedImpact: 'Aumentar retención inicial 20%',
      suggestedActions: [
        'Enviar mensaje de bienvenida',
        'Ofrecer descuento en segundo servicio',
        'Solicitar feedback después del primer trabajo',
        'Agregar a programa de referidos',
      ],
    },
    {
      segment: 'active',
      recommendation: 'Programa de fidelización',
      priority: 'medium',
      expectedImpact: 'Aumentar frecuencia de compra 15%',
      suggestedActions: [
        'Ofrecer plan de mantenimiento preventivo',
        'Enviar recordatorios de servicio',
        'Compartir tips y contenido de valor',
        'Proponer servicios complementarios',
      ],
    },
    {
      segment: 'loyal',
      recommendation: 'Programa VIP',
      priority: 'medium',
      expectedImpact: 'Aumentar ticket promedio 10%',
      suggestedActions: [
        'Ofrecer acceso prioritario',
        'Descuentos exclusivos para leales',
        'Invitar a programa de referidos premium',
        'Solicitar testimonios y reseñas',
      ],
    },
    {
      segment: 'vip',
      recommendation: 'Atención personalizada',
      priority: 'high',
      expectedImpact: 'Retener 95% de ingresos VIP',
      suggestedActions: [
        'Asignar ejecutivo de cuenta',
        'Servicio prioritario garantizado',
        'Beneficios exclusivos',
        'Invitación a eventos especiales',
      ],
    },
    {
      segment: 'at_risk',
      recommendation: 'Campaña de recuperación',
      priority: 'high',
      expectedImpact: 'Recuperar 30% de clientes en riesgo',
      suggestedActions: [
        'Contacto proactivo del equipo',
        'Oferta especial de reactivación',
        'Encuesta de satisfacción',
        'Propuesta de valor personalizada',
      ],
    },
    {
      segment: 'churned',
      recommendation: 'Campaña de win-back',
      priority: 'low',
      expectedImpact: 'Recuperar 10% de clientes perdidos',
      suggestedActions: [
        'Campaña de email de "te extrañamos"',
        'Oferta agresiva de reactivación',
        'Encuesta de motivos de abandono',
        'Propuesta de nuevos servicios',
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate segment KPIs for dashboard
 */
export async function generateSegmentKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  name: string;
  value: number;
  unit: 'percentage' | 'number' | 'currency';
  trend: 'up' | 'down' | 'stable';
  description?: string;
  status?: 'good' | 'warning' | 'critical';
}>> {
  const segments = await segmentCustomers(organizationId, dateRange);

  const vipSegment = segments.find((s) => s.segment === 'vip');
  const loyalSegment = segments.find((s) => s.segment === 'loyal');
  const atRiskSegment = segments.find((s) => s.segment === 'at_risk');
  const churnedSegment = segments.find((s) => s.segment === 'churned');

  const totalCustomers = segments.reduce((sum, s) => sum + s.customerCount, 0);
  const healthyCustomers =
    (vipSegment?.customerCount || 0) +
    (loyalSegment?.customerCount || 0) +
    (segments.find((s) => s.segment === 'active')?.customerCount || 0);

  const customerHealthRate = totalCustomers > 0 ? (healthyCustomers / totalCustomers) * 100 : 0;
  const atRiskRate =
    totalCustomers > 0 ? ((atRiskSegment?.customerCount || 0) / totalCustomers) * 100 : 0;

  return [
    {
      id: 'customer_health',
      name: 'Salud de Cartera',
      value: customerHealthRate,
      unit: 'percentage',
      trend: customerHealthRate >= 70 ? 'up' : customerHealthRate >= 50 ? 'stable' : 'down',
      description: '% de clientes activos, leales y VIP',
      status: customerHealthRate >= 70 ? 'good' : customerHealthRate >= 50 ? 'warning' : 'critical',
    },
    {
      id: 'vip_count',
      name: 'Clientes VIP',
      value: vipSegment?.customerCount || 0,
      unit: 'number',
      trend: 'stable',
      description: 'Top 10% en ingresos',
    },
    {
      id: 'vip_revenue_share',
      name: 'Ingresos VIP',
      value: vipSegment?.percentOfRevenue || 0,
      unit: 'percentage',
      trend: 'stable',
      description: '% de ingresos de clientes VIP',
    },
    {
      id: 'at_risk_rate',
      name: 'Clientes en Riesgo',
      value: atRiskRate,
      unit: 'percentage',
      trend: atRiskRate > 20 ? 'down' : 'stable',
      description: '% de clientes sin actividad 30-90 días',
      status: atRiskRate < 10 ? 'good' : atRiskRate < 20 ? 'warning' : 'critical',
    },
    {
      id: 'loyal_count',
      name: 'Clientes Leales',
      value: loyalSegment?.customerCount || 0,
      unit: 'number',
      trend: 'stable',
      description: 'Clientes con 5+ trabajos',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getNextBestAction(
  segment: CustomerSegment,
  riskScore: number,
  daysSinceLastJob: number
): string {
  switch (segment) {
    case 'new':
      return 'Enviar mensaje de bienvenida y ofrecer servicio complementario';
    case 'active':
      return daysSinceLastJob > 15
        ? 'Enviar recordatorio de mantenimiento'
        : 'Proponer plan de mantenimiento preventivo';
    case 'loyal':
      return 'Invitar a programa VIP con beneficios exclusivos';
    case 'vip':
      return 'Asignar ejecutivo de cuenta y programar visita';
    case 'at_risk':
      return 'Contacto urgente: llamada del equipo comercial';
    case 'churned':
      return 'Campaña de win-back con oferta especial';
    default:
      return 'Revisar historial y personalizar acción';
  }
}
