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
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // If technician, only show their jobs
    if (session.role === 'TECHNICIAN') {
      where.technicianId = session.userId;
    }

    // Try to include assignments, fall back to basic query if table doesn't exist
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
          },
          orderBy: { scheduledDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.job.count({ where }),
      ]);
    } catch (includeError) {
      // If assignments table doesn't exist, query without it
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

    // Filter data based on user role
    const filteredJobs = filterEntitiesByRole(jobs, 'job', userRole);
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

    // Try to create job with assignments, fall back to basic create if table doesn't exist
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
          // Create job assignments for all technicians
          assignments: {
            create: technicianIds.map((techId: string) => ({
              technicianId: techId,
            })),
          },
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
        },
      });
    } catch (createError) {
      // If assignments table doesn't exist, create without assignments
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
      data: job,
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
