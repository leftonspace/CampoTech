import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LocationService, LocationError } from '@/src/modules/locations';
import { CreateLocationAfipConfigSchema, UpdateLocationAfipConfigSchema } from '@/src/modules/locations';

const locationService = new LocationService(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/locations/[id]/afip
 * Get AFIP configuration for a location
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

    // Check user has permission (owner, admin, or accountant)
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const config = await locationService.getLocationAfipConfig(session.organizationId, id);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get AFIP config error:', error);

    if (error instanceof LocationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching AFIP configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations/[id]/afip
 * Create AFIP configuration for a location
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user has permission (owner only for AFIP config)
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Only owners can configure AFIP settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateLocationAfipConfigSchema.parse({
      ...body,
      locationId: id,
    });

    const config = await locationService.upsertLocationAfipConfig(
      session.organizationId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: config,
    }, { status: 201 });
  } catch (error) {
    console.error('Create AFIP config error:', error);

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
      { success: false, error: 'Error creating AFIP configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations/[id]/afip
 * Update AFIP configuration for a location
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

    // Check user has permission (owner only for AFIP config)
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Only owners can configure AFIP settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = UpdateLocationAfipConfigSchema.parse(body);

    const config = await locationService.upsertLocationAfipConfig(
      session.organizationId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Update AFIP config error:', error);

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
      { success: false, error: 'Error updating AFIP configuration' },
      { status: 500 }
    );
  }
}
