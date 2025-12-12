/**
 * Jobs Calendar API Route
 * GET /api/jobs/calendar
 *
 * Returns jobs formatted for calendar view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const technicianId = searchParams.get('technicianId');
    const status = searchParams.get('status');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Se requieren fechas de inicio y fin' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Build where clause
    const where: any = {
      organizationId: session.organizationId,
      scheduledDate: {
        gte: start,
        lte: end,
      },
    };

    if (technicianId) {
      where.technicianId = technicianId;
    }

    if (status) {
      where.status = status;
    }

    // Get jobs
    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        technician: {
          select: {
            id: true,
            name: true,
            avatar: true,
            specialty: true,
          },
        },
        assignments: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                avatar: true,
                specialty: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    // Get technicians for filter
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        specialty: true,
      },
      orderBy: { name: 'asc' },
    });

    // Transform jobs for calendar
    const events = jobs.map((job) => {
      const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
      const scheduledDate = job.scheduledDate!;

      // Parse start time
      let startDateTime = new Date(scheduledDate);
      if (timeSlot?.start) {
        const [hours, minutes] = timeSlot.start.split(':').map(Number);
        startDateTime.setHours(hours, minutes, 0, 0);
      } else {
        startDateTime.setHours(9, 0, 0, 0); // Default 9 AM
      }

      // Parse end time or estimate
      let endDateTime = new Date(scheduledDate);
      if (timeSlot?.end) {
        const [hours, minutes] = timeSlot.end.split(':').map(Number);
        endDateTime.setHours(hours, minutes, 0, 0);
      } else {
        // Default 1 hour or use estimated duration
        endDateTime = new Date(startDateTime.getTime() + (job.estimatedDuration || 60) * 60 * 1000);
      }

      // Determine color based on status
      const statusColors: Record<string, string> = {
        PENDING: '#9CA3AF',
        ASSIGNED: '#A78BFA',
        EN_ROUTE: '#3B82F6',
        IN_PROGRESS: '#F59E0B',
        COMPLETED: '#10B981',
        CANCELLED: '#EF4444',
      };

      return {
        id: job.id,
        title: `${job.jobNumber} - ${job.customer.name}`,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        allDay: false,
        backgroundColor: statusColors[job.status] || '#9CA3AF',
        borderColor: statusColors[job.status] || '#9CA3AF',
        extendedProps: {
          jobNumber: job.jobNumber,
          status: job.status,
          urgency: job.urgency,
          serviceType: job.serviceType,
          description: job.description,
          customer: {
            id: job.customer.id,
            name: job.customer.name,
            phone: job.customer.phone,
            address: job.customer.address,
          },
          technician: job.technician
            ? {
                id: job.technician.id,
                name: job.technician.name,
                avatar: job.technician.avatar,
                specialty: job.technician.specialty,
              }
            : null,
          assignments: job.assignments.map((a) => ({
            id: a.id,
            technician: a.technician
              ? {
                  id: a.technician.id,
                  name: a.technician.name,
                  avatar: a.technician.avatar,
                  specialty: a.technician.specialty,
                }
              : null,
          })),
          estimatedDuration: job.estimatedDuration,
          scheduledTimeSlot: timeSlot,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        events,
        technicians,
        range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Calendar jobs error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo trabajos' },
      { status: 500 }
    );
  }
}
