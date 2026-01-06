/**
 * Attribution Service
 * ===================
 * 
 * Phase 3.2: WhatsApp Attribution Tracking
 * 
 * Responsible for matching created jobs to marketplace clicks.
 * Uses a heuristic approach (best-effort) based on time proximity
 * within a 7-day attribution window.
 */

import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

export class AttributionService {
    /**
     * Match job to marketplace click (7-day attribution window)
     * 
     * Heuristic: If a job is created by an organization within 1 hour
     * after a marketplace click for that same organization, we attribute it.
     */
    async attributeJobToClick(jobId: string): Promise<boolean> {
        try {
            // 1. Fetch job details
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                select: {
                    id: true,
                    organizationId: true,
                    createdAt: true,
                },
            });

            if (!job) {
                console.warn(`[AttributionService] Job not found: ${jobId}`);
                return false;
            }

            // 2. Find recent unattributed clicks for this organization
            // Attribution window: 7 days
            const attributionWindowStart = subDays(new Date(), 7);

            const recentClicks = await prisma.marketplaceClick.findMany({
                where: {
                    organizationId: job.organizationId,
                    clickedAt: {
                        gte: attributionWindowStart,
                        lte: job.createdAt, // Must have clicked before or at job creation
                    },
                    convertedJobId: null, // Only unattributed clicks
                },
                orderBy: { clickedAt: 'desc' },
                take: 10, // Check most recent clicks first
            });

            if (recentClicks.length === 0) {
                return false;
            }

            // 3. Match by time proximity
            // Threshold: 1 hour (3600000 ms)
            const PROXIMITY_THRESHOLD_MS = 60 * 60 * 1000;

            for (const click of recentClicks) {
                const timeDiff = job.createdAt.getTime() - click.clickedAt.getTime();

                if (timeDiff >= 0 && timeDiff <= PROXIMITY_THRESHOLD_MS) {
                    // Match found!
                    try {
                        await prisma.marketplaceClick.update({
                            where: { id: click.id },
                            data: {
                                convertedJobId: job.id,
                                convertedAt: new Date(),
                            },
                        });

                        console.log(`[AttributionService] Job ${job.id} attributed to click ${click.id}`);
                        return true;
                    } catch (updateError) {
                        // Handle race conditions (another job might have grabbed this click)
                        console.error(`[AttributionService] Failed to update click ${click.id}:`, updateError);
                        continue;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('[AttributionService] Error during attribution:', error);
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let attributionServiceInstance: AttributionService | null = null;

export function getAttributionService(): AttributionService {
    if (!attributionServiceInstance) {
        attributionServiceInstance = new AttributionService();
    }
    return attributionServiceInstance;
}
