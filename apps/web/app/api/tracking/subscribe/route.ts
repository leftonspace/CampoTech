/**
 * Tracking Subscribe API Route (Server-Sent Events)
 * GET /api/tracking/subscribe
 *
 * Provides real-time location updates via SSE
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only admins, owners, and dispatchers can subscribe to location updates
  if (!['ADMIN', 'OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`
        )
      );

      // Keep track of last seen locations
      const lastLocations = new Map<string, { lat: number; lng: number; updatedAt: Date }>();

      // Poll for updates every 5 seconds
      const interval = setInterval(async () => {
        try {
          // Get current technician locations
          const locations = await prisma.technicianLocation.findMany({
            where: {
              user: {
                organizationId: session.organizationId,
                role: 'TECHNICIAN',
                isActive: true,
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  assignedJobs: {
                    where: {
                      status: { in: ['EN_ROUTE', 'IN_PROGRESS'] },
                    },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                  trackingSessions: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                    select: {
                      etaMinutes: true,
                      movementMode: true,
                    },
                  },
                },
              },
            },
          });

          const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);

          for (const loc of locations) {
            const lastLoc = lastLocations.get(loc.userId);
            const currentLat = Number(loc.latitude);
            const currentLng = Number(loc.longitude);

            // Check if location changed or first update
            if (
              !lastLoc ||
              lastLoc.lat !== currentLat ||
              lastLoc.lng !== currentLng ||
              loc.updatedAt > lastLoc.updatedAt
            ) {
              const isOnline = loc.lastSeen > onlineThreshold;
              const session = loc.user.trackingSessions[0];
              const currentJob = loc.user.assignedJobs[0];

              const update = {
                type: 'location_update',
                data: {
                  id: loc.id,
                  userId: loc.userId,
                  name: loc.user.name,
                  lat: currentLat,
                  lng: currentLng,
                  speed: loc.speed ? Number(loc.speed) : undefined,
                  heading: loc.heading ? Number(loc.heading) : undefined,
                  movementMode: session?.movementMode || 'stationary',
                  isOnline,
                  currentJobId: currentJob?.id,
                  etaMinutes: session?.etaMinutes,
                  updatedAt: loc.updatedAt.toISOString(),
                },
                timestamp: new Date().toISOString(),
              };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));

              lastLocations.set(loc.userId, {
                lat: currentLat,
                lng: currentLng,
                updatedAt: loc.updatedAt,
              });
            }
          }

          // Check for offline technicians
          const currentIds = new Set(locations.map((l) => l.userId));
          for (const [userId] of Array.from(lastLocations.entries())) {
            if (!currentIds.has(userId)) {
              // Technician went offline
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'technician_offline',
                    data: { userId },
                    timestamp: new Date().toISOString(),
                  })}\n\n`
                )
              );
              lastLocations.delete(userId);
            }
          }

          // Send heartbeat
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
            )
          );
        } catch (error) {
          console.error('SSE polling error:', error);
        }
      }, 5000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
