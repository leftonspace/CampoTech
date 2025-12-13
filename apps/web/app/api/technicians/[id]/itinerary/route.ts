/**
 * Technician Itinerary API Route
 * GET /api/technicians/[id]/itinerary
 *
 * Returns the technician's scheduled jobs for a given date with route information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Parse address to extract coordinates and formatted string
function parseAddress(address: unknown): { formatted: string; lat: number | null; lng: number | null } {
  if (!address || typeof address !== 'object') {
    return { formatted: '', lat: null, lng: null };
  }

  const addr = address as {
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    coordinates?: { lat?: number; lng?: number };
  };

  const parts = [];
  if (addr.street) {
    let streetLine = addr.street;
    if (addr.number) streetLine += ` ${addr.number}`;
    if (addr.floor) streetLine += `, Piso ${addr.floor}`;
    if (addr.apartment) streetLine += `, Depto ${addr.apartment}`;
    parts.push(streetLine);
  }
  if (addr.city) parts.push(addr.city);

  return {
    formatted: parts.join(', ') || '',
    lat: addr.coordinates?.lat ?? null,
    lng: addr.coordinates?.lng ?? null,
  };
}

// Calculate travel time using Haversine distance and average city speed
function estimateTravelTime(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number | null {
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Assume average speed of 25 km/h in city traffic
  const travelTimeMinutes = Math.round((distance / 25) * 60);
  return travelTimeMinutes;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id: technicianId } = await params;
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    // Parse date or use today
    const date = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Verify technician exists and belongs to organization
    const technician = await prisma.user.findFirst({
      where: {
        id: technicianId,
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatar: true,
        specialty: true,
        skillLevel: true,
        currentLocation: true,
      },
    });

    if (!technician) {
      return NextResponse.json(
        { success: false, error: 'Técnico no encontrado' },
        { status: 404 }
      );
    }

    // Get jobs for the day
    const jobs = await prisma.job.findMany({
      where: {
        technicianId,
        organizationId: session.organizationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['CANCELLED'],
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        trackingSessions: {
          where: {
            status: { in: ['ACTIVE', 'ARRIVED'] },
          },
          take: 1,
          select: {
            id: true,
            status: true,
            etaMinutes: true,
            arrivedAt: true,
          },
        },
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Get technician's current position for travel time calculation
    let prevLat: number | null = technician.currentLocation
      ? Number(technician.currentLocation.latitude)
      : null;
    let prevLng: number | null = technician.currentLocation
      ? Number(technician.currentLocation.longitude)
      : null;

    // Transform jobs into itinerary items with coordinates and travel times
    const itinerary = jobs.map((job: typeof jobs[number], index: number) => {
      const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
      const trackingSession = job.trackingSessions[0];
      const { formatted, lat, lng } = parseAddress(job.customer.address);

      // Calculate travel time from previous location
      const travelTimeFromPrevious = estimateTravelTime(prevLat, prevLng, lat, lng);

      // Update previous location for next iteration
      if (lat !== null && lng !== null) {
        prevLat = lat;
        prevLng = lng;
      }

      return {
        id: job.id,
        jobNumber: job.jobNumber,
        order: index + 1,
        status: job.status,
        serviceType: job.serviceType,
        description: job.description,
        urgency: job.urgency,
        scheduledDate: job.scheduledDate?.toISOString(),
        scheduledTime: {
          start: timeSlot?.start || null,
          end: timeSlot?.end || null,
        },
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        estimatedDuration: job.estimatedDuration,
        actualDuration: job.actualDuration,
        travelTimeFromPrevious,
        location: {
          lat,
          lng,
          address: formatted,
        },
        customer: {
          id: job.customer.id,
          name: job.customer.name,
          phone: job.customer.phone,
        },
        tracking: trackingSession
          ? {
              sessionId: trackingSession.id,
              status: trackingSession.status,
              etaMinutes: trackingSession.etaMinutes,
              arrivedAt: trackingSession.arrivedAt?.toISOString() || null,
            }
          : null,
      };
    });

    // Calculate summary stats
    const totalTravelMinutes = itinerary.reduce(
      (sum: number, item: typeof itinerary[number]) => sum + (item.travelTimeFromPrevious || 0),
      0
    );

    const stats = {
      total: jobs.length,
      completed: jobs.filter((j: typeof jobs[number]) => j.status === 'COMPLETED').length,
      inProgress: jobs.filter((j: typeof jobs[number]) => j.status === 'IN_PROGRESS').length,
      enRoute: jobs.filter((j: typeof jobs[number]) => j.status === 'EN_ROUTE').length,
      pending: jobs.filter((j: typeof jobs[number]) => ['PENDING', 'ASSIGNED'].includes(j.status)).length,
      totalEstimatedMinutes: jobs.reduce((sum: number, j: typeof jobs[number]) => sum + (j.estimatedDuration || 0), 0),
      totalActualMinutes: jobs
        .filter((j: typeof jobs[number]) => j.actualDuration)
        .reduce((sum: number, j: typeof jobs[number]) => sum + (j.actualDuration || 0), 0),
      totalTravelMinutes,
    };

    return NextResponse.json({
      success: true,
      data: {
        technician: {
          id: technician.id,
          name: technician.name,
          phone: technician.phone,
          avatar: technician.avatar,
          specialty: technician.specialty,
          skillLevel: technician.skillLevel,
          currentLocation: technician.currentLocation
            ? {
                lat: Number(technician.currentLocation.latitude),
                lng: Number(technician.currentLocation.longitude),
              }
            : null,
        },
        date: date.toISOString().split('T')[0],
        itinerary,
        stats,
      },
    });
  } catch (error) {
    console.error('Get itinerary error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo itinerario' },
      { status: 500 }
    );
  }
}
