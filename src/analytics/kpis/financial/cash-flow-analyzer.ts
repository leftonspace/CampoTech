/**
 * Cash Flow Analyzer
 * ==================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Financial analysis and cash flow metrics.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIResult, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CashFlowMetrics {
  totalInflow: number;
  totalOutflow: number; // Placeholder for expenses
  netCashFlow: number;
  operatingCashFlow: number;
  accountsReceivable: number;
  averageDaysToPayment: number;
  cashConversionCycle: number;
}

export interface CashFlowTrend {
  period: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export interface AccountsReceivableAging {
  current: number; // 0-30 days
  overdue30: number; // 31-60 days
  overdue60: number; // 61-90 days
  overdue90Plus: number; // 90+ days
  total: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
  avgTransactionValue: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASH FLOW METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive cash flow metrics
 */
export async function calculateCashFlowMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<CashFlowMetrics> {
  // Get all payments (cash inflow)
  const payments = await db.payment.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      amount: true,
      createdAt: true,
    },
  });

  const totalInflow = payments.reduce(
    (sum, p) => sum + (p.amount?.toNumber() || 0),
    0
  );

  // Processing fees as outflow (simplified - not tracked in current schema)
  const totalOutflow = 0;

  const netCashFlow = totalInflow - totalOutflow;
  const operatingCashFlow = totalInflow; // Simplified

  // Calculate accounts receivable (unpaid invoices)
  const unpaidInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
    },
    select: {
      total: true,
    },
  });

  const accountsReceivable = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.total?.toNumber() || 0),
    0
  );

  // Calculate average days to payment
  const paidInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: 'PAID',
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      payments: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  let totalDaysToPayment = 0;
  let invoicesWithPayment = 0;

  for (const invoice of paidInvoices) {
    if (invoice.payments.length > 0) {
      const firstPayment = invoice.payments[0];
      const days = Math.ceil(
        (firstPayment.createdAt.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalDaysToPayment += days;
      invoicesWithPayment++;
    }
  }

  const averageDaysToPayment = invoicesWithPayment > 0
    ? totalDaysToPayment / invoicesWithPayment
    : 0;

  // Cash conversion cycle (simplified: DSO only)
  const cashConversionCycle = averageDaysToPayment;

  return {
    totalInflow,
    totalOutflow,
    netCashFlow,
    operatingCashFlow,
    accountsReceivable,
    averageDaysToPayment,
    cashConversionCycle,
  };
}

/**
 * Get cash flow trend over time
 */
export async function getCashFlowTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<CashFlowTrend[]> {
  const payments = await db.payment.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      amount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by period
  const periodMap = new Map<string, { inflow: number; outflow: number }>();

  for (const payment of payments) {
    const period = formatPeriod(payment.createdAt, granularity);
    const current = periodMap.get(period) || { inflow: 0, outflow: 0 };
    current.inflow += payment.amount?.toNumber() || 0;
    // processingFee not tracked in current schema
    periodMap.set(period, current);
  }

  // Generate trend with cumulative
  const periods = generatePeriods(dateRange.start, dateRange.end, granularity);
  let cumulative = 0;

  return periods.map((period) => {
    const data = periodMap.get(period) || { inflow: 0, outflow: 0 };
    const net = data.inflow - data.outflow;
    cumulative += net;

    return {
      period,
      inflow: data.inflow,
      outflow: data.outflow,
      net,
      cumulative,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS RECEIVABLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get accounts receivable aging report
 */
export async function getAccountsReceivableAging(
  organizationId: string
): Promise<AccountsReceivableAging> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const unpaidInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
    },
    select: {
      total: true,
      createdAt: true,
      dueDate: true,
    },
  });

  let current = 0;
  let overdue30 = 0;
  let overdue60 = 0;
  let overdue90Plus = 0;

  for (const invoice of unpaidInvoices) {
    const amount = invoice.total?.toNumber() || 0;
    const dueDate = invoice.dueDate || invoice.createdAt;

    if (dueDate >= thirtyDaysAgo) {
      current += amount;
    } else if (dueDate >= sixtyDaysAgo) {
      overdue30 += amount;
    } else if (dueDate >= ninetyDaysAgo) {
      overdue60 += amount;
    } else {
      overdue90Plus += amount;
    }
  }

  return {
    current,
    overdue30,
    overdue60,
    overdue90Plus,
    total: current + overdue30 + overdue60 + overdue90Plus,
  };
}

/**
 * Get list of overdue invoices
 */
export async function getOverdueInvoices(
  organizationId: string,
  limit: number = 20
): Promise<{
  id: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  dueDate: Date;
}[]> {
  const now = new Date();

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
      dueDate: { lt: now },
    },
    include: {
      customer: {
        select: { name: true },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: limit,
  });

  return invoices.map((inv) => ({
    id: inv.id,
    customerName: inv.customer?.name || 'Unknown',
    amount: inv.total?.toNumber() || 0,
    daysOverdue: Math.ceil(
      (now.getTime() - (inv.dueDate?.getTime() || inv.createdAt.getTime())) / (1000 * 60 * 60 * 24)
    ),
    dueDate: inv.dueDate || inv.createdAt,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get payment method breakdown
 */
export async function getPaymentMethodBreakdown(
  organizationId: string,
  dateRange: DateRange
): Promise<PaymentMethodBreakdown[]> {
  const payments = await db.payment.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      method: true,
      amount: true,
    },
  });

  // Group by method
  const methodMap = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  for (const payment of payments) {
    const method = payment.method || 'other';
    const amount = payment.amount?.toNumber() || 0;

    const current = methodMap.get(method) || { amount: 0, count: 0 };
    current.amount += amount;
    current.count++;
    methodMap.set(method, current);

    totalAmount += amount;
  }

  return Array.from(methodMap.entries())
    .map(([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      avgTransactionValue: data.count > 0 ? data.amount / data.count : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate DSO (Days Sales Outstanding)
 */
export async function calculateDSO(
  organizationId: string,
  dateRange: DateRange
): Promise<number> {
  // Get total credit sales (invoices) for the period
  const invoices = await db.invoice.aggregate({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    _sum: {
      total: true,
    },
  });

  const totalSales = invoices._sum.total?.toNumber() || 0;

  // Get accounts receivable at end of period
  const accountsReceivable = await db.invoice.aggregate({
    where: {
      organizationId,
      status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
      createdAt: { lte: dateRange.end },
    },
    _sum: {
      total: true,
    },
  });

  const ar = accountsReceivable._sum.total?.toNumber() || 0;

  // Calculate DSO
  const days = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  return totalSales > 0 ? (ar / totalSales) * days : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate financial KPIs for dashboard
 */
export async function generateFinancialKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<KPIResult[]> {
  const metrics = await calculateCashFlowMetrics(organizationId, dateRange);
  const aging = await getAccountsReceivableAging(organizationId);
  const dso = await calculateDSO(organizationId, dateRange);

  return [
    {
      id: 'net_cash_flow',
      name: 'Flujo de Caja Neto',
      value: metrics.netCashFlow,
      unit: 'currency',
      trend: metrics.netCashFlow > 0 ? 'up' : metrics.netCashFlow < 0 ? 'down' : 'stable',
      period: dateRange,
    },
    {
      id: 'accounts_receivable',
      name: 'Cuentas por Cobrar',
      value: metrics.accountsReceivable,
      unit: 'currency',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'overdue_amount',
      name: 'Monto Vencido',
      value: aging.overdue30 + aging.overdue60 + aging.overdue90Plus,
      unit: 'currency',
      trend: aging.overdue90Plus > 0 ? 'down' : 'stable',
      period: dateRange,
    },
    {
      id: 'avg_days_to_payment',
      name: 'Días Promedio Cobro',
      value: metrics.averageDaysToPayment,
      unit: 'days',
      trend: metrics.averageDaysToPayment <= 30 ? 'up' : metrics.averageDaysToPayment <= 45 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'dso',
      name: 'DSO',
      value: dso,
      unit: 'days',
      trend: dso <= 30 ? 'up' : dso <= 45 ? 'stable' : 'down',
      period: dateRange,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPeriod(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'hour':
      return `${date.toISOString().slice(0, 10)} ${date.getHours().toString().padStart(2, '0')}:00`;
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toISOString().slice(0, 10);
  }
}

function generatePeriods(start: Date, end: Date, granularity: TimeGranularity): string[] {
  const periods: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    periods.push(formatPeriod(current, granularity));

    switch (granularity) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarter':
        current.setMonth(current.getMonth() + 3);
        break;
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }

  return [...new Set(periods)];
}
