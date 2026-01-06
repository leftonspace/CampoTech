/**
 * Google Maps API Configuration
 * ==============================
 *
 * Phase 2.3 Task 2.3.1: Set Up Google Maps API
 *
 * Configuration for Google Maps services including:
 * - Distance Matrix API
 * - Directions API
 * - Geocoding API
 * - Maps JavaScript API
 */

export const GOOGLE_MAPS_CONFIG = {
    // API Keys (from environment)
    serverKey: process.env.GOOGLE_MAPS_SERVER_KEY || '',
    clientKey: process.env.GOOGLE_MAPS_CLIENT_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',

    // Rate limits (requests per minute)
    rateLimits: {
        distanceMatrix: 100,
        directions: 100,
        geocoding: 100,
    },

    // Defaults for Argentina
    defaults: {
        region: 'ar',
        language: 'es',
        travelMode: 'driving' as const,
        units: 'metric' as const,
    },

    // Waypoint limits
    limits: {
        maxWaypoints: 10, // Google Maps allows max 10 waypoints per request
        maxJobsBeforeSegment: 10, // Create new segment after 10 jobs
    },
};

/**
 * Check if Google Maps is properly configured
 */
export function isGoogleMapsConfigured(): boolean {
    return !!(GOOGLE_MAPS_CONFIG.serverKey || GOOGLE_MAPS_CONFIG.clientKey);
}

/**
 * Get the appropriate API key for the context
 */
export function getGoogleMapsKey(context: 'server' | 'client' = 'server'): string {
    if (context === 'server' && GOOGLE_MAPS_CONFIG.serverKey) {
        return GOOGLE_MAPS_CONFIG.serverKey;
    }
    return GOOGLE_MAPS_CONFIG.clientKey;
}
