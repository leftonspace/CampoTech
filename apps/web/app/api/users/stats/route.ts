import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;

    // Run all queries in parallel
    const [
      totalEmployees,
      activeTechnicians,
      inProgressJobs,
      averageRatingResult,
    ] = await Promise.all([
      // Total employees in organization
      prisma.user.count({
        where: { organizationId },
      }),

      // Active technicians
      prisma.user.count({
        where: {
          organizationId,
          role: 'TECHNICIAN',
          isActive: true,
        },
      }),

      // Count of technicians currently working (have IN_PROGRESS jobs)
      prisma.job.groupBy({
        by: ['technicianId'],
        where: {
          organizationId,
          status: 'IN_PROGRESS',
          technicianId: { not: null },
        },
      }).then((result) => result.length),

      // Average rating from technician reviews
      prisma.review.aggregate({
        where: {
          technician: { organizationId },
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalEmployees,
        activeTechnicians,
        inProgressCount: inProgressJobs,
        averageRating: averageRatingResult._avg.rating || 0,
      },
    });
  } catch (error) {
    console.error('User stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching user stats' },
      { status: 500 }
    );
  }
}
