/**
 * Tracking Start API Route
 * POST /api/tracking/start
 *
 * Starts a tracking session for a job when technician is en route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function generateSecureToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function parseAddress(address: unknown): { lat?: number; lng?: number } | null {
  if (!address) return null;
  if (typeof address === 'object' && address !== null) {
    const addr = address as Record<string, unknown>;
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      return { lat: addr.lat, lng: addr.lng };
    }
    if (addr.coordinates && typeof addr.coordinates === 'object') {
      const coords = addr.coordinates as Record<string, unknown>;
      if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        return { lat: coords.lat, lng: coords.lng };
      }
    }
  }
  return null;
}

function formatAddress(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object' && address !== null) {
    const addr = address as Record<string, unknown>;
    const parts: string[] = [];
    if (addr.street) parts.push(String(addr.street));
    if (addr.number) parts.push(String(addr.number));
    if (addr.city) parts.push(String(addr.city));
    if (addr.province) parts.push(String(addr.province));
    return parts.join(', ');
  }
  return '';
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

    const body = await request.json();
    const { jobId, initialLat, initialLng } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'ID de trabajo requerido' },
        { status: 400 }
      );
    }

    // Get job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: {
          select: { phone: true, name: true, address: true },
        },
        technician: {
          select: { id: true, name: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Trabajo no encontrado' },
        { status: 404 }
      );
    }

    // Verify the user is the assigned technician or has permission
    if (job.technicianId !== session.userId && !['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para iniciar el seguimiento de este trabajo' },
        { status: 403 }
      );
    }

    // Check if there's already an active session for this job
    const existingSession = await prisma.trackingSession.findFirst({
      where: {
        jobId,
        status: 'ACTIVE',
      },
    });

    if (existingSession) {
      // Return existing session
      const existingToken = await prisma.trackingToken.findFirst({
        where: {
          sessionId: existingSession.id,
          expiresAt: { gt: new Date() },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionId: existingSession.id,
          token: existingToken?.token,
          message: 'Sesión de seguimiento ya activa',
        },
      });
    }

    // Parse destination from customer address
    const destination = parseAddress(job.customer?.address);

    // Create tracking session
    const trackingSession = await prisma.trackingSession.create({
      data: {
        jobId,
        technicianId: job.technicianId || session.userId,
        organizationId: session.organizationId,
        status: 'ACTIVE',
        currentLat: initialLat || null,
        currentLng: initialLng || null,
        destinationLat: destination?.lat || null,
        destinationLng: destination?.lng || null,
        destinationAddress: formatAddress(job.customer?.address),
        movementMode: 'driving',
        startedAt: new Date(),
      },
    });

    // Generate tracking token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    await prisma.trackingToken.create({
      data: {
        token,
        jobId,
        sessionId: trackingSession.id,
        expiresAt,
      },
    });

    // Update job status to EN_ROUTE
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'EN_ROUTE' },
    });

    // Update technician's current location if provided
    if (initialLat && initialLng) {
      await prisma.technicianLocation.upsert({
        where: { userId: job.technicianId || session.userId },
        create: {
          userId: job.technicianId || session.userId,
          latitude: initialLat,
          longitude: initialLng,
          isOnline: true,
          lastSeen: new Date(),
        },
        update: {
          latitude: initialLat,
          longitude: initialLng,
          isOnline: true,
          lastSeen: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: trackingSession.id,
        token,
        trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/track/${token}`,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Start tracking error:', error);
    return NextResponse.json(
      { success: false, error: 'Error iniciando seguimiento' },
      { status: 500 }
    );
  }
}
