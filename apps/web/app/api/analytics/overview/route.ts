/**
 * Analytics Overview API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getDateRangeFromPreset(range: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (range) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const rangePreset = searchParams.get('range') || 'month';
    const dateRange = getDateRangeFromPreset(rangePreset);

    // Fetch data in parallel
    const [jobs, invoices, customers] = await Promise.all([
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: { id: true, total: true, status: true },
      }),
      prisma.customer.count({
        where: { organizationId },
      }),
    ]);

    // Calculate KPIs
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const paidInvoices = invoices.filter((i) => i.status === 'PAID');
    const collectedRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const collectionRate = totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0;

    const avgTicket = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    // Jobs by status
    const statusCounts: Record<string, number> = {};
    jobs.forEach((job) => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    const jobsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      label: formatStatus(status),
      value: count,
      color: getStatusColor(status),
    }));

    return NextResponse.json({
      kpis: {
        totalRevenue: { value: Math.round(totalRevenue), change: 0 },
        totalJobs: { value: totalJobs, change: 0 },
        activeCustomers: { value: customers, change: 0 },
        completionRate: { value: Math.round(completionRate * 10) / 10, change: 0 },
        avgTicket: { value: Math.round(avgTicket), change: 0 },
        collectionRate: { value: Math.round(collectionRate * 10) / 10, change: 0 },
      },
      revenueTrend: [],
      jobsTrend: [],
      revenueByService: [],
      jobsByStatus,
      infrastructure: {
        etlStatus: 'healthy',
        lastUpdate: new Date().toISOString(),
        recordsProcessed: 0,
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

function formatStatus(status: string): string {
  const names: Record<string, string> = {
    pending: 'Pendiente',
    scheduled: 'Programado',
    en_camino: 'En Camino',
    working: 'En Progreso',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return names[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#f59e0b',
    scheduled: '#3b82f6',
    en_camino: '#8b5cf6',
    working: '#6366f1',
    completed: '#22c55e',
    cancelled: '#ef4444',
  };
  return colors[status] || '#6b7280';
}
