import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  CapacityManager,
  CapacityError,
} from '@/src/modules/locations/resources';
import { z } from 'zod';

const capacityManager = new CapacityManager(prisma);

const DateSchema = z.string().datetime().optional();

/**
 * GET /api/locations/capacity
 * Get capacity information for locations
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
    const view = searchParams.get('view') || 'summary';
    const locationId = searchParams.get('locationId');
    const dateStr = searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : new Date();

    if (view === 'summary') {
      const summary = await capacityManager.getOrganizationCapacity(
        session.organizationId,
        date
      );
      return NextResponse.json({
        success: true,
        data: summary,
      });
    }

    if (view === 'location' && locationId) {
      const capacity = await capacityManager.getLocationCapacity(
        session.organizationId,
        locationId,
        date
      );
      return NextResponse.json({
        success: true,
        data: capacity,
      });
    }

    if (view === 'forecast' && locationId) {
      const days = parseInt(searchParams.get('days') || '14', 10);
      const forecast = await capacityManager.getCapacityForecast(
        session.organizationId,
        locationId,
        days
      );
      return NextResponse.json({
        success: true,
        data: forecast,
      });
    }

    if (view === 'workload') {
      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : new Date();

      const distribution = await capacityManager.getWorkloadDistribution(
        session.organizationId,
        startDate,
        endDate
      );
      return NextResponse.json({
        success: true,
        data: distribution,
      });
    }

    if (view === 'available-slots' && locationId) {
      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date();
      const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next 7 days

      const slots = await capacityManager.getAvailableSlots(
        session.organizationId,
        locationId,
        startDate,
        endDate
      );
      return NextResponse.json({
        success: true,
        data: { slots },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter or missing locationId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get capacity error:', error);

    if (error instanceof CapacityError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching capacity information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations/capacity
 * Check slot availability or find best slot
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
    const { action, locationId, date, timeSlot, searchDays } = body;

    if (action === 'check-slot') {
      if (!locationId || !date || !timeSlot) {
        return NextResponse.json(
          { success: false, error: 'locationId, date, and timeSlot are required' },
          { status: 400 }
        );
      }

      const result = await capacityManager.isTimeSlotAvailable(
        session.organizationId,
        locationId,
        new Date(date),
        timeSlot
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (action === 'find-slot') {
      if (!locationId || !date) {
        return NextResponse.json(
          { success: false, error: 'locationId and date are required' },
          { status: 400 }
        );
      }

      const result = await capacityManager.findBestAvailableSlot(
        session.organizationId,
        locationId,
        new Date(date),
        searchDays || 7
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "check-slot" or "find-slot"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Capacity action error:', error);

    if (error instanceof CapacityError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error processing capacity request' },
      { status: 500 }
    );
  }
}
