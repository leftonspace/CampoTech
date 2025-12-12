/**
 * Map Route API Route
 * GET /api/map/route
 *
 * Returns driving directions between points using OSRM (free) or Google Maps
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RoutePoint {
  lat: number;
  lng: number;
}

interface RouteResponse {
  success: boolean;
  data?: {
    polyline: [number, number][];
    durationMinutes: number;
    distanceMeters: number;
    legs?: {
      durationMinutes: number;
      distanceMeters: number;
      startAddress?: string;
      endAddress?: string;
    }[];
    source: 'osrm' | 'google' | 'haversine';
  };
  error?: string;
}

// Decode polyline from Google/OSRM format
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

// Calculate Haversine distance between two points
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
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

// Generate straight line polyline (fallback)
function generateStraightLine(
  origin: RoutePoint,
  destination: RoutePoint,
  waypoints?: RoutePoint[]
): [number, number][] {
  const points: [number, number][] = [[origin.lat, origin.lng]];

  if (waypoints) {
    for (const wp of waypoints) {
      points.push([wp.lat, wp.lng]);
    }
  }

  points.push([destination.lat, destination.lng]);
  return points;
}

// Get route from OSRM (free, open-source)
async function getOSRMRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  waypoints?: RoutePoint[]
): Promise<RouteResponse['data'] | null> {
  try {
    // Build coordinates string
    let coords = `${origin.lng},${origin.lat}`;
    if (waypoints && waypoints.length > 0) {
      for (const wp of waypoints) {
        coords += `;${wp.lng},${wp.lat}`;
      }
    }
    coords += `;${destination.lng},${destination.lat}`;

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('OSRM API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const polyline = decodePolyline(route.geometry);

    return {
      polyline,
      durationMinutes: Math.round(route.duration / 60),
      distanceMeters: Math.round(route.distance),
      legs: route.legs?.map((leg: { duration: number; distance: number }) => ({
        durationMinutes: Math.round(leg.duration / 60),
        distanceMeters: Math.round(leg.distance),
      })),
      source: 'osrm',
    };
  } catch (error) {
    console.error('OSRM routing error:', error);
    return null;
  }
}

// Get route from Google Directions API
async function getGoogleRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  waypoints?: RoutePoint[],
  apiKey?: string
): Promise<RouteResponse['data'] | null> {
  if (!apiKey) return null;

  try {
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}`;

    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints
        .map((wp) => `${wp.lat},${wp.lng}`)
        .join('|');
      url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Google Directions API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const polyline = decodePolyline(route.overview_polyline.points);

    let totalDuration = 0;
    let totalDistance = 0;
    const legs = route.legs.map((leg: { duration: { value: number }; distance: { value: number }; start_address: string; end_address: string }) => {
      totalDuration += leg.duration.value;
      totalDistance += leg.distance.value;
      return {
        durationMinutes: Math.round(leg.duration.value / 60),
        distanceMeters: leg.distance.value,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
      };
    });

    return {
      polyline,
      durationMinutes: Math.round(totalDuration / 60),
      distanceMeters: totalDistance,
      legs,
      source: 'google',
    };
  } catch (error) {
    console.error('Google routing error:', error);
    return null;
  }
}

// Generate fallback route using Haversine calculation
function getHaversineRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  waypoints?: RoutePoint[]
): RouteResponse['data'] {
  const polyline = generateStraightLine(origin, destination, waypoints);

  let totalDistance = 0;
  const legs: RouteResponse['data']['legs'] = [];

  for (let i = 0; i < polyline.length - 1; i++) {
    const distance = haversineDistance(
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );
    totalDistance += distance;
    legs.push({
      durationMinutes: Math.round((distance / 1000 / 25) * 60), // 25 km/h average
      distanceMeters: Math.round(distance),
    });
  }

  // Estimate duration based on average city speed (25 km/h)
  const durationMinutes = Math.round((totalDistance / 1000 / 25) * 60);

  return {
    polyline,
    durationMinutes,
    distanceMeters: Math.round(totalDistance),
    legs,
    source: 'haversine',
  };
}

// Check cache for existing route
async function getCachedRoute(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RouteResponse['data'] | null> {
  try {
    // Round coordinates to 4 decimal places for cache key
    const cached = await prisma.etaCache.findFirst({
      where: {
        originLat: { gte: origin.lat - 0.0001, lte: origin.lat + 0.0001 },
        originLng: { gte: origin.lng - 0.0001, lte: origin.lng + 0.0001 },
        destLat: { gte: destination.lat - 0.0001, lte: destination.lat + 0.0001 },
        destLng: { gte: destination.lng - 0.0001, lte: destination.lng + 0.0001 },
        expiresAt: { gt: new Date() },
        source: { not: { startsWith: 'geocode:' } },
      },
    });

    if (cached) {
      // Return cached data with straight line polyline
      return {
        polyline: generateStraightLine(origin, destination),
        durationMinutes: cached.durationMinutes,
        distanceMeters: cached.distanceMeters,
        source: 'osrm', // Original source unknown
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Cache route result
async function cacheRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  data: RouteResponse['data']
): Promise<void> {
  try {
    await prisma.etaCache.create({
      data: {
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        durationMinutes: data.durationMinutes,
        distanceMeters: data.distanceMeters,
        source: data.source,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour cache
      },
    });
  } catch (error) {
    console.error('Failed to cache route:', error);
  }
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

    // Only admins, owners, and dispatchers can request routes
    if (!['ADMIN', 'OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para obtener rutas' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse origin
    const originLat = parseFloat(searchParams.get('originLat') || '');
    const originLng = parseFloat(searchParams.get('originLng') || '');

    // Parse destination
    const destLat = parseFloat(searchParams.get('destLat') || '');
    const destLng = parseFloat(searchParams.get('destLng') || '');

    // Parse optional waypoints (format: "lat1,lng1;lat2,lng2")
    const waypointsParam = searchParams.get('waypoints');
    let waypoints: RoutePoint[] | undefined;

    if (waypointsParam) {
      waypoints = waypointsParam.split(';').map((wp) => {
        const [lat, lng] = wp.split(',').map(parseFloat);
        return { lat, lng };
      }).filter((wp) => !isNaN(wp.lat) && !isNaN(wp.lng));
    }

    // Validate coordinates
    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    const origin: RoutePoint = { lat: originLat, lng: originLng };
    const destination: RoutePoint = { lat: destLat, lng: destLng };

    // Check cache first (only for simple routes without waypoints)
    if (!waypoints || waypoints.length === 0) {
      const cached = await getCachedRoute(origin, destination);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: { ...cached, cached: true },
        });
      }
    }

    // Try OSRM first (free)
    let routeData = await getOSRMRoute(origin, destination, waypoints);

    // Try Google if OSRM fails and API key is available
    if (!routeData) {
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleApiKey) {
        routeData = await getGoogleRoute(origin, destination, waypoints, googleApiKey);
      }
    }

    // Fallback to Haversine calculation
    if (!routeData) {
      routeData = getHaversineRoute(origin, destination, waypoints);
    }

    // Cache the result (only for simple routes)
    if (routeData && (!waypoints || waypoints.length === 0)) {
      await cacheRoute(origin, destination, routeData);
    }

    return NextResponse.json({
      success: true,
      data: routeData,
    });
  } catch (error) {
    console.error('Get route error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo ruta' },
      { status: 500 }
    );
  }
}
