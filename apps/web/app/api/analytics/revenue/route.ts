/**
 * Revenue Analytics API Route
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
    const range = searchParams.get('range') || 'month';
    const dateRange = getDateRangeFromPreset(range);

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        customer: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate KPIs
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const invoiceCount = invoices.length;
    const avgTicket = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

    const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
    const paidRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

    // Top customers
    const customerTotals: Record<string, { name: string; total: number; count: number }> = {};
    invoices.forEach((inv) => {
      if (!inv.customer) return;
      const id = inv.customer.id;
      if (!customerTotals[id]) {
        customerTotals[id] = { name: inv.customer.name, total: 0, count: 0 };
      }
      customerTotals[id].total += inv.total ? Number(inv.total) : 0;
      customerTotals[id].count += 1;
    });

    const topCustomers = Object.entries(customerTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, data]) => ({
        id,
        name: data.name,
        value: data.total,
        secondaryValue: data.count,
      }));

    return NextResponse.json({
      kpis: {
        totalRevenue: { value: Math.round(totalRevenue), change: 0 },
        invoiceCount: { value: invoiceCount, change: 0 },
        avgTicket: { value: Math.round(avgTicket), change: 0 },
        collectionRate: { value: Math.round(collectionRate * 10) / 10, change: 0 },
        growthRate: { value: 0, change: 0 },
        pendingRevenue: { value: Math.round(totalRevenue - paidRevenue), change: 0 },
      },
      revenueTrend: [],
      revenueByService: [],
      revenueByPayment: [],
      topCustomers,
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}
