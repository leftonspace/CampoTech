import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analytics/locations
 * Get location analytics data
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
    const view = searchParams.get('view') || 'comparison';

    // Parse date range
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    // Get locations for the organization
    const locations = await prisma.location.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
      },
    });

    // Get job counts by location
    const jobCounts = await prisma.job.groupBy({
      by: ['locationId'],
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const jobCountMap = new Map(
      jobCounts.map((j) => [j.locationId, j._count.id])
    );

    // Build comparison data
    const locationData = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      isActive: loc.isActive,
      totalJobs: jobCountMap.get(loc.id) || 0,
      revenue: 0, // Placeholder
      completionRate: 0, // Placeholder
    }));

    if (view === 'comparison') {
      return NextResponse.json({
        success: true,
        data: {
          locations: locationData,
          dateRange: { start: startDate, end: endDate },
        },
      });
    }

    // Default response
    return NextResponse.json({
      success: true,
      data: { locations: locationData },
    });
  } catch (error) {
    console.error('Location analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching location analytics' },
      { status: 500 }
    );
  }
}
