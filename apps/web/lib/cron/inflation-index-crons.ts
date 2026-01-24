/**
 * Inflation Index Cron Jobs
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Handles scheduled scraping of inflation indices from INDEC:
 * - IPC (Índice de Precios al Consumidor) - Consumer prices
 * - ICC (Índice del Costo de la Construcción) - Construction costs
 * 
 * Schedule Strategy (Smart Scheduling):
 * - Daily check at 10:00 AM Buenos Aires time
 * - On expected report days: retry HOURLY until new data is found
 * - Persists next report dates to database for reliable scheduling
 * - Compares scraped period vs. last known period to detect updates
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { getIndecUnifiedScraper, IndecUnifiedResult } from '@/lib/scrapers/indec-unified-scraper';

// Type for InflationIndex records (inline to avoid generation issues)
interface InflationIndexRecord {
    id: string;
    source: string;
    period: string;
    rate: Decimal;
    publishedAt: Date | null;
    scrapedAt: Date | null;
    createdAt: Date;
}

// Type for ScrapeSchedule records
interface ScrapeScheduleRecord {
    id: string;
    source: string;
    lastScrapedAt: Date | null;
    lastScrapedPeriod: string | null;
    nextReportDate: Date | null;
    scrapeAttempts: number;
    lastAttemptAt: Date | null;
    lastError: string | null;
    isWaitingForUpdate: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InflationCronResult {
    success: boolean;
    scraped: boolean;
    reason: string;
    data?: IndecUnifiedResult;
    error?: string;
    durationMs: number;
    scheduleUpdated?: boolean;
    newDataFound?: {
        ipc?: boolean;
        icc?: boolean;
    };
}

export interface ScheduledScrapeConfig {
    source: 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL';
    nextReportDate: Date | null;
    lastScrapedAt: Date | null;
    lastScrapedPeriod: string | null;
    scrapeAttempts: number;
    isWaitingForUpdate: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCES = ['INDEC_IPC_GENERAL', 'CAC_ICC_GENERAL'] as const;

/**
 * Get the current scrape schedule from the database.
 * Creates schedule records if they don't exist.
 * Falls back to InflationIndex-based scheduling if ScrapeSchedule table doesn't exist yet.
 */
export async function getScrapeSchedule(): Promise<ScheduledScrapeConfig[]> {
    const configs: ScheduledScrapeConfig[] = [];

    try {
        for (const source of SOURCES) {
            let schedule = await prisma.scrapeSchedule?.findUnique({
                where: { source },
            }) as ScrapeScheduleRecord | null;

            // If table doesn't exist or no record, fall back to InflationIndex
            if (!schedule) {
                const latestIndex = await prisma.inflationIndex.findFirst({
                    where: { source },
                    orderBy: { period: 'desc' },
                }) as InflationIndexRecord | null;

                // Try to create schedule record if table exists
                try {
                    schedule = await prisma.scrapeSchedule?.create({
                        data: {
                            source,
                            lastScrapedAt: latestIndex?.scrapedAt || null,
                            lastScrapedPeriod: latestIndex?.period || null,
                        },
                    }) as ScrapeScheduleRecord;
                } catch {
                    // Table doesn't exist yet, use fallback
                    console.log(`[InflationCron] ScrapeSchedule table not available, using fallback for ${source}`);
                }

                // If still no schedule, create a synthetic config from InflationIndex
                if (!schedule) {
                    configs.push({
                        source: source as 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL',
                        nextReportDate: null,
                        lastScrapedAt: latestIndex?.scrapedAt || null,
                        lastScrapedPeriod: latestIndex?.period || null,
                        scrapeAttempts: 0,
                        isWaitingForUpdate: false,
                    });
                    continue;
                }
            }

            configs.push({
                source: source as 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL',
                nextReportDate: schedule.nextReportDate,
                lastScrapedAt: schedule.lastScrapedAt,
                lastScrapedPeriod: schedule.lastScrapedPeriod,
                scrapeAttempts: schedule.scrapeAttempts,
                isWaitingForUpdate: schedule.isWaitingForUpdate,
            });
        }
    } catch (_error) {
        // Complete fallback if ScrapeSchedule doesn't exist at all
        console.log('[InflationCron] ScrapeSchedule not available, using InflationIndex fallback');

        for (const source of SOURCES) {
            const latestIndex = await prisma.inflationIndex.findFirst({
                where: { source },
                orderBy: { period: 'desc' },
            }) as InflationIndexRecord | null;

            configs.push({
                source: source as 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL',
                nextReportDate: null,
                lastScrapedAt: latestIndex?.scrapedAt || null,
                lastScrapedPeriod: latestIndex?.period || null,
                scrapeAttempts: 0,
                isWaitingForUpdate: false,
            });
        }
    }

    return configs;
}

