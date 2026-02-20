/**
 * Route Generation Service
 * =========================
 *
 * Phase 2.3 Task 2.3.2: Implement Route Generation Service
 *
 * Generates optimized routes for technicians with Google Maps integration.
 * Handles >10 jobs by creating multiple segments.
 */

import { prisma } from '@/lib/prisma';
import { GOOGLE_MAPS_CONFIG, getGoogleMapsKey, isGoogleMapsConfigured } from '../integrations/google-maps/config';
import { format } from 'date-fns';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface RouteSegment {
    segmentNumber: number;
    jobIds: string[];
    origin: string;
    destination: string;
    waypoints: string[];
    optimizedOrder?: number[];
    url: string;
    distanceMeters: number;
    durationSeconds: number;
}

interface JobWithAddress {
    id: string;
    address: string;
    scheduledTimeSlot?: { start?: string; end?: string } | null;
    customer?: { name: string } | null;
}

interface DirectionsResponse {
    status: string;
    routes?: Array<{
        legs: Array<{
            distance: { value: number };
            duration: { value: number };
            /** Traffic-aware duration (only when departure_time is set) */
            duration_in_traffic?: { value: number };
        }>;
        waypoint_order?: number[];
    }>;
    error_message?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SERVICE CLASS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class RouteGenerationService {
    /**
     * Generate optimized route for technician's daily jobs
     * Handles waypoint limit (max 10 per request)
     */
    async generateDailyRoute(
        technicianId: string,
        date: Date,
        organizationId: string
    ): Promise<RouteSegment[]> {
        // Check configuration
        if (!isGoogleMapsConfigured()) {
            console.warn('[RouteGeneration] Google Maps not configured, generating URL-only routes');
        }

        // 1. Get technician's jobs for the day
        const dateStr = format(date, 'yyyy-MM-dd');
        const jobs = await prisma.job.findMany({
            where: {
                organizationId,
                assignments: {
                    some: { userId: technicianId },
                },
                scheduledDate: {
                    gte: new Date(`${dateStr}T00:00:00`),
                    lt: new Date(`${dateStr}T23:59:59`),
                },
                status: { in: ['SCHEDULED', 'EN_CAMINO', 'WORKING'] },
            },
            orderBy: { scheduledDate: 'asc' },
            select: {
                id: true,
                address: true,
                scheduledTimeSlot: true,
                customer: { select: { name: true } },
            },
        });

        if (jobs.length === 0) {
            return [];
        }

        // Filter jobs with valid addresses
        const validJobs = jobs.filter((j: { id: string; address: string | null }) => j.address && j.address.trim().length > 0);

        if (validJobs.length === 0) {
            return [];
        }

        // 2. Get technician's start location (home address or office)
        const _technician = await prisma.user.findUnique({
            where: { id: technicianId },
            select: { name: true, email: true },
        });

        // Default origin: first job's address (or could be tech's home)
        let origin = validJobs[0].address;

        // 3. Split into chunks of 10 (Google Maps waypoint limit)
        const jobChunks = this.chunkArray(validJobs, GOOGLE_MAPS_CONFIG.limits.maxWaypoints);

        // 4. Generate route for each chunk
        const segments: RouteSegment[] = [];

        for (let i = 0; i < jobChunks.length; i++) {
            const chunk = jobChunks[i] as JobWithAddress[];
            const destination = chunk[chunk.length - 1].address;
            const waypoints = chunk.length > 1 ? chunk.slice(0, -1).map((j) => j.address) : [];

            let distanceMeters = 0;
            let durationSeconds = 0;
            let optimizedOrder: number[] | undefined;

            // Try to get actual route from Google Maps
            if (isGoogleMapsConfigured()) {
                try {
                    const routeData = await this.fetchGoogleDirections(origin, destination, waypoints);
                    if (routeData) {
                        distanceMeters = routeData.routes?.[0]?.legs.reduce(
                            (sum, leg) => sum + leg.distance.value,
                            0
                        ) || 0;
                        // Prefer traffic-aware duration when available
                        durationSeconds = routeData.routes?.[0]?.legs.reduce(
                            (sum, leg) => sum + (leg.duration_in_traffic?.value ?? leg.duration.value),
                            0
                        ) || 0;
                        optimizedOrder = routeData.routes?.[0]?.waypoint_order;
                    }
                } catch (error) {
                    console.error('[RouteGeneration] Google Maps API error:', error);
                }
            }

            // Generate shareable URL
            const routeUrl = this.generateMapsUrl(origin, chunk);

            segments.push({
                segmentNumber: i + 1,
                jobIds: chunk.map((j) => j.id),
                origin,
                destination,
                waypoints,
                optimizedOrder,
                url: routeUrl,
                distanceMeters,
                durationSeconds,
            });

            // Next segment starts from last job's location
            origin = destination;
        }

        // 5. Store routes in database
        await this.storeRoutes(technicianId, date, segments, organizationId);

        return segments;
    }

    /**
     * Generate route segment starting from current location
     */
    async generateRouteSegment(
        technicianId: string,
        currentLocation: string,
        jobs: JobWithAddress[],
        organizationId: string,
        segmentNumber: number
    ): Promise<RouteSegment> {
        const destination = jobs[jobs.length - 1].address;
        const waypoints = jobs.length > 1 ? jobs.slice(0, -1).map((j) => j.address) : [];

        let distanceMeters = 0;
        let durationSeconds = 0;
        let optimizedOrder: number[] | undefined;

        if (isGoogleMapsConfigured()) {
            try {
                const routeData = await this.fetchGoogleDirections(currentLocation, destination, waypoints);
                if (routeData) {
                    distanceMeters = routeData.routes?.[0]?.legs.reduce(
                        (sum, leg) => sum + leg.distance.value,
                        0
                    ) || 0;
                    // Prefer traffic-aware duration when available
                    durationSeconds = routeData.routes?.[0]?.legs.reduce(
                        (sum, leg) => sum + (leg.duration_in_traffic?.value ?? leg.duration.value),
                        0
                    ) || 0;
                    optimizedOrder = routeData.routes?.[0]?.waypoint_order;
                }
            } catch (error) {
                console.error('[RouteGeneration] Google Maps API error:', error);
            }
        }

        const routeUrl = this.generateMapsUrl(currentLocation, jobs);

        const segment: RouteSegment = {
            segmentNumber,
            jobIds: jobs.map((j) => j.id),
            origin: currentLocation,
            destination,
            waypoints,
            optimizedOrder,
            url: routeUrl,
            distanceMeters,
            durationSeconds,
        };

        // Store the new segment
        await this.storeSegment(technicianId, new Date(), segment, organizationId);

        return segment;
    }

    /**
     * Get today's route for a technician
     */
    async getTodayRoute(
        technicianId: string,
        organizationId: string
    ): Promise<{ segments: RouteSegment[]; totalJobs: number; totalDistance: number; totalDuration: number } | null> {
        const today = format(new Date(), 'yyyy-MM-dd');

        const routes = await prisma.technicianRoute.findMany({
            where: {
                technicianId,
                organizationId,
                date: new Date(today),
                isActive: true,
            },
            orderBy: { segmentNumber: 'asc' },
        });

        if (routes.length === 0) {
            return null;
        }

        const segments: RouteSegment[] = routes.map((r: {
            segmentNumber: number;
            jobIds: string[];
            origin: string;
            destination: string;
            waypoints: string[];
            optimizedOrder: number[] | null;
            routeUrl: string;
            distanceMeters: number | null;
            durationSeconds: number | null;
        }) => ({
            segmentNumber: r.segmentNumber,
            jobIds: r.jobIds,
            origin: r.origin,
            destination: r.destination,
            waypoints: r.waypoints,
            optimizedOrder: r.optimizedOrder || undefined,
            url: r.routeUrl,
            distanceMeters: r.distanceMeters || 0,
            durationSeconds: r.durationSeconds || 0,
        }));

        return {
            segments,
            totalJobs: segments.reduce((sum, s) => sum + s.jobIds.length, 0),
            totalDistance: segments.reduce((sum, s) => sum + s.distanceMeters, 0),
            totalDuration: segments.reduce((sum, s) => sum + s.durationSeconds, 0),
        };
    }

    /**
     * Invalidate routes (call when jobs change)
     */
    async invalidateRoutes(technicianId: string, date: Date, organizationId: string): Promise<void> {
        const dateStr = format(date, 'yyyy-MM-dd');

        await prisma.technicianRoute.updateMany({
            where: {
                technicianId,
                organizationId,
                date: new Date(dateStr),
            },
            data: { isActive: false },
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // PRIVATE METHODS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Fetch directions from Google Maps API
     */
    private async fetchGoogleDirections(
        origin: string,
        destination: string,
        waypoints: string[]
    ): Promise<DirectionsResponse | null> {
        const apiKey = getGoogleMapsKey('server');
        if (!apiKey) return null;

        const waypointsParam = waypoints.length > 0
            ? `&waypoints=optimize:true|${waypoints.map((w) => encodeURIComponent(w)).join('|')}`
            : '';

        // departure_time=now enables traffic-aware duration and route optimization
        const trafficParams = `&departure_time=now&traffic_model=best_guess`;

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&mode=${GOOGLE_MAPS_CONFIG.defaults.travelMode}&language=${GOOGLE_MAPS_CONFIG.defaults.language}&region=${GOOGLE_MAPS_CONFIG.defaults.region}${trafficParams}&key=${apiKey}`;

        try {
            const response = await fetch(url);
            const data = await response.json() as DirectionsResponse;

            if (data.status !== 'OK') {
                console.error('[RouteGeneration] Directions API error:', data.status, data.error_message);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[RouteGeneration] Fetch error:', error);
            return null;
        }
    }

    /**
     * Generate Google Maps URL for route
     */
    private generateMapsUrl(origin: string, jobs: JobWithAddress[]): string {
        if (jobs.length === 0) return '';

        const destination = jobs[jobs.length - 1].address;
        const waypoints = jobs.length > 1
            ? jobs.slice(0, -1).map((j) => encodeURIComponent(j.address)).join('|')
            : '';

        let url = `https://www.google.com/maps/dir/?api=1`;
        url += `&origin=${encodeURIComponent(origin)}`;
        url += `&destination=${encodeURIComponent(destination)}`;

        if (waypoints) {
            url += `&waypoints=${waypoints}`;
        }

        url += `&travelmode=driving`;

        return url;
    }

    /**
     * Store routes in database
     */
    private async storeRoutes(
        technicianId: string,
        date: Date,
        segments: RouteSegment[],
        organizationId: string
    ): Promise<void> {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Deactivate old routes
        await prisma.technicianRoute.updateMany({
            where: {
                technicianId,
                organizationId,
                date: new Date(dateStr),
            },
            data: { isActive: false },
        });

        // Create new routes
        for (const segment of segments) {
            await prisma.technicianRoute.create({
                data: {
                    organizationId,
                    technicianId,
                    date: new Date(dateStr),
                    segmentNumber: segment.segmentNumber,
                    jobIds: segment.jobIds,
                    origin: segment.origin,
                    destination: segment.destination,
                    waypoints: segment.waypoints,
                    optimizedOrder: segment.optimizedOrder || [],
                    routeUrl: segment.url,
                    distanceMeters: segment.distanceMeters,
                    durationSeconds: segment.durationSeconds,
                    isActive: true,
                },
            });
        }
    }

    /**
     * Store a single segment
     */
    private async storeSegment(
        technicianId: string,
        date: Date,
        segment: RouteSegment,
        organizationId: string
    ): Promise<void> {
        const dateStr = format(date, 'yyyy-MM-dd');

        await prisma.technicianRoute.create({
            data: {
                organizationId,
                technicianId,
                date: new Date(dateStr),
                segmentNumber: segment.segmentNumber,
                jobIds: segment.jobIds,
                origin: segment.origin,
                destination: segment.destination,
                waypoints: segment.waypoints,
                optimizedOrder: segment.optimizedOrder || [],
                routeUrl: segment.url,
                distanceMeters: segment.distanceMeters,
                durationSeconds: segment.durationSeconds,
                isActive: true,
            },
        });
    }

    /**
     * Split array into chunks
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON EXPORT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const routeGenerationService = new RouteGenerationService();
