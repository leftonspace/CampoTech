/**
 * Billing Routing API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { jobId, customerId, explicitLocationId } = body;

    // If explicit location provided, use it
    if (explicitLocationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: explicitLocationId,
          organizationId: session.organizationId,
        },
        select: { id: true, name: true },
      });

      if (location) {
        return NextResponse.json({
          success: true,
          data: {
            locationId: location.id,
            locationName: location.name,
            reason: 'explicit_selection',
          },
        });
      }
    }

    // Get first active location as default
    const defaultLocation = await prisma.location.findFirst({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!defaultLocation) {
      return NextResponse.json({
        success: false,
        error: 'No active locations found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        locationId: defaultLocation.id,
        locationName: defaultLocation.name,
        reason: 'default_location',
      },
    });
  } catch (error) {
    console.error('Invoice routing error:', error);
    return NextResponse.json(
      { success: false, error: 'Error determining invoice routing' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active locations as routing options
    const locations = await prisma.location.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: locations.map((loc: typeof locations[number]) => ({
        locationId: loc.id,
        locationName: loc.name,
        address: loc.address,
        hasAfipConfig: false, // Placeholder
        canIssueInvoices: true,
      })),
    });
  } catch (error) {
    console.error('Get routing options error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching routing options' },
      { status: 500 }
    );
  }
}
