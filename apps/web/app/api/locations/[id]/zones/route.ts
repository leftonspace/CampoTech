import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { CreateZoneSchema, ZoneFiltersSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/locations/[id]/zones
 * List zones for a specific location
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: locationId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filters = ZoneFiltersSchema.parse({
      locationId,
      isActive: searchParams.get('isActive') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 50,
    });

    const result = await locationService.listZones(session.organizationId, filters);

    return NextResponse.json({
      success: true,
      data: result.zones,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('List zones error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching zones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations/[id]/zones
 * Create a new zone for the location
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: locationId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user has permission (owner or admin)
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateZoneSchema.parse({
      ...body,
      locationId,
    });

    const zone = await locationService.createZone(session.organizationId, validatedData);

    return NextResponse.json({
      success: true,
      data: zone,
    }, { status: 201 });
  } catch (error) {
    console.error('Create zone error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error creating zone' },
      { status: 500 }
    );
  }
}
