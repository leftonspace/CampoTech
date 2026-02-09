/**
 * Tracking Status Update API
 * POST /api/tracking/status
 *
 * Updates technician status (clock in/out, travel, working)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type TechnicianStatus = 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';

interface StatusUpdateBody {
  status: TechnicianStatus;
  jobId?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only technicians can update their own status
    if (session.role.toUpperCase() !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, error: 'Solo los técnicos pueden actualizar su estado' },
        { status: 403 }
      );
    }

    const body: StatusUpdateBody = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'Estado requerido' },
        { status: 400 }
      );
    }

    const validStatuses: TechnicianStatus[] = ['en_linea', 'en_camino', 'trabajando', 'sin_conexion'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Estado inválido' },
        { status: 400 }
      );
    }

    // Update or create location record with online status
    const isOnline = body.status !== 'sin_conexion';

    // Upsert technician location
    await prisma.technicianLocation.upsert({
      where: { userId: session.userId },
      update: {
        isOnline,
        lastSeen: new Date(),
      },
      create: {
        userId: session.userId,
        latitude: -34.6037, // Default to Buenos Aires
        longitude: -58.3816,
        isOnline,
        lastSeen: new Date(),
      },
    });

    // If starting travel to a job, update tracking session
    if (body.status === 'en_camino' && body.jobId) {
      // Phase 10 Security: Check terminal state before updating job
      const jobCheck = await prisma.job.findUnique({
        where: { id: body.jobId },
        select: { status: true },
      });

      const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
      if (jobCheck && TERMINAL_STATES.includes(jobCheck.status)) {
        console.warn('[SECURITY] Tracking status terminal state violation:', {
          jobId: body.jobId,
          currentStatus: jobCheck.status,
          attemptedAction: 'en_camino',
          userId: session.userId,
          timestamp: new Date().toISOString(),
        });
        return NextResponse.json(
          {
            success: false,
            error: `No se puede modificar un trabajo ${jobCheck.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
            terminalStateBlocked: true,
          },
          { status: 403 }
        );
      }

      // Create or update tracking session
      const existingSession = await prisma.trackingSession.findFirst({
        where: {
          jobId: body.jobId,
          technicianId: session.userId,
          status: { in: ['ACTIVE', 'ARRIVED'] },
        },
      });

      if (!existingSession) {
        // Get job details for destination
        const job = await prisma.job.findUnique({
          where: { id: body.jobId },
          include: {
            customer: { select: { address: true } },
          },
        });

        if (job) {
          const customerAddress = job.customer.address as {
            coordinates?: { lat?: number; lng?: number };
          } | null;

          await prisma.trackingSession.create({
            data: {
              jobId: body.jobId,
              technicianId: session.userId,
              organizationId: session.organizationId,
              status: 'ACTIVE',
              destinationLat: customerAddress?.coordinates?.lat,
              destinationLng: customerAddress?.coordinates?.lng,
              startedAt: new Date(),
            },
          });

          // Update job status to EN_ROUTE
          await prisma.job.update({
            where: { id: body.jobId },
            data: { status: 'EN_ROUTE' },
          });
        }
      }
    }

    // If arriving at job
    if (body.status === 'trabajando' && body.jobId) {
      // Phase 10 Security: Check terminal state before updating job
      const jobCheck = await prisma.job.findUnique({
        where: { id: body.jobId },
        select: { status: true },
      });

      const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
      if (jobCheck && TERMINAL_STATES.includes(jobCheck.status)) {
        console.warn('[SECURITY] Tracking status terminal state violation:', {
          jobId: body.jobId,
          currentStatus: jobCheck.status,
          attemptedAction: 'trabajando',
          userId: session.userId,
          timestamp: new Date().toISOString(),
        });
        return NextResponse.json(
          {
            success: false,
            error: `No se puede modificar un trabajo ${jobCheck.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
            terminalStateBlocked: true,
          },
          { status: 403 }
        );
      }

      // Update tracking session
      await prisma.trackingSession.updateMany({
        where: {
          jobId: body.jobId,
          technicianId: session.userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'ARRIVED',
          arrivedAt: new Date(),
        },
      });

      // Update job status to IN_PROGRESS
      await prisma.job.update({
        where: { id: body.jobId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });
    }

    // If finishing a job
    if (body.status === 'en_linea' && body.jobId) {
      // Complete tracking session
      await prisma.trackingSession.updateMany({
        where: {
          jobId: body.jobId,
          technicianId: session.userId,
          status: { in: ['ACTIVE', 'ARRIVED'] },
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    // FIXME: Add activity logging when ActivityLog model is created (Phase: Audit Trail)
    // For now, log to console for debugging
    console.log('Status change:', {
      userId: session.userId,
      newStatus: body.status,
      jobId: body.jobId,
    });

    return NextResponse.json({
      success: true,
      message: 'Estado actualizado correctamente',
      status: body.status,
    });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar estado' },
      { status: 500 }
    );
  }
}
