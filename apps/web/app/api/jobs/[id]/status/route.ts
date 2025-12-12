import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Map frontend status to database status
const STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  scheduled: 'ASSIGNED',
  en_camino: 'EN_ROUTE',
  working: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { status } = body;

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

    const dbStatus = STATUS_MAP[status] || status.toUpperCase();

    const updateData: Record<string, unknown> = {
      status: dbStatus,
    };

    // Set completion timestamp if completed
    if (dbStatus === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    // Set start timestamp if in progress
    if (dbStatus === 'IN_PROGRESS' && !existing.startedAt) {
      updateData.startedAt = new Date();
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
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
    console.error('Update job status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating job status' },
      { status: 500 }
    );
  }
}
