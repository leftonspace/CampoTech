/**
 * Routes API
 * =============
 *
 * Phase 2.3: Multi-Stop Navigation
 *
 * Endpoints for technician route generation and retrieval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { routeGenerationService } from '@/lib/services/route-generation.service';

/**
 * GET /api/routes
 * Get route for a technician on a specific date
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const technicianId = searchParams.get('technicianId') || session.userId;
        const dateStr = searchParams.get('date');

        // Get today's route
        const route = await routeGenerationService.getTodayRoute(
            technicianId,
            session.organizationId
        );

        if (!route) {
            return NextResponse.json({
                success: true,
                data: null,
                message: 'No route available for today',
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                segments: route.segments,
                totalJobs: route.totalJobs,
                totalDistance: route.totalDistance,
                totalDuration: route.totalDuration,
                // Convenience URL for single-segment routes
                primaryUrl: route.segments[0]?.url,
                totalSegments: route.segments.length,
            },
        });
    } catch (error) {
        console.error('[Routes API] GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching route' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/routes
 * Generate route for a technician
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { technicianId, date } = body;

        if (!technicianId) {
            return NextResponse.json(
                { success: false, error: 'technicianId is required' },
                { status: 400 }
            );
        }

        const routeDate = date ? new Date(date) : new Date();

        // Generate route
        const segments = await routeGenerationService.generateDailyRoute(
            technicianId,
            routeDate,
            session.organizationId
        );

        if (segments.length === 0) {
            return NextResponse.json({
                success: true,
                data: null,
                message: 'No jobs scheduled for this date',
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                segments,
                totalJobs: segments.reduce((sum, s) => sum + s.jobIds.length, 0),
                totalDistance: segments.reduce((sum, s) => sum + s.distanceMeters, 0),
                totalDuration: segments.reduce((sum, s) => sum + s.durationSeconds, 0),
                primaryUrl: segments[0]?.url,
                totalSegments: segments.length,
            },
            message: `Route generated with ${segments.length} segment(s)`,
        });
    } catch (error) {
        console.error('[Routes API] POST error:', error);
        return NextResponse.json(
            { success: false, error: 'Error generating route' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/routes
 * Invalidate routes for a technician
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const technicianId = searchParams.get('technicianId');
        const dateStr = searchParams.get('date');

        if (!technicianId) {
            return NextResponse.json(
                { success: false, error: 'technicianId is required' },
                { status: 400 }
            );
        }

        const routeDate = dateStr ? new Date(dateStr) : new Date();

        await routeGenerationService.invalidateRoutes(
            technicianId,
            routeDate,
            session.organizationId
        );

        return NextResponse.json({
            success: true,
            message: 'Routes invalidated',
        });
    } catch (error) {
        console.error('[Routes API] DELETE error:', error);
        return NextResponse.json(
            { success: false, error: 'Error invalidating routes' },
            { status: 500 }
        );
    }
}
