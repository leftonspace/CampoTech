import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { CreateLocationSchema, LocationFiltersSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

/**
 * GET /api/locations
 * List locations for the organization
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
    const filters = LocationFiltersSchema.parse({
      type: searchParams.get('type') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      isHeadquarters: searchParams.get('isHeadquarters') || undefined,
      managerId: searchParams.get('managerId') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    });

    const result = await locationService.listLocations(session.organizationId, filters);

    return NextResponse.json({
      success: true,
      data: result.locations,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('List locations error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching locations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations
 * Create a new location
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

    // Check user has permission (owner or admin)
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateLocationSchema.parse(body);

    const location = await locationService.createLocation(
      session.organizationId,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: location,
    }, { status: 201 });
  } catch (error) {
    console.error('Create location error:', error);

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
      { success: false, error: 'Error creating location' },
      { status: 500 }
    );
  }
}
