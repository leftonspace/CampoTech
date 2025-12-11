/**
 * Tracking Update API Route
 * POST /api/tracking/update
 *
 * Updates technician location during active tracking session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function detectMovementMode(speed: number): 'walking' | 'driving' | 'stationary' {
  if (speed < 1) return 'stationary';
  if (speed <= 7) return 'walking';
  return 'driving';
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
    const { lat, lng, jobId, sessionId, speed, heading, accuracy, altitude } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas requeridas' },
        { status: 400 }
      );
    }

    // Find the active tracking session
    let trackingSession;
    if (sessionId) {
      trackingSession = await prisma.trackingSession.findUnique({
        where: { id: sessionId },
      });
    } else if (jobId) {
      trackingSession = await prisma.trackingSession.findFirst({
        where: {
          jobId,
          status: 'ACTIVE',
        },
      });
    } else {
      // Find any active session for this technician
      trackingSession = await prisma.trackingSession.findFirst({
        where: {
          technicianId: session.userId,
          status: 'ACTIVE',
        },
        orderBy: { startedAt: 'desc' },
      });
    }

    // Detect movement mode based on speed
    const movementMode = detectMovementMode(speed || 0);

    // Update technician's current location
    await prisma.technicianLocation.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        altitude: altitude || null,
        isOnline: true,
        lastSeen: new Date(),
      },
      update: {
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        altitude: altitude || null,
        isOnline: true,
        lastSeen: new Date(),
      },
    });

    // Record location history (throttled - only if moved significantly or time passed)
    const shouldRecordHistory = await checkShouldRecordHistory(session.userId, lat, lng);
    if (shouldRecordHistory) {
      await prisma.technicianLocationHistory.create({
        data: {
          userId: session.userId,
          jobId: trackingSession?.jobId || null,
          sessionId: trackingSession?.id || null,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy || null,
          heading: heading || null,
          speed: speed || null,
          movementMode,
        },
      });
    }

    // Update tracking session if exists
    let etaMinutes: number | null = null;
    let arrived = false;

    if (trackingSession) {
      // Calculate ETA if destination is set
      if (trackingSession.destinationLat && trackingSession.destinationLng) {
        const distance = haversineDistance(
          lat,
          lng,
          Number(trackingSession.destinationLat),
          Number(trackingSession.destinationLng)
        );

        // Check if arrived (within 100 meters)
        if (distance <= 0.1) {
          arrived = true;
          await prisma.trackingSession.update({
            where: { id: trackingSession.id },
            data: {
              status: 'ARRIVED',
              arrivedAt: new Date(),
              currentLat: lat,
              currentLng: lng,
              currentSpeed: speed || null,
              currentHeading: heading || null,
              movementMode,
              lastPositionAt: new Date(),
              positionUpdateCount: { increment: 1 },
            },
          });
        } else {
          // Estimate ETA based on movement mode
          const speedKmh =
            movementMode === 'walking' ? 5 : movementMode === 'stationary' ? 0 : 30;

          if (speedKmh > 0) {
            etaMinutes = Math.ceil((distance / speedKmh) * 60);
          }

          await prisma.trackingSession.update({
            where: { id: trackingSession.id },
            data: {
              currentLat: lat,
              currentLng: lng,
              currentSpeed: speed || null,
              currentHeading: heading || null,
              etaMinutes,
              etaUpdatedAt: new Date(),
              movementMode,
              lastPositionAt: new Date(),
              positionUpdateCount: { increment: 1 },
            },
          });
        }
      } else {
        await prisma.trackingSession.update({
          where: { id: trackingSession.id },
          data: {
            currentLat: lat,
            currentLng: lng,
            currentSpeed: speed || null,
            currentHeading: heading || null,
            movementMode,
            lastPositionAt: new Date(),
            positionUpdateCount: { increment: 1 },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recorded: true,
        sessionId: trackingSession?.id,
        etaMinutes,
        arrived,
        movementMode,
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

async function checkShouldRecordHistory(
  userId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  // Get last recorded position
  const lastRecord = await prisma.technicianLocationHistory.findFirst({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
  });

  if (!lastRecord) return true;

  // Record if more than 5 minutes passed
  const timeDiff = Date.now() - lastRecord.recordedAt.getTime();
  if (timeDiff > 5 * 60 * 1000) return true;

  // Record if moved more than 50 meters
  const distance = haversineDistance(
    lat,
    lng,
    Number(lastRecord.latitude),
    Number(lastRecord.longitude)
  );
  if (distance > 0.05) return true;

  return false;
}
