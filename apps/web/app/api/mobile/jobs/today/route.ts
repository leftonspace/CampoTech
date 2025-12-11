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
        ...(session.role === 'technician' ? { technicianId: session.userId } : {}),
        // Exclude cancelled jobs
        status: { not: 'CANCELLED' },
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
        technician: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        materials: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { urgency: 'desc' },
      ],
    });

    // Format jobs for mobile
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      urgency: job.urgency,
      serviceType: job.serviceType,
      scheduledDate: job.scheduledDate,
      scheduledTimeSlot: job.scheduledTimeSlot,
      description: job.description,
      customer: job.customer,
      technician: job.technician,
      materials: job.materials,
      completedAt: job.completedAt,
    }));

    // Get summary stats
    const summary = {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'PENDING').length,
      scheduled: jobs.filter((j) => j.status === 'SCHEDULED').length,
      inProgress: jobs.filter((j) => j.status === 'IN_PROGRESS').length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
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
