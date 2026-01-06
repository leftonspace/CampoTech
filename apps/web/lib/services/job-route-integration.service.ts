/**
 * Job Route Integration Service
 * ===============================
 *
 * Phase 2.3 Task 2.3.3 & 2.3.4: Auto-Generate Routes on Job Changes
 *
 * Handles route regeneration triggers when jobs are:
 * - Assigned to a technician
 * - Rescheduled to a different date
 * - Completed (especially for 10th job segment generation)
 */

import { prisma } from '@/lib/prisma';
import { routeGenerationService } from './route-generation.service';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface JobChangeEvent {
    jobId: string;
    technicianId: string | null;
    organizationId: string;
    scheduledDate: Date | null;
    previousTechnicianId?: string | null;
    previousScheduledDate?: Date | null;
    status: string;
}

interface RouteUpdateResult {
    routeUpdated: boolean;
    newSegmentGenerated: boolean;
    segmentNumber?: number;
    routeUrl?: string;
    message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class JobRouteIntegrationService {
    /**
     * Handle job assignment/update - regenerate routes
     * Called when a job is assigned to a technician or rescheduled
     */
    async onJobChange(event: JobChangeEvent): Promise<RouteUpdateResult> {
        const result: RouteUpdateResult = {
            routeUpdated: false,
            newSegmentGenerated: false,
        };

        if (!event.technicianId || !event.scheduledDate) {
            return result;
        }

        try {
            // Regenerate route for the technician's day
            const segments = await routeGenerationService.generateDailyRoute(
                event.technicianId,
                event.scheduledDate,
                event.organizationId
            );

            if (segments.length > 0) {
                result.routeUpdated = true;
                result.routeUrl = segments[0].url;
                result.message = `Ruta actualizada con ${segments.length} segmento(s)`;
            }

            // If technician or date changed, also invalidate old routes
            if (event.previousTechnicianId && event.previousTechnicianId !== event.technicianId) {
                if (event.previousScheduledDate) {
                    await routeGenerationService.invalidateRoutes(
                        event.previousTechnicianId,
                        event.previousScheduledDate,
                        event.organizationId
                    );
                }
            }

            if (event.previousScheduledDate &&
                format(event.previousScheduledDate, 'yyyy-MM-dd') !== format(event.scheduledDate, 'yyyy-MM-dd')) {
                await routeGenerationService.invalidateRoutes(
                    event.technicianId,
                    event.previousScheduledDate,
                    event.organizationId
                );
            }

        } catch (error) {
            console.error('[JobRouteIntegration] Error on job change:', error);
        }

        return result;
    }

    /**
     * Handle job completion - check if new segment should be generated
     * Task 2.3.4: Auto-generate next segment after 10th job
     */
    async onJobCompleted(jobId: string): Promise<RouteUpdateResult> {
        const result: RouteUpdateResult = {
            routeUpdated: false,
            newSegmentGenerated: false,
        };

        try {
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: {
                    assignments: {
                        include: { user: true },
                        take: 1,
                    },
                },
            });

            if (!job || job.assignments.length === 0 || !job.scheduledDate) {
                return result;
            }

            const technicianId = job.assignments[0].userId;
            const scheduledDate = job.scheduledDate;
            const dateStr = format(scheduledDate, 'yyyy-MM-dd');

            // Count completed jobs today for this technician
            const completedToday = await prisma.job.count({
                where: {
                    organizationId: job.organizationId,
                    assignments: {
                        some: { userId: technicianId },
                    },
                    scheduledDate: {
                        gte: new Date(`${dateStr}T00:00:00`),
                        lt: new Date(`${dateStr}T23:59:59`),
                    },
                    status: 'COMPLETED',
                },
            });

            // Check if just completed a multiple of 10
            if (completedToday > 0 && completedToday % 10 === 0) {
                // Get remaining jobs
                const remainingJobs = await prisma.job.findMany({
                    where: {
                        organizationId: job.organizationId,
                        assignments: {
                            some: { userId: technicianId },
                        },
                        scheduledDate: {
                            gte: new Date(`${dateStr}T00:00:00`),
                            lt: new Date(`${dateStr}T23:59:59`),
                        },
                        status: { in: ['SCHEDULED', 'EN_CAMINO', 'WORKING'] },
                    },
                    select: {
                        id: true,
                        address: true,
                        scheduledTimeSlot: true,
                        customer: { select: { name: true } },
                    },
                    orderBy: { scheduledDate: 'asc' },
                    take: 10, // Next 10 jobs
                });

                if (remainingJobs.length > 0) {
                    // Generate new route segment starting from current job's location
                    const newSegmentNumber = Math.floor(completedToday / 10) + 1;

                    const validJobs = remainingJobs.filter((j: { id: string; address: string | null }) => j.address && j.address.trim().length > 0);

                    if (validJobs.length > 0) {
                        const segment = await routeGenerationService.generateRouteSegment(
                            technicianId,
                            job.address || validJobs[0].address!, // Current location or first job
                            validJobs.map((rj: { id: string; address: string | null; scheduledTimeSlot: unknown; customer: { name: string } | null }) => ({
                                id: rj.id,
                                address: rj.address!,
                                scheduledTimeSlot: rj.scheduledTimeSlot as { start?: string; end?: string } | null,
                                customer: rj.customer,
                            })),
                            job.organizationId,
                            newSegmentNumber
                        );

                        result.newSegmentGenerated = true;
                        result.segmentNumber = newSegmentNumber;
                        result.routeUrl = segment.url;
                        result.message = `Nueva ruta generada: ${remainingJobs.length} trabajos restantes`;

                        // Note: Push notification would be sent here
                        // await this.sendRouteNotification(technicianId, segment, remainingJobs.length);
                    }
                }
            }

            // Regenerate route to update segment order after completion
            const segments = await routeGenerationService.generateDailyRoute(
                technicianId,
                scheduledDate,
                job.organizationId
            );

            if (segments.length > 0) {
                result.routeUpdated = true;
                if (!result.routeUrl) {
                    result.routeUrl = segments[0].url;
                }
            }

        } catch (error) {
            console.error('[JobRouteIntegration] Error on job completed:', error);
        }

        return result;
    }

    /**
     * Batch regenerate routes for all technicians with jobs on a date
     * Useful for admin operations
     */
    async regenerateAllRoutesForDate(date: Date, organizationId: string): Promise<{
        techniciansUpdated: number;
        segmentsGenerated: number;
    }> {
        let techniciansUpdated = 0;
        let segmentsGenerated = 0;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Get all technicians with jobs on this date
        const assignmentsOnDate = await prisma.jobAssignment.findMany({
            where: {
                job: {
                    organizationId,
                    scheduledDate: {
                        gte: new Date(`${dateStr}T00:00:00`),
                        lt: new Date(`${dateStr}T23:59:59`),
                    },
                    status: { in: ['SCHEDULED', 'EN_CAMINO', 'WORKING'] },
                },
            },
            select: {
                userId: true,
            },
            distinct: ['userId'],
        });

        const technicianIds = assignmentsOnDate.map((a: { userId: string }) => a.userId);

        for (const technicianId of technicianIds) {
            try {
                const segments = await routeGenerationService.generateDailyRoute(
                    technicianId,
                    date,
                    organizationId
                );

                if (segments.length > 0) {
                    techniciansUpdated++;
                    segmentsGenerated += segments.length;
                }
            } catch (error) {
                console.error(`[JobRouteIntegration] Error generating route for technician ${technicianId}:`, error);
            }
        }

        return { techniciansUpdated, segmentsGenerated };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const jobRouteIntegrationService = new JobRouteIntegrationService();
