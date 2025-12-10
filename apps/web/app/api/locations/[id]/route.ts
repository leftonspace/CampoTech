import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { UpdateLocationSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/locations/[id]
 * Get a specific location
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const location = await locationService.getLocation(session.organizationId, id);

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('Get location error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching location' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations/[id]
 * Update a location
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

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
    const validatedData = UpdateLocationSchema.parse(body);

    const location = await locationService.updateLocation(
      session.organizationId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('Update location error:', error);

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
      { success: false, error: 'Error updating location' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/locations/[id]
 * Delete (deactivate) a location
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user has permission (owner only)
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Only owners can delete locations' },
        { status: 403 }
      );
    }

    await locationService.deleteLocation(session.organizationId, id);

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    console.error('Delete location error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error deleting location' },
      { status: 500 }
    );
  }
}
