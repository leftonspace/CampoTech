/**
 * Customers Analytics API Route
 * =============================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Customer segmentation, CLV, and retention metrics for analytics dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '@repo/database';
import { getDateRangeFromPreset } from '../../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/customers
// Returns customer analytics data
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';

    // Get date range
    const dateRange = getDateRangeFromPreset(range as 'today' | 'week' | 'month' | 'quarter' | 'year');
    const previousRange = getPreviousRange(dateRange.start, dateRange.end);

    // Fetch customers and related data
    const [customers, currentJobs, previousJobs, invoices, reviews] = await Promise.all([
      prisma.customer.findMany({
        where: { organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          createdAt: true,
          _count: {
            select: { jobs: true },
          },
        },
      }).catch(() => []),
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          customerId: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: previousRange.start,
            lte: previousRange.end,
          },
        },
        select: { customerId: true },
      }).catch(() => []),
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: 'PAID',
        },
        select: {
          customerId: true,
          total: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.review.findMany({
        where: { organizationId },
        select: {
          rating: true,
          createdAt: true,
        },
      }).catch(() => []),
    ]);

    // Calculate KPIs
    const totalCustomers = customers.length;

    // Active customers (had a job in the period)
    const activeCustomerIds = new Set(currentJobs.map((j) => j.customerId));
    const activeCustomers = activeCustomerIds.size;
    const previousActiveIds = new Set(previousJobs.map((j) => j.customerId));
    const activeChange = previousActiveIds.size > 0
      ? ((activeCustomers - previousActiveIds.size) / previousActiveIds.size) * 100
      : 0;

    // New customers (created in the period)
    const newCustomers = customers.filter((c) =>
      c.createdAt >= dateRange.start && c.createdAt <= dateRange.end
    ).length;
    const previousNewCustomers = customers.filter((c) =>
      c.createdAt >= previousRange.start && c.createdAt <= previousRange.end
    ).length;
    const newCustomersChange = previousNewCustomers > 0
      ? ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100
      : 0;

    // Churned customers (had activity before but not in this period)
    const previousActiveSet = new Set(previousJobs.map((j) => j.customerId));
    const churnedCustomers = Array.from(previousActiveSet).filter(
      (id) => !activeCustomerIds.has(id)
    ).length;
    const churnRate = previousActiveIds.size > 0
      ? (churnedCustomers / previousActiveIds.size) * 100
      : 0;

    // Average CLV (Customer Lifetime Value)
    const customerRevenue: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.customerId) {
        customerRevenue[inv.customerId] = (customerRevenue[inv.customerId] || 0) + (inv.total || 0);
      }
    });
    const clvValues = Object.values(customerRevenue);
    const avgCLV = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0;

    // Satisfaction score
    const periodReviews = reviews.filter((r) =>
      r.createdAt >= dateRange.start && r.createdAt <= dateRange.end
    );
    const ratings = periodReviews.filter((r) => r.rating !== null).map((r) => r.rating as number);
    const avgSatisfaction = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100
      : 0;

    // Customer growth trend
    const customerGrowth = aggregateCustomerGrowth(customers, dateRange.start, dateRange.end);

    // Customer segments
    const segments = calculateSegments(customers, customerRevenue);

    // Top customers by CLV
    const topCustomers = Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([customerId, revenue]) => {
        const customer = customers.find((c) => c.id === customerId);
        const name = customer?.companyName ||
          `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
          'Unknown';
        const jobCount = customer?._count?.jobs || 0;
        return {
          id: customerId,
          name,
          value: revenue,
          secondaryValue: jobCount,
        };
      });

    // Cohort retention (simplified)
    const cohortRetention = calculateCohortRetention(customers, currentJobs);

    // Satisfaction trend
    const satisfactionTrend = aggregateSatisfactionTrend(reviews, dateRange.start, dateRange.end);

    // Churn risk distribution
    const churnRiskDistribution = calculateChurnRisk(customers, currentJobs, invoices);

    // Customers by purchase frequency
    const customersByFrequency = calculateFrequencyDistribution(customers, currentJobs);

    return NextResponse.json({
      kpis: {
        totalCustomers: { value: totalCustomers, change: 0 },
        activeCustomers: { value: activeCustomers, change: Math.round(activeChange * 10) / 10 },
        newCustomers: { value: newCustomers, change: Math.round(newCustomersChange * 10) / 10 },
        churnedCustomers: { value: churnedCustomers, change: Math.round(churnRate * 10) / 10 },
        avgCLV: { value: Math.round(avgCLV), change: 0 },
        satisfaction: { value: Math.round(avgSatisfaction * 10) / 10, change: 0 },
      },
      customerGrowth,
      segments,
      topCustomers,
      cohortRetention,
      satisfactionTrend,
      churnRiskDistribution,
      customersByFrequency,
    });
  } catch (error) {
    console.error('Customers analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers analytics' },
      { status: 500 }
    );
  }
}

// Helper functions
function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  };
}

function aggregateCustomerGrowth(
  customers: { createdAt: Date }[],
  start: Date,
  end: Date
): { label: string; value: number }[] {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const groupByWeek = days > 31;

  // Cumulative count up to start
  let cumulative = customers.filter((c) => c.createdAt < start).length;

  const groups: Record<string, number> = {};
  const sorted = customers
    .filter((c) => c.createdAt >= start && c.createdAt <= end)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  sorted.forEach((customer) => {
    cumulative += 1;
    const date = new Date(customer.createdAt);
    const key = groupByWeek
      ? `Sem ${getWeekNumber(date)}`
      : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    groups[key] = cumulative;
  });

  return Object.entries(groups).map(([label, value]) => ({ label, value }));
}

function calculateSegments(
  customers: { id: string; _count?: { jobs: number } }[],
  revenue: Record<string, number>
): { label: string; value: number; color: string }[] {
  let vip = 0;
  let regular = 0;
  let occasional = 0;
  let inactive = 0;

  customers.forEach((customer) => {
    const customerRevenue = revenue[customer.id] || 0;
    const jobCount = customer._count?.jobs || 0;

    if (customerRevenue > 100000 || jobCount > 10) {
      vip += 1;
    } else if (jobCount >= 3) {
      regular += 1;
    } else if (jobCount >= 1) {
      occasional += 1;
    } else {
      inactive += 1;
    }
  });

  return [
    { label: 'VIP', value: vip, color: '#8b5cf6' },
    { label: 'Regular', value: regular, color: '#3b82f6' },
    { label: 'Ocasional', value: occasional, color: '#22c55e' },
    { label: 'Inactivo', value: inactive, color: '#6b7280' },
  ];
}

function calculateCohortRetention(
  customers: { id: string; createdAt: Date }[],
  jobs: { customerId: string | null }[]
): { label: string; value: number }[] {
  const now = new Date();
  const months: { label: string; value: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const cohort = customers.filter((c) =>
      c.createdAt >= monthStart && c.createdAt <= monthEnd
    );

    if (cohort.length === 0) {
      months.push({ label: monthStart.toLocaleDateString('es-AR', { month: 'short' }), value: 0 });
      continue;
    }

    const activeInCohort = cohort.filter((c) =>
      jobs.some((j) => j.customerId === c.id)
    ).length;

    const retentionRate = (activeInCohort / cohort.length) * 100;
    months.push({
      label: monthStart.toLocaleDateString('es-AR', { month: 'short' }),
      value: Math.round(retentionRate),
    });
  }

  return months;
}

function aggregateSatisfactionTrend(
  reviews: { rating: number | null; createdAt: Date }[],
  start: Date,
  end: Date
): { label: string; value: number }[] {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const groupByWeek = days > 31;

  const groups: Record<string, { sum: number; count: number }> = {};

  reviews
    .filter((r) => r.createdAt >= start && r.createdAt <= end && r.rating !== null)
    .forEach((review) => {
      const date = new Date(review.createdAt);
      const key = groupByWeek
        ? `Sem ${getWeekNumber(date)}`
        : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

      if (!groups[key]) {
        groups[key] = { sum: 0, count: 0 };
      }
      groups[key].sum += (review.rating as number) / 5 * 100;
      groups[key].count += 1;
    });

  return Object.entries(groups).map(([label, data]) => ({
    label,
    value: Math.round(data.count > 0 ? data.sum / data.count : 0),
  }));
}

function calculateChurnRisk(
  customers: { id: string }[],
  jobs: { customerId: string | null; createdAt: Date }[],
  invoices: { customerId: string | null; createdAt: Date }[]
): { label: string; value: number; color: string }[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let low = 0;
  let medium = 0;
  let high = 0;

  customers.forEach((customer) => {
    const customerJobs = jobs.filter((j) => j.customerId === customer.id);
    const lastJobDate = customerJobs.length > 0
      ? Math.max(...customerJobs.map((j) => j.createdAt.getTime()))
      : 0;

    if (lastJobDate >= thirtyDaysAgo.getTime()) {
      low += 1;
    } else if (lastJobDate >= ninetyDaysAgo.getTime()) {
      medium += 1;
    } else {
      high += 1;
    }
  });

  return [
    { label: 'Bajo', value: low, color: '#22c55e' },
    { label: 'Medio', value: medium, color: '#f59e0b' },
    { label: 'Alto', value: high, color: '#ef4444' },
  ];
}

function calculateFrequencyDistribution(
  customers: { id: string }[],
  jobs: { customerId: string | null }[]
): { label: string; value: number }[] {
  const frequency: Record<string, number> = {
    'Sin compras': 0,
    '1 compra': 0,
    '2-3 compras': 0,
    '4-6 compras': 0,
    '7+ compras': 0,
  };

  customers.forEach((customer) => {
    const jobCount = jobs.filter((j) => j.customerId === customer.id).length;

    if (jobCount === 0) {
      frequency['Sin compras'] += 1;
    } else if (jobCount === 1) {
      frequency['1 compra'] += 1;
    } else if (jobCount <= 3) {
      frequency['2-3 compras'] += 1;
    } else if (jobCount <= 6) {
      frequency['4-6 compras'] += 1;
    } else {
      frequency['7+ compras'] += 1;
    }
  });

  return Object.entries(frequency).map(([label, value]) => ({ label, value }));
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
}
