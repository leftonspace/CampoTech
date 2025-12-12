import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

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

    // Remove from job assignments
    await prisma.jobAssignment.delete({
      where: {
        jobId_technicianId: {
          jobId: id,
          technicianId: userId,
        },
      },
    }).catch(() => {
      // Ignore if assignment doesn't exist
    });

    // If the legacy technicianId matches, clear it
    const updateData: Record<string, unknown> = {};
    if (existing.technicianId === userId) {
      updateData.technicianId = null;
    }

    // Get updated job
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
    console.error('Unassign job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error unassigning job' },
      { status: 500 }
    );
  }
}
