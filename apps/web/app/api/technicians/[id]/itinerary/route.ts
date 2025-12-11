/**
 * Technician Itinerary API Route
 * GET /api/technicians/[id]/itinerary
 *
 * Returns the technician's scheduled jobs for a given date
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id: technicianId } = await params;
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    // Parse date or use today
    const date = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Verify technician exists and belongs to organization
    const technician = await prisma.user.findFirst({
      where: {
        id: technicianId,
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatar: true,
        specialty: true,
        skillLevel: true,
        currentLocation: true,
      },
    });

    if (!technician) {
      return NextResponse.json(
        { success: false, error: 'Técnico no encontrado' },
        { status: 404 }
      );
    }

    // Get jobs for the day
    const jobs = await prisma.job.findMany({
      where: {
        technicianId,
        organizationId: session.organizationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['CANCELLED'],
        },
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
        trackingSessions: {
          where: {
            status: { in: ['ACTIVE', 'ARRIVED'] },
          },
          take: 1,
          select: {
            id: true,
            status: true,
            etaMinutes: true,
            arrivedAt: true,
          },
        },
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Transform jobs into itinerary items
    const itinerary = jobs.map((job) => {
      const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
      const trackingSession = job.trackingSessions[0];

      return {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        serviceType: job.serviceType,
        description: job.description,
        urgency: job.urgency,
        scheduledDate: job.scheduledDate?.toISOString(),
        scheduledTime: {
          start: timeSlot?.start || null,
          end: timeSlot?.end || null,
        },
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        estimatedDuration: job.estimatedDuration,
        actualDuration: job.actualDuration,
        customer: {
          id: job.customer.id,
          name: job.customer.name,
          phone: job.customer.phone,
          address: job.customer.address,
        },
        tracking: trackingSession
          ? {
              sessionId: trackingSession.id,
              status: trackingSession.status,
              etaMinutes: trackingSession.etaMinutes,
              arrivedAt: trackingSession.arrivedAt?.toISOString() || null,
            }
          : null,
      };
    });

    // Calculate summary stats
    const stats = {
      total: jobs.length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      inProgress: jobs.filter((j) => j.status === 'IN_PROGRESS').length,
      enRoute: jobs.filter((j) => j.status === 'EN_ROUTE').length,
      pending: jobs.filter((j) => ['PENDING', 'ASSIGNED'].includes(j.status)).length,
      totalEstimatedMinutes: jobs.reduce((sum, j) => sum + (j.estimatedDuration || 0), 0),
      totalActualMinutes: jobs
        .filter((j) => j.actualDuration)
        .reduce((sum, j) => sum + (j.actualDuration || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        technician: {
          id: technician.id,
          name: technician.name,
          phone: technician.phone,
          avatar: technician.avatar,
          specialty: technician.specialty,
          skillLevel: technician.skillLevel,
          currentLocation: technician.currentLocation
            ? {
                lat: Number(technician.currentLocation.latitude),
                lng: Number(technician.currentLocation.longitude),
              }
            : null,
        },
        date: date.toISOString().split('T')[0],
        itinerary,
        stats,
      },
    });
  } catch (error) {
    console.error('Get itinerary error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo itinerario' },
      { status: 500 }
    );
  }
}
