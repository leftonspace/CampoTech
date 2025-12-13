import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { onTechnicianAssigned } from '@/src/modules/whatsapp/notification-triggers.service';

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

    // Verify the user belongs to the organization
    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: session.organizationId,
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Add to job assignments (if not already assigned)
    if (userId) {
      await prisma.jobAssignment.upsert({
        where: {
          jobId_technicianId: {
            jobId: id,
            technicianId: userId,
          },
        },
        create: {
          jobId: id,
          technicianId: userId,
        },
        update: {}, // No update needed if already exists
      });
    }

    // Also update the legacy technicianId field (for backwards compatibility)
    const job = await prisma.job.update({
      where: { id },
      data: {
        technicianId: userId || null,
        status: userId && existing.status === 'PENDING' ? 'ASSIGNED' : undefined,
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

    // Trigger WhatsApp notification for technician assignment (non-blocking)
    if (userId) {
      onTechnicianAssigned(id, userId).catch((err) => {
        console.error('WhatsApp notification error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Assign job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error assigning job' },
      { status: 500 }
    );
  }
}
