/**
 * Jobs Calendar API Route
 * GET /api/jobs/calendar
 *
 * Returns jobs formatted for calendar view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JobService } from '@/src/services/job.service';

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
    const where: Record<string, unknown> = {
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

    // Get jobs - using explicit any here due to complex return types from Prisma findMany with includes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jobs: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      completedJobs.forEach((job: { customerId: string }) => customersWithCompletedJobs.add(job.customerId));
    } catch {
      // If query fails, continue without first visit info
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extendedProps: any
    ) => {
      // Parse start time
      const startDateTime = new Date(scheduledDate);
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

    // Group visits by job and visitConfigIndex to calculate totals
    const visitsByJobAndConfig = new Map<string, Map<number, typeof jobVisits>>();
    for (const visit of jobVisits) {
      jobsWithVisits.add(visit.jobId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configIndex = (visit as any).visitConfigIndex || 1;

      if (!visitsByJobAndConfig.has(visit.jobId)) {
        visitsByJobAndConfig.set(visit.jobId, new Map());
      }
      const jobConfigs = visitsByJobAndConfig.get(visit.jobId)!;
      if (!jobConfigs.has(configIndex)) {
        jobConfigs.set(configIndex, []);
      }
      jobConfigs.get(configIndex)!.push(visit);
    }

    // Build config summaries for navigation between configs
    const getConfigSummaries = (jobId: string) => {
      const jobConfigs = visitsByJobAndConfig.get(jobId);
      if (!jobConfigs || jobConfigs.size <= 1) return [];

      const summaries: Array<{
        configIndex: number;
        totalDates: number;
        firstDate: string;
        lastDate: string;
        timeSlot: { start?: string; end?: string } | null;
        technician: { id: string; name: string; avatar?: string | null } | null;
      }> = [];

      for (const [configIndex, visits] of jobConfigs) {
        const sorted = [...visits].sort((a, b) =>
          new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
        );
        const firstVisit = sorted[0];
        const lastVisit = sorted[sorted.length - 1];

        summaries.push({
          configIndex,
          totalDates: visits.length,
          firstDate: firstVisit.scheduledDate.toISOString(),
          lastDate: lastVisit.scheduledDate.toISOString(),
          timeSlot: firstVisit.scheduledTimeSlot as { start?: string; end?: string } | null,
          technician: firstVisit.technician
            ? { id: firstVisit.technician.id, name: firstVisit.technician.name, avatar: firstVisit.technician.avatar }
            : null,
        });
      }

      return summaries.sort((a, b) => a.configIndex - b.configIndex);
    };

    // Transform job visits for calendar (from multi-visit jobs)
    const visitEvents = jobVisits.map((visit) => {
      const timeSlot = visit.scheduledTimeSlot as { start?: string; end?: string } | null;
      const job = visit.job;
      const totalVisits = job.visitCount || 1;
      const durationType = job.durationType || (totalVisits > 1 ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT');

      // Get config info for this visit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const visitConfigIndex = (visit as any).visitConfigIndex || 1;
      const jobConfigs = visitsByJobAndConfig.get(visit.jobId);
      const totalConfigs = jobConfigs?.size || 1;
      const configVisits = jobConfigs?.get(visitConfigIndex) || [];
      const configTotalDates = configVisits.length;

      // Get visit number within this config (not overall)
      const sortedConfigVisits = [...configVisits].sort((a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );
      const visitNumberInConfig = sortedConfigVisits.findIndex(v => v.id === visit.id) + 1;

      // Get all config summaries for navigation
      const allConfigs = getConfigSummaries(visit.jobId);

      return createEvent(
        `visit-${visit.id}`,
        `${job.jobNumber} - ${job.customer.name}`,
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
          visitConfigIndex,
          totalConfigs,
          configTotalDates,
          visitNumberInConfig,
          allConfigs, // For navigation between configs
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
