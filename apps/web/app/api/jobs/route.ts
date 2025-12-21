import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';

// Check if error is related to missing table
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

// Transform scheduledTimeSlot JSON to separate start/end fields for frontend compatibility
function transformJobTimeSlot(job: any): any {
  if (!job) return job;
  const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
  return {
    ...job,
    scheduledTimeStart: timeSlot?.start || null,
    scheduledTimeEnd: timeSlot?.end || null,
  };
}

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
    const status = searchParams.get('status');
    const durationType = searchParams.get('durationType'); // Filter for recurring/multi-visit
    const technicianId = searchParams.get('technicianId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // Filter by duration type (SINGLE_VISIT, MULTIPLE_VISITS, RECURRING)
    if (durationType && durationType !== 'all') {
      where.durationType = durationType.toUpperCase();
    }

    // Filter by technician
    if (technicianId && technicianId !== 'all') {
      where.technicianId = technicianId;
    }

    // If technician role, only show their jobs
    if (session.role === 'TECHNICIAN') {
      where.technicianId = session.userId;
    }

    // Try to include assignments and visits, fall back to basic query if table doesn't exist
    let jobs;
    let total;
    try {
      [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          include: {
            customer: true,
            technician: {
              select: { id: true, name: true },
            },
            assignments: {
              include: {
                technician: {
                  select: { id: true, name: true },
                },
              },
            },
            visits: {
              orderBy: { visitNumber: 'asc' },
              include: {
                technician: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { scheduledDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.job.count({ where }),
      ]);
    } catch (includeError) {
      // If assignments/visits tables don't exist, query without them
      if (isTableNotFoundError(includeError)) {
        [jobs, total] = await Promise.all([
          prisma.job.findMany({
            where,
            include: {
              customer: true,
              technician: {
                select: { id: true, name: true },
              },
            },
            orderBy: { scheduledDate: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.job.count({ where }),
        ]);
      } else {
        throw includeError;
      }
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Transform scheduledTimeSlot to separate fields for frontend compatibility
    const transformedJobs = jobs.map(transformJobTimeSlot);

    // Filter data based on user role
    const filteredJobs = filterEntitiesByRole(transformedJobs, 'job', userRole);
    const fieldMeta = getEntityFieldMetadata('job', userRole);

    return NextResponse.json({
      success: true,
      data: filteredJobs,
      _fieldMeta: fieldMeta,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Jobs list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Generate job number
    const lastJob = await prisma.job.findFirst({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const jobCount = lastJob
      ? parseInt(lastJob.jobNumber.replace('JOB-', '')) + 1
      : 1;
    const jobNumber = `JOB-${String(jobCount).padStart(5, '0')}`;

    // Support both single technicianId (legacy) and array technicianIds
    const technicianIds: string[] = body.technicianIds?.length
      ? body.technicianIds
      : body.technicianId
        ? [body.technicianId]
        : [];

    // Parse visits array for multi-visit jobs
    const visits: Array<{
      date: string;
      timeStart?: string;
      timeEnd?: string;
      technicianIds?: string[];
      isRecurring?: boolean;
      recurrencePattern?: string;
      recurrenceCount?: number;
    }> = body.visits || [];

    // Determine duration type and visit count
    const durationType = body.durationType || 'SINGLE_VISIT';
    const visitCount = visits.length > 1 ? visits.length : null;
    const hasRecurrence = visits.some(v => v.isRecurring);

    // Try to create job with assignments and visits
    let job;
    try {
      job = await prisma.job.create({
        data: {
          jobNumber,
          serviceType: body.serviceType,
          description: body.description,
          urgency: body.urgency || 'NORMAL',
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
          scheduledTimeSlot: body.scheduledTimeSlot,
          customerId: body.customerId,
          // Keep legacy technicianId for backwards compatibility (first technician)
          technicianId: technicianIds[0] || null,
          createdById: session.userId,
          organizationId: session.organizationId,
          // Multi-visit fields
          durationType: durationType as any,
          visitCount,
          recurrencePattern: hasRecurrence ? (visits[0]?.recurrencePattern as any) : null,
          recurrenceCount: hasRecurrence ? visits[0]?.recurrenceCount : null,
          // Create job assignments for all technicians
          assignments: {
            create: technicianIds.map((techId: string) => ({
              technicianId: techId,
            })),
          },
          // Create JobVisit records for multi-visit jobs
          visits: visits.length > 0 ? {
            create: visits.map((visit, index) => ({
              visitNumber: index + 1,
              scheduledDate: new Date(visit.date),
              scheduledTimeSlot: visit.timeStart || visit.timeEnd
                ? { start: visit.timeStart || '', end: visit.timeEnd || '' }
                : null,
              technicianId: visit.technicianIds?.[0] || technicianIds[0] || null,
            })),
          } : undefined,
        },
        include: {
          customer: true,
          technician: {
            select: { id: true, name: true },
          },
          assignments: {
            include: {
              technician: {
                select: { id: true, name: true },
              },
            },
          },
          visits: {
            orderBy: { visitNumber: 'asc' },
            include: {
              technician: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    } catch (createError) {
      // If assignments/visits tables don't exist, create without them
      if (isTableNotFoundError(createError)) {
        job = await prisma.job.create({
          data: {
            jobNumber,
            serviceType: body.serviceType,
            description: body.description,
            urgency: body.urgency || 'NORMAL',
            scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
            scheduledTimeSlot: body.scheduledTimeSlot,
            customerId: body.customerId,
            technicianId: technicianIds[0] || null,
            createdById: session.userId,
            organizationId: session.organizationId,
            durationType: durationType as any,
            visitCount,
          },
          include: {
            customer: true,
            technician: {
              select: { id: true, name: true },
            },
          },
        });
      } else {
        throw createError;
      }
    }

    return NextResponse.json({
      success: true,
      data: transformJobTimeSlot(job),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Create job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error creating job' },
      { status: 500 }
    );
  }
}
