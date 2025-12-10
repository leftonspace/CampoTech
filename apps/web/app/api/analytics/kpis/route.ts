/**
 * KPIs API Route
 * ==============
 *
 * Phase 10.2: Business Intelligence KPIs
 * Returns all KPIs for the organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

import {
  // Revenue KPIs
  generateRevenueKPIs,
  generateMRRKPIs,
  generateARPUKPIs,
  // Operations KPIs
  generateJobKPIs,
  generateTechnicianKPIs,
  generateSLAKPIs,
  // Financial KPIs
  generateFinancialKPIs,
  generateProfitabilityKPIs,
  generateTaxKPIs,
  // Customer KPIs
  generateCustomerKPIs,
  generateSatisfactionKPIs,
  generateSegmentKPIs,
  // Helpers
  getDateRangeFromPreset,
} from '@/src/analytics';

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
    const category = searchParams.get('category'); // Optional: filter by category
    const dateRange = getDateRangeFromPreset(rangePreset);

    // Build category list based on filter
    const categories: KPICategory[] = [];

    // Revenue KPIs
    if (!category || category === 'revenue') {
      const [revenueKPIs, mrrKPIs, arpuKPIs] = await Promise.all([
        generateRevenueKPIs(organizationId, dateRange),
        generateMRRKPIs(organizationId, dateRange),
        generateARPUKPIs(organizationId, dateRange),
      ]);

      categories.push({
        id: 'revenue',
        name: 'Ingresos',
        kpis: [...revenueKPIs, ...mrrKPIs, ...arpuKPIs].map(formatKPI),
      });
    }

    // Operations KPIs
    if (!category || category === 'operations') {
      const [jobKPIs, technicianKPIs, slaKPIs] = await Promise.all([
        generateJobKPIs(organizationId, dateRange),
        generateTechnicianKPIs(organizationId, dateRange),
        generateSLAKPIs(organizationId, dateRange),
      ]);

      categories.push({
        id: 'operations',
        name: 'Operaciones',
        kpis: [...jobKPIs, ...technicianKPIs, ...slaKPIs].map(formatKPI),
      });
    }

    // Financial KPIs
    if (!category || category === 'financial') {
      const [financialKPIs, profitabilityKPIs, taxKPIs] = await Promise.all([
        generateFinancialKPIs(organizationId, dateRange),
        generateProfitabilityKPIs(organizationId, dateRange),
        generateTaxKPIs(organizationId, dateRange),
      ]);

      categories.push({
        id: 'financial',
        name: 'Finanzas',
        kpis: [...financialKPIs, ...profitabilityKPIs, ...taxKPIs].map(formatKPI),
      });
    }

    // Customer KPIs
    if (!category || category === 'customers') {
      const [customerKPIs, satisfactionKPIs, segmentKPIs] = await Promise.all([
        generateCustomerKPIs(organizationId, dateRange),
        generateSatisfactionKPIs(organizationId, dateRange),
        generateSegmentKPIs(organizationId, dateRange),
      ]);

      categories.push({
        id: 'customers',
        name: 'Clientes',
        kpis: [...customerKPIs, ...satisfactionKPIs, ...segmentKPIs].map(formatKPI),
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

function formatKPI(kpi: {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  format?: string;
  status?: 'good' | 'warning' | 'bad';
}) {
  return {
    id: kpi.id,
    name: kpi.name,
    value: kpi.value,
    previousValue: kpi.previousValue,
    changePercent: kpi.changePercent,
    format: kpi.format || 'number',
    status: kpi.status,
  };
}
