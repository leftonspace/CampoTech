/**
 * CampoTech Number Inventory Cron Jobs
 * =====================================
 * 
 * Handles automated WhatsApp number inventory management:
 * - releaseInactiveNumbers: Release numbers with no activity for 30+ days
 * - releaseExpiredReservations: Release expired number reservations
 * - recycleReleasedNumbers: Move released numbers back to available pool after cooldown
 * - resetMonthlyMessageCounts: Reset monthly message counts on 1st of each month
 * - processMonthlyBilling: Track monthly costs for assigned numbers
 * 
 * Recommended Schedule:
 * - releaseInactiveNumbers: Daily at 3:00 AM
 * - releaseExpiredReservations: Hourly
 * - recycleReleasedNumbers: Daily at 4:00 AM  
 * - resetMonthlyMessageCounts: Monthly on 1st at 12:01 AM
 * - processMonthlyBilling: Monthly on 1st at 12:05 AM
 */

import { numberInventoryService } from '@/lib/services/number-inventory.service';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CronJobResult {
    success: boolean;
    processed: number;
    durationMs: number;
    details?: Record<string, unknown>;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB: Release Inactive Numbers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Release WhatsApp numbers that have been inactive for 30+ days
 * This frees up numbers for reassignment to active customers
 * 
 * @schedule Daily at 3:00 AM Buenos Aires time
 */
export async function releaseInactiveNumbers(): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
        console.log('[NumberInventoryCron] Starting releaseInactiveNumbers...');

        const released = await numberInventoryService.autoReleaseInactiveNumbers();

        const durationMs = Date.now() - startTime;
        console.log(`[NumberInventoryCron] Released ${released} inactive numbers in ${durationMs}ms`);

        // Log cron event
        await logCronEvent('number_inventory_release_inactive', {
            success: true,
            processed: released,
            durationMs,
        });

        return {
            success: true,
            processed: released,
            durationMs,
            details: {
                inactivityThresholdDays: 30,
            },
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error('[NumberInventoryCron] Error in releaseInactiveNumbers:', error);

        await logCronEvent('number_inventory_release_inactive', {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB: Release Expired Reservations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Release number reservations that have expired (typically 24 hours)
 * Prevents numbers from being locked indefinitely during failed onboarding
 * 
 * @schedule Hourly
 */
export async function releaseExpiredReservations(): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
        console.log('[NumberInventoryCron] Starting releaseExpiredReservations...');

        const released = await numberInventoryService.releaseExpiredReservations();

        const durationMs = Date.now() - startTime;
        console.log(`[NumberInventoryCron] Released ${released} expired reservations in ${durationMs}ms`);

        await logCronEvent('number_inventory_release_expired_reservations', {
            success: true,
            processed: released,
            durationMs,
        });

        return {
            success: true,
            processed: released,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error('[NumberInventoryCron] Error in releaseExpiredReservations:', error);

        await logCronEvent('number_inventory_release_expired_reservations', {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB: Recycle Released Numbers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Move released numbers back to available pool after cooldown period (7 days)
 * Ensures numbers aren't immediately reassigned to different customers
 * 
 * @schedule Daily at 4:00 AM Buenos Aires time
 */
export async function recycleReleasedNumbers(): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
        console.log('[NumberInventoryCron] Starting recycleReleasedNumbers...');

        const recycled = await numberInventoryService.recycleReleasedNumbers();

        const durationMs = Date.now() - startTime;
        console.log(`[NumberInventoryCron] Recycled ${recycled} numbers in ${durationMs}ms`);

        await logCronEvent('number_inventory_recycle', {
            success: true,
            processed: recycled,
            durationMs,
        });

        return {
            success: true,
            processed: recycled,
            durationMs,
            details: {
                cooldownDays: 7,
            },
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error('[NumberInventoryCron] Error in recycleReleasedNumbers:', error);

        await logCronEvent('number_inventory_recycle', {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB: Reset Monthly Message Counts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reset monthly message counts for all numbers
 * Used for usage analytics and billing
 * 
 * @schedule Monthly on 1st at 12:01 AM Buenos Aires time
 */
export async function resetMonthlyMessageCounts(): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
        console.log('[NumberInventoryCron] Starting resetMonthlyMessageCounts...');

        await numberInventoryService.resetMonthlyMessageCounts();

        // Get count of numbers affected
        const count = await prisma.whatsAppNumberInventory.count();

        const durationMs = Date.now() - startTime;
        console.log(`[NumberInventoryCron] Reset monthly counts for ${count} numbers in ${durationMs}ms`);

        await logCronEvent('number_inventory_reset_monthly_counts', {
            success: true,
            processed: count,
            durationMs,
        });

        return {
            success: true,
            processed: count,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error('[NumberInventoryCron] Error in resetMonthlyMessageCounts:', error);

        await logCronEvent('number_inventory_reset_monthly_counts', {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB: Process Monthly Billing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process monthly billing for all assigned numbers
 * Tracks cumulative costs and logs billing events
 * 
 * @schedule Monthly on 1st at 12:05 AM Buenos Aires time
 */
export async function processMonthlyBilling(): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
        console.log('[NumberInventoryCron] Starting processMonthlyBilling...');

        const result = await numberInventoryService.processMonthlyBilling();

        const durationMs = Date.now() - startTime;
        console.log(`[NumberInventoryCron] Billed ${result.numbers} numbers, total $${result.totalCostUsd.toFixed(2)} USD in ${durationMs}ms`);

        await logCronEvent('number_inventory_monthly_billing', {
            success: true,
            processed: result.numbers,
            durationMs,
            details: {
                totalCostUsd: result.totalCostUsd,
            },
        });

        return {
            success: true,
            processed: result.numbers,
            durationMs,
            details: {
                totalCostUsd: result.totalCostUsd,
            },
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error('[NumberInventoryCron] Error in processMonthlyBilling:', error);

        await logCronEvent('number_inventory_monthly_billing', {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            success: false,
            processed: 0,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN ALL NUMBER INVENTORY CRONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all daily number inventory cron jobs
 * Useful for manual triggers or testing
 */
export async function runAllNumberInventoryCrons(): Promise<{
    releaseInactive: CronJobResult;
    releaseExpired: CronJobResult;
    recycle: CronJobResult;
}> {
    console.log('[NumberInventoryCron] Running all cron jobs...');

    const [releaseInactive, releaseExpired, recycle] = await Promise.all([
        releaseInactiveNumbers(),
        releaseExpiredReservations(),
        recycleReleasedNumbers(),
    ]);

    return {
        releaseInactive,
        releaseExpired,
        recycle,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Log Cron Event
// ═══════════════════════════════════════════════════════════════════════════════

async function logCronEvent(
    eventType: string,
    result: CronJobResult & { details?: Record<string, unknown>; error?: string }
): Promise<void> {
    try {
        await prisma.event.create({
            data: {
                type: eventType,
                description: `Number inventory cron: ${eventType}`,
                payload: {
                    success: result.success,
                    processed: result.processed,
                    durationMs: result.durationMs,
                    details: result.details,
                    error: result.error,
                    timestamp: new Date().toISOString(),
                },
                severity: result.success ? 'info' : 'error',
            },
        });
    } catch (error) {
        // Don't fail the cron job if logging fails
        console.error('[NumberInventoryCron] Failed to log event:', error);
    }
}
