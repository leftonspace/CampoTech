/**
 * Location API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const location = await prisma.location.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('Get location error:', error);
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

    const location = await prisma.location.updateMany({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        updatedAt: new Date(),
      },
    });

    if (location.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.location.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update location error:', error);
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

    const result = await prisma.location.updateMany({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    console.error('Delete location error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting location' },
      { status: 500 }
    );
  }
}
