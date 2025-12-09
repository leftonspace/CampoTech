import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTrackingSession } from '@/../../src/modules/tracking/tracking.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/tracking/start
 * Manually start a tracking session for a job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'ID de trabajo requerido' },
        { status: 400 }
      );
    }

    // Verify job exists and belongs to organization
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: session.organizationId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Trabajo no encontrado' },
        { status: 404 }
      );
    }

    // Check if user is the assigned technician or an admin
    const isAssignedTechnician = job.technicianId === session.userId;
    const isAdmin = session.role === 'admin' || session.role === 'owner';

    if (!isAssignedTechnician && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para iniciar seguimiento en este trabajo' },
        { status: 403 }
      );
    }

    // Check if job is in a valid status for tracking
    const validStatuses = ['scheduled', 'en_camino'];
    if (!validStatuses.includes(job.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `El trabajo debe estar programado o en camino para iniciar seguimiento. Estado actual: ${job.status}`,
        },
        { status: 400 }
      );
    }

    // Check for existing active session
    const existingSession = await prisma.trackingSession.findFirst({
      where: {
        jobId,
        status: 'active',
      },
    });

    if (existingSession) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existingSession.id,
          message: 'Sesión de seguimiento ya activa',
          alreadyActive: true,
        },
      });
    }

    // Create tracking session
    const technicianId = job.technicianId || session.userId;
    const result = await createTrackingSession(jobId, technicianId, session.organizationId);

    // Update job status to en_camino if it was scheduled
    if (job.status === 'scheduled') {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'EN_ROUTE',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: result.sessionId,
        token: result.token,
        trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/track/${result.token}`,
        message: 'Seguimiento iniciado correctamente',
      },
    });
  } catch (error) {
    console.error('Start tracking error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error iniciando seguimiento',
      },
      { status: 500 }
    );
  }
}