/**
 * Get current date in Buenos Aires timezone
 */
function getBuenosAiresDate(): Date {
    const now = new Date();
    // Buenos Aires is UTC-3
    const buenosAiresOffset = -3 * 60; // minutes
    const localOffset = now.getTimezoneOffset();
    const buenosAiresTime = new Date(now.getTime() + (localOffset - buenosAiresOffset) * 60000);
    return buenosAiresTime;
}

/**
 * Check if a date is today (in Buenos Aires timezone)
 */
function isToday(date: Date): boolean {
    const now = getBuenosAiresDate();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

/**
 * Check if a date is in the past (before today in Buenos Aires timezone)
 */
function isPast(date: Date): boolean {
    const now = getBuenosAiresDate();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compareDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return compareDay < today;
}

/**
 * Check if we should scrape today based on smart scheduling:
 * 1. Never scraped before
 * 2. It's the expected report date (or past it) and we haven't found new data yet
 * 3. We're waiting for an update and haven't exhausted hourly retries
 * 4. Last successful scrape was more than 24 hours ago (fallback)
 */
export function shouldScrapeToday(config: ScheduledScrapeConfig): { shouldScrape: boolean; reason: string } {
    // Never scraped - definitely scrape
    if (!config.lastScrapedAt) {
        return { shouldScrape: true, reason: 'First scrape ever' };
    }

    const now = getBuenosAiresDate();

    // If we have a scheduled report date
    if (config.nextReportDate) {
        const isReportDay = isToday(config.nextReportDate) || isPast(config.nextReportDate);

        if (isReportDay) {
            // On report day: retry hourly (max 12 attempts = 12 hours of retries)
            if (config.scrapeAttempts < 12) {
                // Check if last attempt was more than 1 hour ago
                if (!config.lastScrapedAt) {
                    return { shouldScrape: true, reason: 'Report day, first attempt' };
                }

                const hoursSinceLastAttempt = (now.getTime() - config.lastScrapedAt.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastAttempt >= 1) {
                    return {
                        shouldScrape: true,
                        reason: `Report day, attempt ${config.scrapeAttempts + 1}/12 (${hoursSinceLastAttempt.toFixed(1)}h since last)`,
                    };
                }
            }
        }
    }

    // Fallback: if last scrape was more than 24 hours ago, try again
    const hoursSinceLastScrape = (now.getTime() - config.lastScrapedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastScrape > 24) {
        return { shouldScrape: true, reason: `${hoursSinceLastScrape.toFixed(1)} hours since last scrape` };
    }

    return { shouldScrape: false, reason: 'No scrape needed' };
}

/**
 * Update the schedule after a successful scrape
 */
async function updateScheduleAfterScrape(
    result: IndecUnifiedResult,
    previousConfigs: ScheduledScrapeConfig[]
): Promise<{ ipcUpdated: boolean; iccUpdated: boolean }> {
    let ipcUpdated = false;
    let iccUpdated = false;

    // Update IPC schedule
    if (result.ipc) {
        const prevConfig = previousConfigs.find(c => c.source === 'INDEC_IPC_GENERAL');
        const isNewData = prevConfig?.lastScrapedPeriod !== result.ipc.period;
        ipcUpdated = isNewData;

        try {
            await prisma.scrapeSchedule?.upsert({
                where: { source: 'INDEC_IPC_GENERAL' },
                update: {
                    lastScrapedAt: result.ipc.scrapedAt,
                    lastScrapedPeriod: result.ipc.period,
                    nextReportDate: result.nextReportDates?.ipc || null,
                    scrapeAttempts: isNewData ? 0 : (prevConfig?.scrapeAttempts || 0) + 1,
                    lastAttemptAt: new Date(),
                    lastError: null,
                    isWaitingForUpdate: !isNewData,
                },
                create: {
                    source: 'INDEC_IPC_GENERAL',
                    lastScrapedAt: result.ipc.scrapedAt,
                    lastScrapedPeriod: result.ipc.period,
                    nextReportDate: result.nextReportDates?.ipc || null,
                },
            });
        } catch {
            console.log('[InflationCron] ScrapeSchedule table not available for IPC update');
        }

        console.log(`[InflationCron] IPC schedule updated. New data: ${isNewData}, Period: ${result.ipc.period}`);
    }

    // Update ICC schedule
    if (result.icc) {
        const prevConfig = previousConfigs.find(c => c.source === 'CAC_ICC_GENERAL');
        const isNewData = prevConfig?.lastScrapedPeriod !== result.icc.period;
        iccUpdated = isNewData;

        try {
            await prisma.scrapeSchedule?.upsert({
                where: { source: 'CAC_ICC_GENERAL' },
                update: {
                    lastScrapedAt: result.icc.scrapedAt,
                    lastScrapedPeriod: result.icc.period,
                    nextReportDate: result.nextReportDates?.icc || null,
                    scrapeAttempts: isNewData ? 0 : (prevConfig?.scrapeAttempts || 0) + 1,
                    lastAttemptAt: new Date(),
                    lastError: null,
                    isWaitingForUpdate: !isNewData,
                },
                create: {
                    source: 'CAC_ICC_GENERAL',
                    lastScrapedAt: result.icc.scrapedAt,
                    lastScrapedPeriod: result.icc.period,
                    nextReportDate: result.nextReportDates?.icc || null,
                },
            });
        } catch {
            console.log('[InflationCron] ScrapeSchedule table not available for ICC update');
        }

        console.log(`[InflationCron] ICC schedule updated. New data: ${isNewData}, Period: ${result.icc.period}`);
    }

    return { ipcUpdated, iccUpdated };
}

/**
 * Record a scrape error
 */
async function recordScrapeError(source: typeof SOURCES[number], error: string): Promise<void> {
    try {
        await prisma.scrapeSchedule?.upsert({
            where: { source },
            update: {
                lastAttemptAt: new Date(),
                lastError: error,
                scrapeAttempts: { increment: 1 },
            },
            create: {
                source,
                lastError: error,
                scrapeAttempts: 1,
                lastAttemptAt: new Date(),
            },
        });
    } catch {
        console.log(`[InflationCron] ScrapeSchedule table not available for recording error on ${source}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CRON FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main cron job function.
 * Checks if scraping is needed and performs it if so.
 */
export async function runInflationIndexCron(): Promise<InflationCronResult> {
    const startTime = Date.now();

    console.log('[InflationCron] Starting inflation index check...');
    console.log(`[InflationCron] Buenos Aires time: ${getBuenosAiresDate().toISOString()}`);

    try {
        // Get current schedule
        const schedules = await getScrapeSchedule();

        // Log current schedule state
        for (const schedule of schedules) {
            console.log(`[InflationCron] ${schedule.source}:`);
            console.log(`  Last period: ${schedule.lastScrapedPeriod || 'never'}`);
            console.log(`  Next report: ${schedule.nextReportDate?.toISOString() || 'unknown'}`);
            console.log(`  Attempts: ${schedule.scrapeAttempts}`);
        }

        // Check if any source needs scraping
        const scrapeDecisions = schedules.map(s => ({
            source: s.source,
            ...shouldScrapeToday(s),
        }));

        const needsScraping = scrapeDecisions.some(d => d.shouldScrape);

        if (!needsScraping) {
            console.log('[InflationCron] No scraping needed today');
            for (const decision of scrapeDecisions) {
                console.log(`  ${decision.source}: ${decision.reason}`);
            }
            return {
                success: true,
                scraped: false,
                reason: 'No sources need scraping',
                durationMs: Date.now() - startTime,
            };
        }

        // Log why we're scraping
        for (const decision of scrapeDecisions) {
            if (decision.shouldScrape) {
                console.log(`[InflationCron] Scraping ${decision.source}: ${decision.reason}`);
            }
        }

        console.log('[InflationCron] Running unified scraper...');

        // Run the unified scraper
        const scraper = getIndecUnifiedScraper();
        const result = await scraper.scrapeAndSave();

        // Close browser to free resources
        await scraper.closeBrowser();

        if (!result.success) {
            console.error('[InflationCron] Scrape failed:', result.error);

            // Record error for each source
            for (const source of SOURCES) {
                await recordScrapeError(source, result.error || 'Unknown error');
            }

            return {
                success: false,
                scraped: true,
                reason: 'Scrape attempted but failed',
                data: result,
                error: result.error,
                durationMs: Date.now() - startTime,
            };
        }

        console.log('[InflationCron] Scrape succeeded!');
        console.log(`  IPC: ${result.ipc?.rate}% (${result.ipc?.period})`);
        console.log(`  ICC: ${result.icc?.rate}% (${result.icc?.period})`);

        // Update schedules and check for new data
        const { ipcUpdated, iccUpdated } = await updateScheduleAfterScrape(result, schedules);

        if (ipcUpdated || iccUpdated) {
            console.log('[InflationCron] 🎉 NEW DATA FOUND!');
            if (ipcUpdated) console.log(`  IPC updated to ${result.ipc?.period}`);
            if (iccUpdated) console.log(`  ICC updated to ${result.icc?.period}`);
        }

        if (result.nextReportDates?.ipc) {
            console.log(`  Next IPC report: ${result.nextReportDates.ipc.toISOString()}`);
        }
        if (result.nextReportDates?.icc) {
            console.log(`  Next ICC report: ${result.nextReportDates.icc.toISOString()}`);
        }

        return {
            success: true,
            scraped: true,
            reason: 'Successfully scraped and saved indices',
            data: result,
            durationMs: Date.now() - startTime,
            scheduleUpdated: true,
            newDataFound: {
                ipc: ipcUpdated,
                icc: iccUpdated,
            },
        };

    } catch (error) {
        console.error('[InflationCron] Error:', error);
        return {
            success: false,
            scraped: false,
            reason: 'Cron job threw an exception',
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
        };
    }
}

/**
 * Force a scrape regardless of schedule.
 * Used for manual triggering from admin.
 */
export async function forceInflationScrape(): Promise<InflationCronResult> {
    const startTime = Date.now();

    console.log('[InflationCron] Forcing inflation index scrape...');

    try {
        // Get current schedules for comparison
        const schedules = await getScrapeSchedule();

        const scraper = getIndecUnifiedScraper();
        const result = await scraper.scrapeAndSave();
        await scraper.closeBrowser();

        if (!result.success) {
            return {
                success: false,
                scraped: true,
                reason: 'Force scrape failed',
                data: result,
                error: result.error,
                durationMs: Date.now() - startTime,
            };
        }

        // Update schedules
        const { ipcUpdated, iccUpdated } = await updateScheduleAfterScrape(result, schedules);

        return {
            success: true,
            scraped: true,
            reason: 'Force scrape succeeded',
            data: result,
            durationMs: Date.now() - startTime,
            scheduleUpdated: true,
            newDataFound: {
                ipc: ipcUpdated,
                icc: iccUpdated,
            },
        };

    } catch (error) {
        return {
            success: false,
            scraped: false,
            reason: 'Force scrape threw an exception',
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
        };
    }
}

/**
 * Get the current status of inflation indices and schedules.
 */
export async function getInflationIndexStatus() {
    const indices = await prisma.inflationIndex.findMany({
        orderBy: { period: 'desc' },
        take: 10,
    }) as InflationIndexRecord[];

    const ipcLatest = indices.find((i: InflationIndexRecord) => i.source === 'INDEC_IPC_GENERAL');
    const iccLatest = indices.find((i: InflationIndexRecord) => i.source === 'CAC_ICC_GENERAL');

    // Get schedules (with fallback if table doesn't exist)
    let schedules: ScrapeScheduleRecord[] = [];
    try {
        schedules = await prisma.scrapeSchedule?.findMany() as ScrapeScheduleRecord[] || [];
    } catch {
        console.log('[InflationCron] ScrapeSchedule table not available for status query');
    }

    return {
        ipc: ipcLatest ? {
            rate: Number(ipcLatest.rate),
            period: ipcLatest.period,
            scrapedAt: ipcLatest.scrapedAt,
        } : null,
        icc: iccLatest ? {
            rate: Number(iccLatest.rate),
            period: iccLatest.period,
            scrapedAt: iccLatest.scrapedAt,
        } : null,
        recentRecords: indices.map((i: InflationIndexRecord) => ({
            source: i.source,
            period: i.period,
            rate: Number(i.rate),
            scrapedAt: i.scrapedAt,
        })),
        schedules: schedules.map((s: ScrapeScheduleRecord) => ({
            source: s.source,
            lastScrapedPeriod: s.lastScrapedPeriod,
            nextReportDate: s.nextReportDate,
            scrapeAttempts: s.scrapeAttempts,
            isWaitingForUpdate: s.isWaitingForUpdate,
        })),
    };
}
