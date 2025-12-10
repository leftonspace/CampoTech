import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { UpdateZoneSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/zones/[id]
 * Get a specific zone
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

    const zone = await locationService.getZone(session.organizationId, id);

    return NextResponse.json({
      success: true,
      data: zone,
    });
  } catch (error) {
    console.error('Get zone error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching zone' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/zones/[id]
 * Update a zone
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
    const validatedData = UpdateZoneSchema.parse(body);

    const zone = await locationService.updateZone(
      session.organizationId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: zone,
    });
  } catch (error) {
    console.error('Update zone error:', error);

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
      { success: false, error: 'Error updating zone' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/zones/[id]
 * Delete (deactivate) a zone
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

    // Check user has permission (owner or admin)
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await locationService.deleteZone(session.organizationId, id);

    return NextResponse.json({
      success: true,
      message: 'Zone deleted successfully',
    });
  } catch (error) {
    console.error('Delete zone error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error deleting zone' },
      { status: 500 }
    );
  }
}
