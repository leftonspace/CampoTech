import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Jobs Today API
 * =====================
 *
 * Returns today's jobs for the authenticated technician.
 * Optimized for mobile app usage.
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
        // For technicians, only show assigned jobs
        ...(session.role === 'technician' ? { assignedToId: session.userId } : {}),
        // Exclude cancelled jobs
        status: { not: 'cancelled' },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        lineItems: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: [
        { scheduledTimeStart: 'asc' },
        { priority: 'desc' },
      ],
    });

    // Format jobs for mobile
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      status: job.status,
      priority: job.priority,
      scheduledDate: job.scheduledDate,
      scheduledTimeStart: job.scheduledTimeStart,
      scheduledTimeEnd: job.scheduledTimeEnd,
      address: job.address,
      notes: job.notes,
      description: job.description,
      customer: job.customer,
      assignedTo: job.assignedTo,
      lineItems: job.lineItems,
      totalAmount: job.totalAmount,
      completedAt: job.completedAt,
    }));

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
        jobs: formattedJobs,
        summary,
        date: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Mobile jobs today error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}
