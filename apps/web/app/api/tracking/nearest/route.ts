/**
 * Find Nearest Technicians API Route
 * GET /api/tracking/nearest
 *
 * Phase 2.4: Upgraded with real Distance Matrix API + BA traffic intelligence.
 *
 * Returns technicians ranked by ACTUAL travel time (with live traffic),
 * not straight-line distance. Also provides multi-modal comparison
 * during rush hours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  haversineDistanceKm,
  getBatchDistances,
  compareMultiModal,
  getBuenosAiresTrafficContext,
  estimateEtaFallback,
  type TravelMode,
} from '@/lib/integrations/google-maps/distance-matrix';

// Max straight-line distance for pre-filtering (km)
const HAVERSINE_PREFILTER_KM = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins, owners can find nearest technicians
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
    const includeMultiModal = searchParams.get('multiModal') === 'true';

    // Get destination coordinates
    let destLat: number | null = null;
    let destLng: number | null = null;
    let destAddress: string | null = null;
    let jobDetails = null;

    if (jobId) {
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
        // Extract string address for Distance Matrix
        if (typeof address.formatted === 'string') {
          destAddress = address.formatted;
        } else if (typeof address.street === 'string') {
          destAddress = `${address.street}, Buenos Aires, Argentina`;
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

    const destinationStr = destAddress || `${destLat},${destLng}`;

    // Online threshold (5 minutes)
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

    // ─── STEP 1: Haversine Pre-Filter ───────────────────────────────────
    // Fast geometric filter to eliminate technicians that are obviously too far
    type TechCandidate = typeof technicians[number] & {
      haversineKm: number;
      techLat: number;
      techLng: number;
      isOnline: boolean;
      isAvailable: boolean;
      isBusy: boolean;
    };

    const candidates: TechCandidate[] = [];

    for (const tech of technicians) {
      const location = tech.currentLocation;
      const isOnline = !!(location && location.lastSeen > onlineThreshold);
      const isBusy = tech.assignedJobs.some(
        (j: typeof tech.assignedJobs[number]) => j.status === 'EN_ROUTE' || j.status === 'IN_PROGRESS'
      );
      const isAvailable = tech.assignedJobs.length === 0;

      if (availableOnly && isBusy) continue;
      if (!location) continue;

      const techLat = Number(location.latitude);
      const techLng = Number(location.longitude);
      const haversineKm = haversineDistanceKm(techLat, techLng, destLat, destLng);

      // Pre-filter: skip if straight-line distance > threshold
      if (haversineKm > HAVERSINE_PREFILTER_KM) continue;

      candidates.push({
        ...tech,
        haversineKm,
        techLat,
        techLng,
        isOnline,
        isAvailable,
        isBusy,
      });
    }

    // ─── STEP 2: Real Distance Matrix ───────────────────────────────────
    // Call Google Distance Matrix API for actual travel times with live traffic
    const trafficContext = getBuenosAiresTrafficContext();

    const origins = candidates.map((c) => ({
      id: c.id,
      location: `${c.techLat},${c.techLng}`,
    }));

    const batchResult = await getBatchDistances(origins, destinationStr, 'driving');

    // ─── STEP 3: Build Results ──────────────────────────────────────────
    const techniciansWithDistance = candidates.map((tech, index) => {
      const matrixResult = batchResult.results.find((r) => r.originIndex === index);
      const distanceKm = matrixResult
        ? matrixResult.element.distanceMeters / 1000
        : tech.haversineKm;
      const etaMinutes = matrixResult
        ? Math.ceil(matrixResult.effectiveEtaSeconds / 60)
        : estimateEtaFallback(tech.haversineKm).etaMinutes;
      const isRealEta = matrixResult?.element.durationInTrafficSeconds !== null;

      return {
        id: tech.id,
        name: tech.name,
        phone: tech.phone,
        avatar: tech.avatar,
        specialty: tech.specialty,
        skillLevel: tech.skillLevel,
        isOnline: tech.isOnline,
        isAvailable: tech.isAvailable,
        isBusy: tech.isBusy,
        location: {
          lat: tech.techLat,
          lng: tech.techLng,
        },
        // Real driving distance (from Distance Matrix, not Haversine)
        distance: Math.round(distanceKm * 100) / 100,
        haversineKm: Math.round(tech.haversineKm * 100) / 100,
        // Real ETA with live traffic
        etaMinutes,
        etaText: matrixResult?.element.durationInTrafficText
          ?? matrixResult?.element.durationText
          ?? `~${etaMinutes} min`,
        isRealEta,
        currentJobCount: tech.assignedJobs.length,
      };
    });

    // Sort by availability first, then by ETA (not distance!)
    techniciansWithDistance.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return a.etaMinutes - b.etaMinutes;
    });

    const topResults = techniciansWithDistance.slice(0, limit);

    // ─── STEP 4 (Optional): Multi-Modal Comparison ──────────────────────
    // During rush hour, show if moto/bici would be faster for the top candidate
    let multiModalData = null;
    if (includeMultiModal && topResults.length > 0 && trafficContext.isRushHour) {
      const topTech = topResults[0];
      const topOrigin = `${topTech.location.lat},${topTech.location.lng}`;

      multiModalData = await compareMultiModal(
        topOrigin,
        destinationStr,
        ['driving', 'bicycling', 'transit'] as TravelMode[],
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        destination: {
          lat: destLat,
          lng: destLng,
          ...(jobDetails ? { job: jobDetails } : {}),
        },
        technicians: topResults,
        count: topResults.length,
        totalCandidates: candidates.length,
        // Buenos Aires traffic intelligence
        traffic: {
          context: trafficContext,
          multiModal: multiModalData,
        },
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

