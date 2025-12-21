import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to fetch job with assignments, fall back without if table doesn't exist
    let job: any;
    try {
      job = await prisma.job.findFirst({
        where: {
          id,
          organizationId: session.organizationId,
        },
        include: {
          customer: true,
          technician: {
            select: { id: true, name: true, role: true },
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
    } catch (includeError) {
      // If assignments table doesn't exist, query without it
      if (isTableNotFoundError(includeError)) {
        job = await prisma.job.findFirst({
          where: {
            id,
            organizationId: session.organizationId,
          },
          include: {
            customer: true,
            technician: {
              select: { id: true, name: true, role: true },
            },
          },
        });
        // Add empty assignments array for consistency
        if (job) {
          job.assignments = [];
        }
      } else {
        throw includeError;
      }
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // For technicians, only show their own jobs
    if (userRole === 'TECHNICIAN' && job.technicianId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este trabajo' },
        { status: 403 }
      );
    }

    // Transform scheduledTimeSlot to separate fields for frontend compatibility
    const transformedJob = transformJobTimeSlot(job);

    // Filter data based on user role
    const filteredData = filterEntityByRole(transformedJob, 'job', userRole);
    const fieldMeta = getEntityFieldMetadata('job', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching job' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Verify the job belongs to the organization
    const existing = await prisma.job.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(body, 'job', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    // For technicians, only allow editing their own jobs and limited fields
    if (userRole === 'TECHNICIAN' && existing.technicianId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar este trabajo' },
        { status: 403 }
      );
    }

    // Try to update job with assignments, fall back without if table doesn't exist
    let job: any;
    try {
      job = await prisma.job.update({
        where: { id },
        data: {
          description: body.description,
          urgency: body.urgency || body.priority?.toUpperCase(),
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
          scheduledTimeSlot: body.scheduledTimeStart && body.scheduledTimeEnd
            ? { start: body.scheduledTimeStart, end: body.scheduledTimeEnd }
            : undefined,
        },
        include: {
          customer: true,
          technician: {
            select: { id: true, name: true, role: true },
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
    } catch (updateError) {
      // If assignments table doesn't exist, update without it
      if (isTableNotFoundError(updateError)) {
        job = await prisma.job.update({
          where: { id },
          data: {
            description: body.description,
            urgency: body.urgency || body.priority?.toUpperCase(),
            scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
            scheduledTimeSlot: body.scheduledTimeStart && body.scheduledTimeEnd
              ? { start: body.scheduledTimeStart, end: body.scheduledTimeEnd }
              : undefined,
          },
          include: {
            customer: true,
            technician: {
              select: { id: true, name: true, role: true },
            },
          },
        });
        // Add empty assignments array for consistency
        job.assignments = [];
      } else {
        throw updateError;
      }
    }

    return NextResponse.json({
      success: true,
      data: transformJobTimeSlot(job),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Update job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error updating job' },
      { status: 500 }
    );
  }
}
