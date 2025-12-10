/**
 * Revenue Analytics API Route
 * ===========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Revenue metrics and trends for the analytics dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '@repo/database';
import { getDateRangeFromPreset } from '../../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/revenue
// Returns revenue analytics data
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

    // Fetch current period data
    const [currentInvoices, previousInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          items: true,
          job: {
            select: { serviceType: true },
          },
          customer: {
            select: { id: true, firstName: true, lastName: true, companyName: true },
          },
        },
      }).catch(() => []),
      prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: previousRange.start,
            lte: previousRange.end,
          },
        },
      }).catch(() => []),
    ]);

    // Calculate KPIs
    const totalRevenue = currentInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const previousRevenue = previousInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const invoiceCount = currentInvoices.length;
    const previousCount = previousInvoices.length;
    const invoiceCountChange = previousCount > 0 ? ((invoiceCount - previousCount) / previousCount) * 100 : 0;

    const avgTicket = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
    const previousAvgTicket = previousCount > 0 ? previousRevenue / previousCount : 0;
    const avgTicketChange = previousAvgTicket > 0 ? ((avgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;

    const paidInvoices = currentInvoices.filter((inv) => inv.status === 'PAID');
    const paidRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

    // Revenue trend by day/week
    const revenueTrend = aggregateByPeriod(currentInvoices, dateRange.start, dateRange.end);

    // Revenue by service type
    const revenueByService = aggregateByServiceType(currentInvoices);

    // Revenue by payment method
    const revenueByPayment = aggregateByPaymentMethod(currentInvoices);

    // Top customers
    const topCustomers = aggregateByCustomer(currentInvoices);

    return NextResponse.json({
      kpis: {
        totalRevenue: { value: totalRevenue, change: Math.round(revenueChange * 10) / 10 },
        invoiceCount: { value: invoiceCount, change: Math.round(invoiceCountChange * 10) / 10 },
        avgTicket: { value: Math.round(avgTicket), change: Math.round(avgTicketChange * 10) / 10 },
        collectionRate: { value: Math.round(collectionRate * 10) / 10, change: 0 },
        growthRate: { value: Math.round(revenueChange * 10) / 10, change: 0 },
        pendingRevenue: { value: totalRevenue - paidRevenue, change: 0 },
      },
      revenueTrend,
      revenueByService,
      revenueByPayment,
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

// Helper functions
function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  };
}

function aggregateByPeriod(
  invoices: { createdAt: Date; total: number | null }[],
  start: Date,
  end: Date
): { label: string; value: number }[] {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const groupByWeek = days > 31;

  const groups: Record<string, number> = {};
  invoices.forEach((inv) => {
    const date = new Date(inv.createdAt);
    const key = groupByWeek
      ? `Sem ${getWeekNumber(date)}`
      : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    groups[key] = (groups[key] || 0) + (inv.total || 0);
  });

  return Object.entries(groups).map(([label, value]) => ({ label, value }));
}

function aggregateByServiceType(
  invoices: { job?: { serviceType?: string | null } | null; total: number | null }[]
): { label: string; value: number; color: string }[] {
  const colors: Record<string, string> = {
    installation: '#3b82f6',
    repair: '#ef4444',
    maintenance: '#22c55e',
    inspection: '#f59e0b',
    consultation: '#8b5cf6',
    other: '#6b7280',
  };

  const groups: Record<string, number> = {};
  invoices.forEach((inv) => {
    const type = inv.job?.serviceType || 'other';
    groups[type] = (groups[type] || 0) + (inv.total || 0);
  });

  return Object.entries(groups).map(([label, value]) => ({
    label: formatServiceType(label),
    value,
    color: colors[label] || colors.other,
  }));
}

function aggregateByPaymentMethod(
  invoices: { paymentMethod?: string | null; total: number | null }[]
): { label: string; value: number; color: string }[] {
  const colors: Record<string, string> = {
    cash: '#22c55e',
    card: '#3b82f6',
    transfer: '#8b5cf6',
    mercadopago: '#00b1ea',
    check: '#f59e0b',
    other: '#6b7280',
  };

  const groups: Record<string, number> = {};
  invoices.forEach((inv) => {
    const method = inv.paymentMethod || 'other';
    groups[method] = (groups[method] || 0) + (inv.total || 0);
  });

  return Object.entries(groups).map(([label, value]) => ({
    label: formatPaymentMethod(label),
    value,
    color: colors[label] || colors.other,
  }));
}

function aggregateByCustomer(
  invoices: {
    customer?: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null } | null;
    total: number | null
  }[]
): { id: string; name: string; value: number; secondaryValue: number }[] {
  const groups: Record<string, { name: string; total: number; count: number }> = {};

  invoices.forEach((inv) => {
    if (!inv.customer) return;
    const id = inv.customer.id;
    const name = inv.customer.companyName || `${inv.customer.firstName || ''} ${inv.customer.lastName || ''}`.trim() || 'Unknown';

    if (!groups[id]) {
      groups[id] = { name, total: 0, count: 0 };
    }
    groups[id].total += inv.total || 0;
    groups[id].count += 1;
  });

  return Object.entries(groups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: data.total,
      secondaryValue: data.count,
    }));
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
}

function formatServiceType(type: string): string {
  const labels: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    consultation: 'Consulta',
    other: 'Otros',
  };
  return labels[type] || type;
}

function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    mercadopago: 'MercadoPago',
    check: 'Cheque',
    other: 'Otros',
  };
  return labels[method] || method;
}
