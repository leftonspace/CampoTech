/**
 * ETA Calculation Service
 * =======================
 *
 * Calculates estimated time of arrival for technicians.
 * Supports multiple providers: Google Maps, OSRM, or simple estimation.
 */

import { ETARequest, ETAResult, ETAProvider, GeoLocation } from './tracking.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SPEED_KMH = 30; // Average city driving speed
const TRAFFIC_MULTIPLIER = 1.3; // Add 30% for traffic
const MIN_ETA_MINUTES = 5; // Minimum ETA to show

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE MAPS PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export class GoogleMapsETAProvider implements ETAProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async calculateETA(request: ETARequest): Promise<ETAResult> {
    try {
      const { origin, destination, travelMode = 'driving' } = request;

      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destinations', `${destination.lat},${destination.lng}`);
      url.searchParams.set('mode', travelMode);
      url.searchParams.set('departure_time', 'now');
      url.searchParams.set('key', this.apiKey);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
        throw new Error('Invalid response from Google Maps API');
      }

      const element = data.rows[0].elements[0];

      if (element.status !== 'OK') {
        throw new Error(`Route not found: ${element.status}`);
      }

      // Use duration_in_traffic if available
      const duration = element.duration_in_traffic || element.duration;
      const distance = element.distance;

      return {
        durationMinutes: Math.ceil(duration.value / 60),
        durationText: duration.text,
        distanceMeters: distance.value,
        distanceText: distance.text,
        calculatedAt: new Date(),
        source: 'google_maps',
      };
    } catch (error) {
      console.error('[ETA] Google Maps API error:', error);
      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OSRM PROVIDER (Open Source Routing Machine)
// ═══════════════════════════════════════════════════════════════════════════════

export class OSRMETAProvider implements ETAProvider {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://router.project-osrm.org') {
    this.baseUrl = baseUrl;
  }

  async calculateETA(request: ETARequest): Promise<ETAResult> {
    try {
      const { origin, destination, travelMode = 'driving' } = request;

      const profile = travelMode === 'walking' ? 'foot' : 'car';
      const url = `${this.baseUrl}/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error('Route not found');
      }

      const route = data.routes[0];
      const durationSeconds = route.duration * TRAFFIC_MULTIPLIER; // Add traffic buffer
      const distanceMeters = route.distance;

      return {
        durationMinutes: Math.max(MIN_ETA_MINUTES, Math.ceil(durationSeconds / 60)),
        durationText: this.formatDuration(durationSeconds),
        distanceMeters: distanceMeters,
        distanceText: this.formatDistance(distanceMeters),
        calculatedAt: new Date(),
        source: 'osrm',
      };
    } catch (error) {
      console.error('[ETA] OSRM API error:', error);
      throw error;
    }
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} h ${remainingMinutes} min`;
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE ESTIMATION (Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

export class SimpleETAProvider implements ETAProvider {
  async calculateETA(request: ETARequest): Promise<ETAResult> {
    const { origin, destination } = request;

    // Calculate straight-line distance using Haversine formula
    const distanceKm = this.haversineDistance(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    // Apply road factor (roads are typically 1.3x longer than straight line)
    const roadDistanceKm = distanceKm * 1.3;
    const distanceMeters = Math.round(roadDistanceKm * 1000);

    // Calculate time based on average speed with traffic
    const timeHours = roadDistanceKm / DEFAULT_SPEED_KMH;
    const timeMinutes = Math.max(MIN_ETA_MINUTES, Math.ceil(timeHours * 60 * TRAFFIC_MULTIPLIER));

    return {
      durationMinutes: timeMinutes,
      durationText: this.formatDuration(timeMinutes),
      distanceMeters: distanceMeters,
      distanceText: this.formatDistance(distanceMeters),
      calculatedAt: new Date(),
      source: 'estimate',
    };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} h ${remainingMinutes} min`;
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETA SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ETAService {
  private provider: ETAProvider;
  private fallbackProvider: ETAProvider;
  private cache: Map<string, { eta: ETAResult; expiresAt: number }>;
  private cacheTTLMs: number;

  constructor(
    provider: ETAProvider,
    options?: {
      fallbackProvider?: ETAProvider;
      cacheTTLMs?: number;
    }
  ) {
    this.provider = provider;
    this.fallbackProvider = options?.fallbackProvider || new SimpleETAProvider();
    this.cacheTTLMs = options?.cacheTTLMs || 30000; // 30 seconds default
    this.cache = new Map();
  }

  /**
   * Calculate ETA with caching and fallback
   */
  async getETA(
    origin: GeoLocation,
    destination: GeoLocation,
    options?: { forceRefresh?: boolean }
  ): Promise<ETAResult> {
    const cacheKey = this.getCacheKey(origin, destination);

    // Check cache
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.eta;
      }
    }

    // Calculate ETA
    try {
      const eta = await this.provider.calculateETA({
        origin,
        destination,
        travelMode: 'driving',
      });

      // Cache result
      this.cache.set(cacheKey, {
        eta,
        expiresAt: Date.now() + this.cacheTTLMs,
      });

      return eta;
    } catch (error) {
      console.warn('[ETA] Primary provider failed, using fallback:', error);

      // Try fallback provider
      const eta = await this.fallbackProvider.calculateETA({
        origin,
        destination,
        travelMode: 'driving',
      });

      // Cache with shorter TTL for fallback results
      this.cache.set(cacheKey, {
        eta,
        expiresAt: Date.now() + this.cacheTTLMs / 2,
      });

      return eta;
    }
  }

  /**
   * Check if technician is close to arrival
   */
  isNearArrival(eta: ETAResult, thresholdMinutes: number = 5): boolean {
    return eta.durationMinutes <= thresholdMinutes;
  }

  /**
   * Check if technician has arrived (within ~100 meters)
   */
  hasArrived(technicianLocation: GeoLocation, destination: GeoLocation): boolean {
    const distanceMeters = this.calculateDistanceMeters(
      technicianLocation.lat,
      technicianLocation.lng,
      destination.lat,
      destination.lng
    );
    return distanceMeters <= 100;
  }

  /**
   * Clean up expired cache entries
   */
  cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(origin: GeoLocation, destination: GeoLocation): string {
    // Round to 4 decimal places (~11m precision) for cache key
    const roundCoord = (n: number) => Math.round(n * 10000) / 10000;
    return `${roundCoord(origin.lat)},${roundCoord(origin.lng)}-${roundCoord(
      destination.lat
    )},${roundCoord(destination.lng)}`;
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON AND FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

let etaServiceInstance: ETAService | null = null;

export function getETAService(): ETAService {
  if (!etaServiceInstance) {
    throw new Error('ETA Service not initialized');
  }
  return etaServiceInstance;
}

export function initializeETAService(config?: {
  googleMapsApiKey?: string;
  osrmUrl?: string;
  useSimple?: boolean;
}): ETAService {
  let provider: ETAProvider;

  if (config?.googleMapsApiKey) {
    provider = new GoogleMapsETAProvider(config.googleMapsApiKey);
  } else if (config?.osrmUrl) {
    provider = new OSRMETAProvider(config.osrmUrl);
  } else {
    provider = new SimpleETAProvider();
  }

  etaServiceInstance = new ETAService(provider);
  return etaServiceInstance;
}

export function resetETAService(): void {
  etaServiceInstance = null;
}
