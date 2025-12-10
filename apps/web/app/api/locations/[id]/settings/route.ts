import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { UpdateLocationSettingsSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/locations/[id]/settings
 * Get location settings
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

    const settings = await locationService.getLocationSettings(session.organizationId, id);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get location settings error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching location settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations/[id]/settings
 * Update location settings
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
    const validatedData = UpdateLocationSettingsSchema.parse(body);

    const settings = await locationService.updateLocationSettings(
      session.organizationId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Update location settings error:', error);

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
      { success: false, error: 'Error updating location settings' },
      { status: 500 }
    );
  }
}
