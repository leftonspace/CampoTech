/**
 * Analytics Overview API Route
 * ============================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Returns overview dashboard data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

import { generateRevenueKPIs, getRevenueTrend, getRevenueByServiceType } from '../../../../../../src/analytics/kpis/revenue/revenue-metrics';
import { generateJobKPIs, getJobTrend, getJobsByStatus } from '../../../../../../src/analytics/kpis/operations/job-metrics';
import { generateCustomerKPIs } from '../../../../../../src/analytics/kpis/customers/customer-lifetime-value';
import { getDateRangeFromPreset } from '../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/overview
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get date range from query params
    const { searchParams } = new URL(req.url);
    const rangePreset = searchParams.get('range') || 'month';
    const dateRange = getDateRangeFromPreset(rangePreset);

    // Fetch all data in parallel
    const [
      revenueKPIs,
      jobKPIs,
      customerKPIs,
      revenueTrend,
      jobsTrend,
      revenueByService,
      jobsByStatus,
    ] = await Promise.all([
      generateRevenueKPIs(organizationId, dateRange),
      generateJobKPIs(organizationId, dateRange),
      generateCustomerKPIs(organizationId, dateRange),
      getRevenueTrend(organizationId, dateRange, 'day'),
      getJobTrend(organizationId, dateRange, 'day'),
      getRevenueByServiceType(organizationId, dateRange),
      getJobsByStatus(organizationId, dateRange),
    ]);

    // Format response
    const response = {
      kpis: {
        totalRevenue: {
          value: revenueKPIs.find((k) => k.id === 'total_revenue')?.value || 0,
          change: revenueKPIs.find((k) => k.id === 'total_revenue')?.changePercent || 0,
        },
        totalJobs: {
          value: jobKPIs.find((k) => k.id === 'total_jobs')?.value || 0,
          change: jobKPIs.find((k) => k.id === 'total_jobs')?.changePercent || 0,
        },
        activeCustomers: {
          value: customerKPIs.find((k) => k.id === 'active_customers')?.value || 0,
          change: customerKPIs.find((k) => k.id === 'active_customers')?.changePercent || 0,
        },
        completionRate: {
          value: jobKPIs.find((k) => k.id === 'completion_rate')?.value || 0,
          change: 0,
        },
        avgTicket: {
          value: revenueKPIs.find((k) => k.id === 'avg_invoice_value')?.value || 0,
          change: 0,
        },
        collectionRate: {
          value: revenueKPIs.find((k) => k.id === 'collection_rate')?.value || 0,
          change: 0,
        },
      },
      revenueTrend: revenueTrend.map((d) => ({
        label: d.period,
        value: d.revenue,
      })),
      jobsTrend: jobsTrend.map((d) => ({
        label: d.period,
        value: d.total,
      })),
      revenueByService: revenueByService.slice(0, 6).map((d) => ({
        label: formatServiceType(d.serviceType),
        value: d.revenue,
      })),
      jobsByStatus: jobsByStatus.map((d) => ({
        label: formatStatus(d.status),
        value: d.count,
        color: getStatusColor(d.status),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatServiceType(type: string): string {
  const names: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };
  return names[type] || type;
}

function formatStatus(status: string): string {
  const names: Record<string, string> = {
    pendiente: 'Pendiente',
    programado: 'Programado',
    en_camino: 'En Camino',
    en_progreso: 'En Progreso',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };
  return names[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pendiente: '#f59e0b',
    programado: '#3b82f6',
    en_camino: '#8b5cf6',
    en_progreso: '#6366f1',
    completado: '#22c55e',
    cancelado: '#ef4444',
  };
  return colors[status] || '#6b7280';
}
