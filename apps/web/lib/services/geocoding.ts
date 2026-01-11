/**
 * Geocoding Service
 *
 * Provides address-to-coordinates conversion using multiple providers
 * with caching, queue support, and auto-geocoding hooks
 */

import { prisma } from '@/lib/prisma';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source: 'google' | 'nominatim' | 'cache';
}

interface GeocodingQueueItem {
  entityType: 'customer' | 'user' | 'job' | 'location';
  entityId: string;
  address: string;
  organizationId: string;
  priority?: 'high' | 'normal' | 'low';
}

type _GeocodingQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Cache TTL in milliseconds (7 days)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SQL INJECTION PROTECTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Geocoding queue table name constant (prevents accidental modification)
const _GEOCODING_QUEUE_TABLE = 'GeocodingQueue' as const;

// Rate limiting for Nominatim (1 request per second)
let lastNominatimRequest = 0;
const NOMINATIM_RATE_LIMIT_MS = 1100; // Slightly over 1 second to be safe

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

  // Fallback to Nominatim (OpenStreetMap) with rate limiting
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
      headers: { 'Accept': 'application/json' }
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
        source: 'google'
      };
    }

    return null;
  } catch (_error) {
    console.error('Google geocoding error:', _error);
    return null;
  }
}

/**
 * Geocode using Nominatim (OpenStreetMap)
 * Note: Rate limited to 1 request per second
 */
async function geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
  try {
    // Enforce rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastNominatimRequest;
    if (timeSinceLastRequest < NOMINATIM_RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, NOMINATIM_RATE_LIMIT_MS - timeSinceLastRequest));
    }
    lastNominatimRequest = Date.now();

    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=ar&limit=1`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CampoTech/1.0 (field-service-app)'
      }
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
        source: 'nominatim'
      };
    }

    return null;
  } catch (_error) {
    console.error('Nominatim geocoding error:', _error);
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
        expiresAt: { gt: new Date() }
      }
    });

    if (cached) {
      return {
        lat: Number(cached.originLat),
        lng: Number(cached.originLng),
        source: 'cache'
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
        expiresAt: new Date(Date.now() + CACHE_TTL)
      }
    });
  } catch (_error) {
    console.error('Failed to cache geocode:', _error);
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
  limit: number = 50,
  onProgress?: (current: number, total: number, result: 'success' | 'failed') => void
): Promise<{ processed: number; success: number; failed: number }> {
  const customers = await prisma.customer.findMany({
    where: {
      organizationId
    },
    select: {
      id: true,
      address: true
    },
    take: limit
  });

  let success = 0;
  let failed = 0;
  let processed = 0;

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
      processed++;
      onProgress?.(processed, customers.length, 'failed');
      continue;
    }

    const result = await geocodeAddress(addressString);

    if (result) {
      // Update customer with coordinates
      const updatedAddress = {
        ...addr,
        coordinates: {
          lat: result.lat,
          lng: result.lng
        }
      };

      await prisma.customer.update({
        where: { id: customer.id },
        data: { address: updatedAddress }
      });

      success++;
      onProgress?.(processed + 1, customers.length, 'success');
    } else {
      failed++;
      onProgress?.(processed + 1, customers.length, 'failed');
    }

    processed++;
  }

  return {
    processed: customers.length,
    success,
    failed
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GEOCODING QUEUE FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Queue an entity for geocoding
 * Stores in database for background processing
 * Uses parameterized queries to prevent SQL injection
 */
export async function queueForGeocoding(item: GeocodingQueueItem): Promise<string | null> {
  try {
    const priority = item.priority || 'normal';

    // Check if GeocodingQueue table exists by trying to query
    // Using parameterized query template literal
    const queue = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "GeocodingQueue" ("id", "entityType", "entityId", "address", "organizationId", "priority", "status", "attempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${item.entityType}, ${item.entityId}, ${item.address}, ${item.organizationId}, ${priority}, 'pending', 0, NOW(), NOW())
      ON CONFLICT ("entityType", "entityId") DO UPDATE SET "address" = ${item.address}, "status" = 'pending', "attempts" = 0, "updatedAt" = NOW()
      RETURNING "id"
    `;

    if (queue.length > 0) {
      // Trigger background processing
      processGeocodingQueue(item.organizationId).catch(console.error);
      return queue[0].id;
    }

    return null;
  } catch (_error) {
    // Table might not exist, fall back to immediate processing
    console.log('GeocodingQueue table not available, processing immediately');
    await processGeocodingImmediately(item);
    return null;
  }
}

/**
 * Process geocoding immediately (fallback when queue not available)
 */
