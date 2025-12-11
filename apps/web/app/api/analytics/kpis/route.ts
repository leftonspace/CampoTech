/**
 * KPIs API Route
 * ==============
 *
 * Phase 10.2: Business Intelligence KPIs
 * Returns all KPIs for the organization.
 *
 * NOTE: This is a stub implementation. Full analytics requires monorepo package setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface KPICategory {
  id: string;
  name: string;
  kpis: {
    id: string;
    name: string;
    value: number;
    previousValue?: number;
    changePercent?: number;
    format: string;
    status?: 'good' | 'warning' | 'bad';
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/kpis
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get date range from query params
    const { searchParams } = new URL(req.url);
    const rangePreset = searchParams.get('range') || 'month';
    const category = searchParams.get('category'); // Optional: filter by category
    const dateRange = getDateRangeFromPreset(rangePreset);

    // Get actual data from database
    const [jobCount, customerCount, invoiceData, reviewData] = await Promise.all([
      prisma.job.count({
        where: {
          organizationId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
      }).catch(() => 0),
      prisma.customer.count({
        where: { organizationId },
      }).catch(() => 0),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: 'PAID',
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        _sum: { total: true },
        _count: true,
      }).catch(() => ({ _sum: { total: 0 }, _count: 0 })),
      prisma.review.aggregate({
        where: {
          organizationId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        _avg: { rating: true },
        _count: true,
      }).catch(() => ({ _avg: { rating: 0 }, _count: 0 })),
    ]);

    // Build category list based on filter
    const categories: KPICategory[] = [];

    // Revenue KPIs
    if (!category || category === 'revenue') {
      const revenue = invoiceData._sum?.total ? Number(invoiceData._sum.total) : 0;
      categories.push({
        id: 'revenue',
        name: 'Ingresos',
        kpis: [
          {
            id: 'total_revenue',
            name: 'Ingresos Totales',
            value: revenue,
            format: 'currency',
            status: revenue > 0 ? 'good' : 'warning',
          },
          {
            id: 'invoice_count',
            name: 'Facturas Emitidas',
            value: invoiceData._count || 0,
            format: 'number',
            status: 'good',
          },
          {
            id: 'avg_invoice',
            name: 'Factura Promedio',
            value: invoiceData._count > 0 ? Math.round(revenue / invoiceData._count) : 0,
            format: 'currency',
            status: 'good',
          },
        ],
      });
    }

    // Operations KPIs
    if (!category || category === 'operations') {
      categories.push({
        id: 'operations',
        name: 'Operaciones',
        kpis: [
          {
            id: 'total_jobs',
            name: 'Trabajos Totales',
            value: jobCount,
            format: 'number',
            status: jobCount > 0 ? 'good' : 'warning',
          },
          {
            id: 'jobs_per_day',
            name: 'Trabajos por Día',
            value: Math.round(jobCount / getDaysInRange(dateRange) * 10) / 10,
            format: 'number',
            status: 'good',
          },
        ],
      });
    }

    // Customer KPIs
    if (!category || category === 'customers') {
      const avgRating = reviewData._avg?.rating ? Number(reviewData._avg.rating) : 0;
      categories.push({
        id: 'customers',
        name: 'Clientes',
        kpis: [
          {
            id: 'total_customers',
            name: 'Clientes Totales',
            value: customerCount,
            format: 'number',
            status: customerCount > 0 ? 'good' : 'warning',
          },
          {
            id: 'satisfaction',
            name: 'Satisfacción',
            value: Math.round(avgRating * 20), // Convert 5-star to percentage
            format: 'percent',
            status: avgRating >= 4 ? 'good' : avgRating >= 3 ? 'warning' : 'bad',
          },
          {
            id: 'review_count',
            name: 'Reseñas',
            value: reviewData._count || 0,
            format: 'number',
            status: 'good',
          },
        ],
      });
    }

    // Build summary of all KPIs
    const totalKPIs = categories.reduce((sum, cat) => sum + cat.kpis.length, 0);
    const goodKPIs = categories.reduce(
      (sum, cat) => sum + cat.kpis.filter((k) => k.status === 'good').length,
      0
    );
    const warningKPIs = categories.reduce(
      (sum, cat) => sum + cat.kpis.filter((k) => k.status === 'warning').length,
      0
    );
    const badKPIs = categories.reduce(
      (sum, cat) => sum + cat.kpis.filter((k) => k.status === 'bad').length,
      0
    );

    return NextResponse.json({
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        preset: rangePreset,
      },
      summary: {
        totalKPIs,
        goodKPIs,
        warningKPIs,
        badKPIs,
        healthScore: totalKPIs > 0 ? Math.round((goodKPIs / totalKPIs) * 100) : 0,
      },
      categories,
    });
  } catch (error) {
    console.error('KPIs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPIs' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDateRangeFromPreset(preset: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }

  return { start, end };
}

function getDaysInRange(dateRange: { start: Date; end: Date }): number {
  return Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)));
}
