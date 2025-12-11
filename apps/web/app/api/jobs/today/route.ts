import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Jobs Today API
 * Returns today's jobs for the dashboard
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

    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch jobs for today
    const jobs = await prisma.job.findMany({
      where: {
        organizationId: session.organizationId,
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { not: 'cancelled' },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { scheduledTimeStart: 'asc' },
        { priority: 'desc' },
      ],
    });

    // Get summary stats
    const summary = {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      scheduled: jobs.filter((j) => j.status === 'scheduled').length,
      enCamino: jobs.filter((j) => j.status === 'en_camino').length,
      working: jobs.filter((j) => j.status === 'working').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        jobs,
        summary,
        date: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Jobs today error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}
