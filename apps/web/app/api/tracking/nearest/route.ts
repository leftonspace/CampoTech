/**
 * Find Nearest Technicians API Route
 * GET /api/tracking/nearest
 *
 * Returns technicians ranked by distance/ETA to a job location
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

function estimateETA(distanceKm: number, mode: string = 'driving'): number {
  // Estimate ETA in minutes based on Buenos Aires traffic conditions
  const avgSpeedKmh = mode === 'walking' ? 5 : 25; // Conservative urban speed
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins, owners, and Admins can find nearest technicians
    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const specialty = searchParams.get('specialty');
    const limit = parseInt(searchParams.get('limit') || '10');
    const availableOnly = searchParams.get('availableOnly') !== 'false';

    // Get destination coordinates
    let destLat: number | null = null;
    let destLng: number | null = null;
    let jobDetails = null;

    if (jobId) {
      // Get job location
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          customer: {
            select: { name: true, address: true },
          },
        },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Trabajo no encontrado' },
          { status: 404 }
        );
      }

      jobDetails = {
        id: job.id,
        jobNumber: job.jobNumber,
        description: job.description,
        customerName: job.customer?.name,
        address: job.customer?.address,
      };

      // Extract coordinates from customer address
      const address = job.customer?.address as Record<string, unknown> | null;
      if (address) {
        if (typeof address.lat === 'number' && typeof address.lng === 'number') {
          destLat = address.lat;
          destLng = address.lng;
        } else if (address.coordinates && typeof address.coordinates === 'object') {
          const coords = address.coordinates as Record<string, unknown>;
          if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            destLat = coords.lat;
            destLng = coords.lng;
          }
        }
      }
    } else if (!isNaN(lat) && !isNaN(lng)) {
      destLat = lat;
      destLng = lng;
    }

    if (destLat === null || destLng === null) {
      return NextResponse.json(
        { success: false, error: 'Se requieren coordenadas de destino' },
        { status: 400 }
      );
    }

    // Calculate online threshold (5 minutes ago)
    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);

    // Get all technicians with their locations
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
        ...(specialty ? { specialty } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatar: true,
        specialty: true,
        skillLevel: true,
        currentLocation: true,
        assignedJobs: {
          where: {
            status: {
              in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'],
            },
          },
          select: {
            id: true,
            status: true,
            scheduledDate: true,
          },
        },
      },
    });

    // Calculate distances and filter
    const techniciansWithDistance = technicians
      .map((tech: typeof technicians[number]) => {
        const location = tech.currentLocation;
        const isOnline = location && location.lastSeen > onlineThreshold;
        const isAvailable = tech.assignedJobs.length === 0;
        const isBusy = tech.assignedJobs.some(
          (j: typeof tech.assignedJobs[number]) => j.status === 'EN_ROUTE' || j.status === 'IN_PROGRESS'
        );

        // Skip if we want available only and technician is busy
        if (availableOnly && isBusy) {
          return null;
        }

        // Skip if technician has no location
        if (!location) {
          return null;
        }

        const techLat = Number(location.latitude);
        const techLng = Number(location.longitude);
        const distance = haversineDistance(techLat, techLng, destLat!, destLng!);
        const etaMinutes = estimateETA(distance);

        return {
          id: tech.id,
          name: tech.name,
          phone: tech.phone,
          avatar: tech.avatar,
          specialty: tech.specialty,
          skillLevel: tech.skillLevel,
          isOnline,
          isAvailable,
          isBusy,
          location: {
            lat: techLat,
            lng: techLng,
          },
          distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          etaMinutes,
          currentJobCount: tech.assignedJobs.length,
        };
      })
      .filter(Boolean)
      .sort((a: typeof technicians[number], b: typeof technicians[number]) => {
        // Sort by availability first, then by distance
        if (a!.isAvailable !== b!.isAvailable) {
          return a!.isAvailable ? -1 : 1;
        }
        return a!.distance - b!.distance;
      })
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        destination: {
          lat: destLat,
          lng: destLng,
          ...(jobDetails ? { job: jobDetails } : {}),
        },
        technicians: techniciansWithDistance,
        count: techniciansWithDistance.length,
      },
    });
  } catch (error) {
    console.error('Find nearest error:', error);
    return NextResponse.json(
      { success: false, error: 'Error buscando técnicos cercanos' },
      { status: 500 }
    );
  }
}
