/**
 * Tracking Locations API Route
 * GET /api/tracking/locations
 *
 * Returns all active technician locations for the live map
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins, owners, and dispatchers can view all technician locations
    if (!['ADMIN', 'OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver ubicaciones' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const onlineOnly = searchParams.get('onlineOnly') !== 'false';
    const locationId = searchParams.get('locationId');

    // Get all technicians with their current locations
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
        ...(locationId ? { homeLocationId: locationId } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatar: true,
        specialty: true,
        skillLevel: true,
        homeLocationId: true,
        currentLocation: true,
        assignedJobs: {
          where: {
            status: {
              in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'],
            },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 1,
          select: {
            id: true,
            jobNumber: true,
            status: true,
            description: true,
            scheduledDate: true,
            scheduledTimeSlot: true,
            customer: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        },
        trackingSessions: {
          where: {
            status: 'ACTIVE',
          },
          take: 1,
          select: {
            id: true,
            status: true,
            etaMinutes: true,
            movementMode: true,
          },
        },
      },
    });

    // Calculate online threshold (5 minutes ago)
    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);

    // Transform data
    const locations = technicians
      .map((tech) => {
        const location = tech.currentLocation;
        const isOnline = location && location.lastSeen > onlineThreshold;

        // Skip offline technicians if onlineOnly is true
        if (onlineOnly && !isOnline) {
          return null;
        }

        const currentJob = tech.assignedJobs[0] || null;
        const activeSession = tech.trackingSessions[0] || null;

        return {
          id: tech.id,
          name: tech.name,
          phone: tech.phone,
          avatar: tech.avatar,
          specialty: tech.specialty,
          skillLevel: tech.skillLevel,
          isOnline: isOnline || false,
          lastSeen: location?.lastSeen || null,
          location: location
            ? {
                lat: Number(location.latitude),
                lng: Number(location.longitude),
                accuracy: location.accuracy ? Number(location.accuracy) : null,
                heading: location.heading ? Number(location.heading) : null,
                speed: location.speed ? Number(location.speed) : null,
              }
            : null,
          currentJob: currentJob
            ? {
                id: currentJob.id,
                jobNumber: currentJob.jobNumber,
                status: currentJob.status,
                description: currentJob.description,
                scheduledDate: currentJob.scheduledDate,
                scheduledTimeSlot: currentJob.scheduledTimeSlot,
                customerName: currentJob.customer?.name,
                address: currentJob.customer?.address,
              }
            : null,
          tracking: activeSession
            ? {
                sessionId: activeSession.id,
                status: activeSession.status,
                etaMinutes: activeSession.etaMinutes,
                movementMode: activeSession.movementMode,
              }
            : null,
        };
      })
      .filter(Boolean);

    // Get summary stats
    const stats = {
      total: technicians.length,
      online: locations.filter((l) => l?.isOnline).length,
      enRoute: locations.filter((l) => l?.currentJob?.status === 'EN_ROUTE').length,
      working: locations.filter((l) => l?.currentJob?.status === 'IN_PROGRESS').length,
      available: locations.filter((l) => l?.isOnline && !l?.currentJob).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        technicians: locations,
        stats,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get locations error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo ubicaciones' },
      { status: 500 }
    );
  }
}