async function processGeocodingImmediately(item: GeocodingQueueItem): Promise<boolean> {
  const result = await geocodeAddress(item.address);

  if (!result) {
    return false;
  }

  try {
    switch (item.entityType) {
      case 'customer':
        await updateCustomerCoordinates(item.entityId, result.lat, result.lng);
        break;
      case 'job':
        await updateJobCoordinates(item.entityId, result.lat, result.lng);
        break;
      case 'user':
        // Users don't have direct coordinates, they use homeLocation
        break;
      case 'location':
        await updateLocationCoordinates(item.entityId, result.lat, result.lng);
        break;
    }
    return true;
  } catch (_error) {
    console.error('Failed to update coordinates:', _error);
    return false;
  }
}

/**
 * Process pending items in the geocoding queue
 * Uses parameterized queries to prevent SQL injection
 */
export async function processGeocodingQueue(
  organizationId?: string,
  batchSize: number = 10
): Promise<{ processed: number; success: number; failed: number }> {
  let processed = 0;
  let success = 0;
  let failed = 0;

  // Validate batchSize is a safe number (prevent injection through numeric params)
  const safeBatchSize = Math.min(Math.max(1, Math.floor(batchSize)), 100);

  try {
    // Get pending items from queue using separate queries for clarity and safety
    let items: {
      id: string;
      entityType: string;
      entityId: string;
      address: string;
      organizationId: string;
    }[];

    if (organizationId) {
      // Query with organizationId filter - all params are properly parameterized
      items = await prisma.$queryRaw<typeof items>`
        SELECT "id", "entityType", "entityId", "address", "organizationId"
        FROM "GeocodingQueue"
        WHERE "status" = 'pending' AND "organizationId" = ${organizationId} AND "attempts" < 3
        ORDER BY "priority" DESC, "createdAt" ASC
        LIMIT ${safeBatchSize}
      `;
    } else {
      // Query without organizationId filter
      items = await prisma.$queryRaw<typeof items>`
        SELECT "id", "entityType", "entityId", "address", "organizationId"
        FROM "GeocodingQueue"
        WHERE "status" = 'pending' AND "attempts" < 3
        ORDER BY "priority" DESC, "createdAt" ASC
        LIMIT ${safeBatchSize}
      `;
    }

    for (const item of items) {
      // Mark as processing - using parameterized query
      await prisma.$executeRaw`
        UPDATE "GeocodingQueue" SET "status" = 'processing', "updatedAt" = NOW() WHERE "id" = ${item.id}::uuid
      `;

      const geocodeResult = await geocodeAddress(item.address);

      if (geocodeResult) {
        // Update the entity with coordinates
        let updateSuccess = false;

        try {
          switch (item.entityType) {
            case 'customer':
              await updateCustomerCoordinates(item.entityId, geocodeResult.lat, geocodeResult.lng);
              updateSuccess = true;
              break;
            case 'job':
              await updateJobCoordinates(item.entityId, geocodeResult.lat, geocodeResult.lng);
              updateSuccess = true;
              break;
            case 'location':
              await updateLocationCoordinates(item.entityId, geocodeResult.lat, geocodeResult.lng);
              updateSuccess = true;
              break;
          }
        } catch (_err) {
          console.error('Failed to update entity coordinates:', _err);
        }

        if (updateSuccess) {
          // Mark as completed - using parameterized query
          await prisma.$executeRaw`
            UPDATE "GeocodingQueue" SET "status" = 'completed', "completedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = ${item.id}::uuid
          `;
          success++;
        } else {
          // Mark as failed - using parameterized query
          const errorMsg = 'Failed to update entity';
          await prisma.$executeRaw`
            UPDATE "GeocodingQueue" SET "status" = 'failed', "attempts" = "attempts" + 1, "lastError" = ${errorMsg}, "updatedAt" = NOW() WHERE "id" = ${item.id}::uuid
          `;
          failed++;
        }
      } else {
        // Geocoding failed, increment attempts - using parameterized query
        const errorMsg = 'Geocoding failed';
        await prisma.$executeRaw`
          UPDATE "GeocodingQueue" SET "status" = 'pending', "attempts" = "attempts" + 1, "lastError" = ${errorMsg}, "updatedAt" = NOW() WHERE "id" = ${item.id}::uuid
        `;
        failed++;
      }

      processed++;
    }
  } catch (_error) {
    // Queue table might not exist
    console.error('Geocoding queue processing error:', _error);
  }

  return { processed, success, failed };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTO-GEOCODING HOOKS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Auto-geocode a customer address
 * Call this when a customer is created or their address is updated
 */
export async function autoGeocodeCustomer(
  customerId: string,
  address: unknown,
  organizationId: string
): Promise<void> {
  const addressString = formatAddress(address);

  if (addressString.length < 10) {
    return;
  }

  // Check if already has coordinates
  const coords = extractCoordinates(address);
  if (coords) {
    return;
  }

  await queueForGeocoding({
    entityType: 'customer',
    entityId: customerId,
    address: addressString + ', Argentina',
    organizationId,
    priority: 'high'
  });
}

/**
 * Auto-geocode a job address (from customer)
 * Call this when a job is created
 */
export async function autoGeocodeJob(
  jobId: string,
  customerAddress: unknown,
  organizationId: string
): Promise<void> {
  const addressString = formatAddress(customerAddress);

  if (addressString.length < 10) {
    return;
  }

  await queueForGeocoding({
    entityType: 'job',
    entityId: jobId,
    address: addressString + ', Argentina',
    organizationId,
    priority: 'high'
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COORDINATE UPDATE FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Update customer with geocoded coordinates
 */
async function updateCustomerCoordinates(customerId: string, lat: number, lng: number): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { address: true }
  });

  if (!customer) return;

  const currentAddress = customer.address as Record<string, unknown> || {};

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      address: {
        ...currentAddress,
        coordinates: { lat, lng },
        geocodedAt: new Date().toISOString()
      }
    }
  });
}

