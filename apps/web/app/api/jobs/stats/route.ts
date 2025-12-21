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

    // Get date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Run all queries in parallel
    const [
      totalCount,
      inProgressCount,
      scheduledTodayCount,
      completedThisMonthCount,
    ] = await Promise.all([
      // Total jobs (excluding cancelled - they don't count as real work)
      prisma.job.count({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
        },
      }),

      // In progress jobs
      prisma.job.count({
        where: {
          organizationId,
          status: 'IN_PROGRESS',
        },
      }),

      // Jobs scheduled for today (excluding cancelled)
      prisma.job.count({
        where: {
          organizationId,
          scheduledDate: {
            gte: today,
            lt: tomorrow,
          },
          status: { not: 'CANCELLED' },
        },
      }),

      // Completed this month
      prisma.job.count({
        where: {
          organizationId,
          status: 'COMPLETED',
          completedAt: { gte: startOfMonth },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        inProgressCount,
        scheduledTodayCount,
        completedThisMonthCount,
      },
    });
  } catch (error) {
    console.error('Jobs stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching job stats' },
      { status: 500 }
    );
  }
}
