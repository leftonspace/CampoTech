/**
 * Locations API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.location.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List locations error:', error);
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

    // Generate code from name if not provided
    const code = body.code || body.name.substring(0, 10).toUpperCase().replace(/\s+/g, '-');

    // Build address JSON object from form fields
    const addressJson = {
      street: body.address || '',
      city: body.city || '',
      province: body.state || '',
      postalCode: body.postalCode || '',
      country: 'Argentina',
    };

    // Build coordinates if provided (use undefined for optional Json fields, not null)
    const coordinatesJson = body.coordinates?.lat && body.coordinates?.lng
      ? { lat: body.coordinates.lat, lng: body.coordinates.lng }
      : undefined;

    const location = await prisma.location.create({
      data: {
        code,
        name: body.name,
        type: body.type || 'BRANCH',
        address: addressJson,
        coordinates: coordinatesJson,
        phone: body.phone,
        email: body.email,
        isHeadquarters: body.isHeadquarters || false,
        coverageRadius: body.coverageRadiusKm ? Math.round(body.coverageRadiusKm) : null,
        organizationId: session.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      data: location,
    }, { status: 201 });
  } catch (error) {
    console.error('Create location error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating location' },
      { status: 500 }
    );
  }
}
