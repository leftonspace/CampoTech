/**
 * Jobs Calendar API Route
 * GET /api/jobs/calendar
 *
 * Returns jobs formatted for calendar view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Check if error is related to missing table
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

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

    // Get jobs - try with assignments and visits, fall back without if tables don't exist
    let jobs: any[];
    let jobVisits: any[] = [];

    // Track customers who have completed jobs (for "first visit" indicator)
    const customersWithCompletedJobs = new Set<string>();
    try {
      const completedJobs = await prisma.job.findMany({
        where: {
          organizationId: session.organizationId,
          status: 'COMPLETED',
        },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      completedJobs.forEach((job) => customersWithCompletedJobs.add(job.customerId));
    } catch {
      // If query fails, continue without first visit info
    }

    try {
      jobs = await prisma.job.findMany({
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
          visits: {
            orderBy: { visitNumber: 'asc' },
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

      // Also get visits from multi-visit jobs that fall within the date range
      // but whose parent job's scheduledDate might be outside the range
      const visitsWhere: any = {
        job: {
          organizationId: session.organizationId,
        },
        scheduledDate: {
          gte: start,
          lte: end,
        },
      };

      if (technicianId) {
        visitsWhere.technicianId = technicianId;
      }

      if (status) {
        visitsWhere.status = status;
      }

      jobVisits = await prisma.jobVisit.findMany({
        where: visitsWhere,
        include: {
          job: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  address: true,
                },
              },
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
        },
        orderBy: { scheduledDate: 'asc' },
      });
    } catch (includeError) {
      // If assignments/visits tables don't exist, query without them
      if (isTableNotFoundError(includeError)) {
        jobs = await prisma.job.findMany({
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
          },
          orderBy: { scheduledDate: 'asc' },
        });
        // Add empty arrays for consistency
        jobs = jobs.map((job: any) => ({ ...job, assignments: [], visits: [] }));
      } else {
        throw includeError;
      }
    }

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

    // Determine color based on status
    const statusColors: Record<string, string> = {
      PENDING: '#9CA3AF',
      ASSIGNED: '#A78BFA',
      EN_ROUTE: '#3B82F6',
      IN_PROGRESS: '#F59E0B',
      COMPLETED: '#10B981',
      CANCELLED: '#EF4444',
    };

    // Helper to create event from job or visit
    const createEvent = (
      id: string,
      title: string,
      scheduledDate: Date,
      timeSlot: { start?: string; end?: string } | null,
      status: string,
      estimatedDuration: number | null,
      extendedProps: any
    ) => {
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
        endDateTime = new Date(startDateTime.getTime() + (estimatedDuration || 60) * 60 * 1000);
      }

      return {
        id,
        title,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        allDay: false,
        backgroundColor: statusColors[status] || '#9CA3AF',
        borderColor: statusColors[status] || '#9CA3AF',
        extendedProps,
      };
    };

    // Helper to determine if this is a first visit for the customer
    const isFirstVisitForCustomer = (customerId: string) => {
      return !customersWithCompletedJobs.has(customerId);
    };

    // Track job IDs that have visits to avoid duplicates
    const jobsWithVisits = new Set<string>();

    // Transform job visits for calendar (from multi-visit jobs)
    const visitEvents = jobVisits.map((visit) => {
      jobsWithVisits.add(visit.jobId);
      const timeSlot = visit.scheduledTimeSlot as { start?: string; end?: string } | null;
      const job = visit.job;
      const totalVisits = job.visitCount || 1;
      const durationType = job.durationType || (totalVisits > 1 ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT');

      return createEvent(
        `visit-${visit.id}`,
        `${job.jobNumber} (${visit.visitNumber}/${totalVisits}) - ${job.customer.name}`,
        visit.scheduledDate,
        timeSlot,
        visit.status,
        job.estimatedDuration,
        {
          jobId: job.id,
          jobNumber: job.jobNumber,
          visitId: visit.id,
          visitNumber: visit.visitNumber,
          totalVisits,
          durationType,
          isFirstVisit: isFirstVisitForCustomer(job.customerId),
          status: visit.status,
          urgency: job.urgency,
          serviceType: job.serviceType,
          description: job.description,
          customer: {
            id: job.customer.id,
            name: job.customer.name,
            phone: job.customer.phone,
            address: job.customer.address,
          },
          technician: visit.technician
            ? {
                id: visit.technician.id,
                name: visit.technician.name,
                avatar: visit.technician.avatar,
                specialty: visit.technician.specialty,
              }
            : null,
          isVisit: true,
          scheduledTimeSlot: timeSlot,
        }
      );
    });

    // Transform single-visit jobs for calendar (skip jobs that have visits)
    const jobEvents = jobs
      .filter((job) => !jobsWithVisits.has(job.id) && (!job.visits || job.visits.length === 0))
      .map((job) => {
        const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
        const durationType = job.durationType || 'SINGLE_VISIT';

        return createEvent(
          job.id,
          `${job.jobNumber} - ${job.customer.name}`,
          job.scheduledDate!,
          timeSlot,
          job.status,
          job.estimatedDuration,
          {
            jobId: job.id,
            jobNumber: job.jobNumber,
            visitNumber: 1,
            totalVisits: 1,
            durationType,
            isFirstVisit: isFirstVisitForCustomer(job.customerId),
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
            assignments: job.assignments.map((a: any) => ({
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
            isVisit: false,
          }
        );
      });

    // Combine all events
    const events = [...jobEvents, ...visitEvents];

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
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Calendar jobs error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo trabajos' },
      { status: 500 }
    );
  }
}
