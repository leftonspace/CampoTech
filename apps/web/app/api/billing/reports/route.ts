import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ConsolidatedBillingService,
} from '@/src/modules/locations/billing';
import { z } from 'zod';

const consolidatedBilling = new ConsolidatedBillingService(prisma);

const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const LocationSummarySchema = z.object({
  locationId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/billing/reports
 * Get organization-wide billing report
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateRange = DateRangeSchema.parse({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    const report = await consolidatedBilling.getOrganizationBillingReport(
      session.organizationId,
      {
        startDate: dateRange.startDate ? new Date(dateRange.startDate) : undefined,
        endDate: dateRange.endDate ? new Date(dateRange.endDate) : undefined,
      }
    );

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get billing report error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching billing report' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/reports/location-summary
 * Get billing summary for a specific location
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const input = LocationSummarySchema.parse(body);

    const summary = await consolidatedBilling.getLocationBillingSummary(
      session.organizationId,
      input.locationId,
      {
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      }
    );

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get location summary error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching location billing summary' },
      { status: 500 }
    );
  }
}
