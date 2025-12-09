/**
 * Map Providers
 * =============
 *
 * Phase 9.9: Customer Live Tracking System
 * Abstraction layer for tier-based map provider selection.
 * Supports OpenStreetMap (free), Mapbox, and Google Maps.
 */

export type MapProviderType = 'openstreetmap' | 'mapbox' | 'google';

export interface MapProviderConfig {
  type: MapProviderType;
  apiKey?: string;
  styleUrl?: string;
  attributionText: string;
}

export interface RouteOptions {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: 'driving' | 'walking';
}

export interface RouteResult {
  polyline: string;
  durationMinutes: number;
  distanceKm: number;
}

// Provider configurations
export const MAP_PROVIDERS: Record<MapProviderType, MapProviderConfig> = {
  openstreetmap: {
    type: 'openstreetmap',
    styleUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attributionText: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  mapbox: {
    type: 'mapbox',
    apiKey: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    styleUrl: 'mapbox://styles/mapbox/streets-v12',
    attributionText: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>',
  },
  google: {
    type: 'google',
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    attributionText: '&copy; Google Maps',
  },
};

/**
 * Get the appropriate map provider based on configuration
 * Tier selection: Google (enterprise) > Mapbox (standard) > OpenStreetMap (free)
 */
export function getMapProvider(): MapProviderConfig {
  // Check for Google Maps API key (enterprise tier)
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return {
      ...MAP_PROVIDERS.google,
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    };
  }

  // Check for Mapbox API key (standard tier)
  if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return {
      ...MAP_PROVIDERS.mapbox,
      apiKey: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    };
  }

  // Default to OpenStreetMap (free tier)
  return MAP_PROVIDERS.openstreetmap;
}

/**
 * Get tile layer URL for Leaflet-based maps
 */
export function getTileLayerUrl(provider: MapProviderConfig): string {
  switch (provider.type) {
    case 'openstreetmap':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    case 'mapbox':
      if (!provider.apiKey) {
        // Fallback to OSM if no API key
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${provider.apiKey}`;

    case 'google':
      // Google Maps requires different integration (Google Maps JS API)
      // For Leaflet fallback, use OSM
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    default:
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
}

/**
 * Calculate route using OSRM (free routing service)
 * In production, can be upgraded to Mapbox Directions or Google Routes API
 */
export async function calculateRoute(options: RouteOptions): Promise<RouteResult | null> {
  const { origin, destination, mode = 'driving' } = options;

  try {
    // Use OSRM public demo server (for production, host your own or use Mapbox)
    const profile = mode === 'walking' ? 'foot' : 'car';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      return null;
    }

    const route = data.routes[0];

    return {
      polyline: route.geometry,
      durationMinutes: Math.ceil(route.duration / 60),
      distanceKm: parseFloat((route.distance / 1000).toFixed(1)),
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    return null;
  }
}

/**
 * Decode polyline string to coordinates array
 * Based on Google's Polyline Algorithm
 */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Argentina-specific defaults
 */
export const ARGENTINA_DEFAULTS = {
  center: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
  zoom: 12,
  bounds: {
    north: -21.78,
    south: -55.06,
    west: -73.56,
    east: -53.64,
  },
};
