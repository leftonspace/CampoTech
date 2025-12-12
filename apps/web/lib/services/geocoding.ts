/**
 * Geocoding Service
 *
 * Provides address-to-coordinates conversion using multiple providers
 * with caching and fallback support
 */

import { prisma } from '@/lib/prisma';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source: 'google' | 'nominatim' | 'cache';
}

interface GeocodingQueueItem {
  entityType: 'customer' | 'user' | 'job';
  entityId: string;
  address: string;
  organizationId: string;
}

// Cache TTL in milliseconds (7 days)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Geocode an address using available providers
 */
export async function geocodeAddress(
  address: string,
  options: { useCache?: boolean } = {}
): Promise<GeocodingResult | null> {
  const { useCache = true } = options;

  if (!address || address.trim().length < 5) {
    return null;
  }

  const normalizedAddress = normalizeAddress(address);

  // Check cache first
  if (useCache) {
    const cached = await getCachedGeocode(normalizedAddress);
    if (cached) {
      return cached;
    }
  }

  // Try Google Maps first if API key is available
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    const googleResult = await geocodeWithGoogle(normalizedAddress, googleApiKey);
    if (googleResult) {
      await cacheGeocode(normalizedAddress, googleResult);
      return googleResult;
    }
  }

  // Fallback to Nominatim (OpenStreetMap)
  const nominatimResult = await geocodeWithNominatim(normalizedAddress);
  if (nominatimResult) {
    await cacheGeocode(normalizedAddress, nominatimResult);
    return nominatimResult;
  }

  return null;
}

/**
 * Geocode using Google Maps Geocoding API
 */
async function geocodeWithGoogle(
  address: string,
  apiKey: string
): Promise<GeocodingResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&region=ar`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Google Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        source: 'google',
      };
    }

    return null;
  } catch (error) {
    console.error('Google geocoding error:', error);
    return null;
  }
}

/**
 * Geocode using Nominatim (OpenStreetMap)
 * Note: Rate limited to 1 request per second
 */
async function geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=ar&limit=1`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CampoTech/1.0 (field-service-app)',
      },
    });

    if (!response.ok) {
      console.error('Nominatim API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        source: 'nominatim',
      };
    }

    return null;
  } catch (error) {
    console.error('Nominatim geocoding error:', error);
    return null;
  }
}

/**
 * Get cached geocode result
 */
async function getCachedGeocode(address: string): Promise<GeocodingResult | null> {
  try {
    // Use EtaCache table as a general geocode cache
    const addressHash = hashAddress(address);
    const cached = await prisma.etaCache.findFirst({
      where: {
        source: `geocode:${addressHash}`,
        expiresAt: { gt: new Date() },
      },
    });

    if (cached) {
      return {
        lat: Number(cached.originLat),
        lng: Number(cached.originLng),
        source: 'cache',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cache geocode result
 */
async function cacheGeocode(address: string, result: GeocodingResult): Promise<void> {
  try {
    const addressHash = hashAddress(address);
    await prisma.etaCache.create({
      data: {
        originLat: result.lat,
        originLng: result.lng,
        destLat: 0,
        destLng: 0,
        durationMinutes: 0,
        distanceMeters: 0,
        source: `geocode:${addressHash}`,
        expiresAt: new Date(Date.now() + CACHE_TTL),
      },
    });
  } catch (error) {
    console.error('Failed to cache geocode:', error);
  }
}

/**
 * Normalize address for consistent caching
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,\.]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Create a simple hash of the address for cache keys
 */
function hashAddress(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Batch geocode customers without coordinates
 */
export async function batchGeocodeCustomers(
  organizationId: string,
  limit: number = 50
): Promise<{ processed: number; success: number; failed: number }> {
  const customers = await prisma.customer.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      address: true,
    },
    take: limit,
  });

  let success = 0;
  let failed = 0;

  for (const customer of customers) {
    const addr = customer.address as {
      street?: string;
      number?: string;
      city?: string;
      postalCode?: string;
      coordinates?: { lat?: number; lng?: number };
    } | null;

    // Skip if already has coordinates
    if (addr?.coordinates?.lat && addr?.coordinates?.lng) {
      continue;
    }

    // Build address string
    const addressParts = [];
    if (addr?.street) {
      let streetLine = addr.street;
      if (addr.number) streetLine += ` ${addr.number}`;
      addressParts.push(streetLine);
    }
    if (addr?.city) addressParts.push(addr.city);
    if (addr?.postalCode) addressParts.push(addr.postalCode);
    addressParts.push('Argentina');

    const addressString = addressParts.join(', ');

    if (addressString.length < 10) {
      failed++;
      continue;
    }

    // Rate limit for Nominatim (1 request per second)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await geocodeAddress(addressString);

    if (result) {
      // Update customer with coordinates
      const updatedAddress = {
        ...addr,
        coordinates: {
          lat: result.lat,
          lng: result.lng,
        },
      };

      await prisma.customer.update({
        where: { id: customer.id },
        data: { address: updatedAddress },
      });

      success++;
    } else {
      failed++;
    }
  }

  return {
    processed: customers.length,
    success,
    failed,
  };
}

/**
 * Queue an entity for geocoding (for background processing)
 */
export async function queueForGeocoding(item: GeocodingQueueItem): Promise<void> {
  // For now, we'll process immediately
  // In a production environment, this would add to a job queue (e.g., BullMQ)
  console.log('Queued for geocoding:', item);
}

/**
 * Parse address JSON and extract coordinates
 */
export function extractCoordinates(address: unknown): { lat: number; lng: number } | null {
  if (!address || typeof address !== 'object') {
    return null;
  }

  const addr = address as { coordinates?: { lat?: number; lng?: number } };

  if (addr.coordinates?.lat && addr.coordinates?.lng) {
    return {
      lat: addr.coordinates.lat,
      lng: addr.coordinates.lng,
    };
  }

  return null;
}

/**
 * Format address JSON to string
 */
export function formatAddress(address: unknown): string {
  if (!address || typeof address !== 'object') {
    return '';
  }

  const addr = address as {
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    postalCode?: string;
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
  if (addr.postalCode) parts.push(`CP ${addr.postalCode}`);

  return parts.join(', ');
}
