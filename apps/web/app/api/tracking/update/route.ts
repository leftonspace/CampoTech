import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  updatePosition,
  calculateETA,
} from '@/../../src/modules/tracking/tracking.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/tracking/update
 * Endpoint for technician app to update position
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
    const { lat, lng, speed, heading, accuracy, jobId } = body;

    if (!lat || !lng || !jobId) {
      return NextResponse.json(
        { success: false, error: 'Datos de posición incompletos' },
        { status: 400 }
      );
    }

    // Find active tracking session for this job
    const trackingSession = await prisma.trackingSession.findFirst({
      where: {
        jobId,
        technicianId: session.userId,
        status: 'active',
      },
    });

    if (!trackingSession) {
      return NextResponse.json(
        { success: false, error: 'Sesión de seguimiento no encontrada' },
        { status: 404 }
      );
    }

    // Update position
    await updatePosition(trackingSession.id, {
      lat,
      lng,
      speed,
      heading,
      accuracy,
    });

    // Calculate new ETA
    const etaMinutes = await calculateETA(trackingSession.id);

    return NextResponse.json({
      success: true,
      data: {
        etaMinutes,
        status: trackingSession.status,
      },
    });
  } catch (error) {
    console.error('Position update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando posición' },
      { status: 500 }
    );
  }
}