/**
 * Update job with geocoded coordinates
 * Jobs inherit coordinates from their associated customer, so we update the customer instead
 */
async function updateJobCoordinates(jobId: string, lat: number, lng: number): Promise<void> {
  // Jobs get coordinates from their customer - update the customer's address
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { customerId: true }
  });

  if (job?.customerId) {
    await updateCustomerCoordinates(job.customerId, lat, lng);
  }
}

/**
 * Update location with geocoded coordinates
 */
async function updateLocationCoordinates(locationId: string, lat: number, lng: number): Promise<void> {
  await prisma.location.update({
    where: { id: locationId },
    data: {
      coordinates: { lat, lng }
    }
  });
}

/**
 * Manually set coordinates for an entity
 */
export async function setManualCoordinates(
  entityType: 'customer' | 'job' | 'location',
  entityId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  try {
    switch (entityType) {
      case 'customer':
        await updateCustomerCoordinates(entityId, lat, lng);
        break;
      case 'job':
        await updateJobCoordinates(entityId, lat, lng);
        break;
      case 'location':
        await updateLocationCoordinates(entityId, lat, lng);
        break;
      default:
        return false;
    }
    return true;
  } catch (_error) {
    console.error('Failed to set manual coordinates:', _error);
    return false;
  }
}

/**
 * Trigger re-geocode for a single entity
 */
export async function triggerReGeocode(
  entityType: 'customer' | 'job' | 'location',
  entityId: string,
  organizationId: string
): Promise<boolean> {
  try {
    let address = '';

    switch (entityType) {
      case 'customer': {
        const customer = await prisma.customer.findUnique({
          where: { id: entityId },
          select: { address: true }
        });
        address = formatAddress(customer?.address);
        break;
      }
      case 'job': {
        const job = await prisma.job.findUnique({
          where: { id: entityId },
          select: { customer: { select: { address: true } } }
        });
        address = formatAddress(job?.customer?.address);
        break;
      }
      case 'location': {
        const location = await prisma.location.findUnique({
          where: { id: entityId },
          select: { address: true }
        });
        address = formatAddress(location?.address);
        break;
      }
    }

    if (address.length < 10) {
      return false;
    }

    await queueForGeocoding({
      entityType,
      entityId,
      address: address + ', Argentina',
      organizationId,
      priority: 'high'
    });

    return true;
  } catch (_error) {
    console.error('Failed to trigger re-geocode:', _error);
    return false;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UTILITY FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      lng: addr.coordinates.lng
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LOCATION HISTORY CLEANUP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Delete old location history records
 * Should be run periodically (e.g., daily cron job)
 */
export async function cleanupOldLocationHistory(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.technicianLocationHistory.deleteMany({
      where: {
        recordedAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Deleted ${result.count} old location history records`);
    return result.count;
  } catch (_error) {
    console.error('Failed to cleanup location history:', _error);
    return 0;
  }
}

/**
 * Delete old geocoding queue records
 * Uses parameterized query to prevent SQL injection
 */
export async function cleanupOldGeocodingQueue(daysToKeep: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Using parameterized query template literal
    const result = await prisma.$executeRaw`
      DELETE FROM "GeocodingQueue" WHERE "status" IN ('completed', 'failed') AND "updatedAt" < ${cutoffDate}
    `;

    console.log(`Deleted ${result} old geocoding queue records`);
    return result as number;
  } catch (_error) {
    // Table might not exist
    console.error('Failed to cleanup geocoding queue:', _error);
    return 0;
  }
}
