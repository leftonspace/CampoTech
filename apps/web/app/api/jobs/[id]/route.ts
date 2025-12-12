import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

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

    const job = await prisma.job.findFirst({
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

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // For technicians, only show their own jobs
    if (userRole === 'TECHNICIAN' && job.technicianId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este trabajo' },
        { status: 403 }
      );
    }

    // Filter data based on user role
    const filteredData = filterEntityByRole(job, 'job', userRole);
    const fieldMeta = getEntityFieldMetadata('job', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    console.error('Get job error:', error);
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
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

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

    const job = await prisma.job.update({
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

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating job' },
      { status: 500 }
    );
  }
}
