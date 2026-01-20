/**
 * Inflation Index Cron Jobs
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Handles scheduled scraping of inflation indices from INDEC:
 * - IPC (Índice de Precios al Consumidor) - Consumer prices
 * - ICC (Índice del Costo de la Construcción) - Construction costs
 * 
 * Schedule Strategy:
 * - Run daily at 10:00 AM Buenos Aires time
 * - Only actually scrape when we know a new report is due (based on nextReportDate)
 * - On report days, retry up to 3 times if initial scrape fails
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
}

export interface ScheduledScrapeConfig {
    source: 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL';
    nextScrapeDate: Date | null;
    lastScrapedAt: Date | null;
    lastPeriod: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current scrape schedule from the database.
 * Returns the most recent record for each source.
 */
export async function getScrapeSchedule(): Promise<ScheduledScrapeConfig[]> {
    const sources = ['INDEC_IPC_GENERAL', 'CAC_ICC_GENERAL'] as const;
    const configs: ScheduledScrapeConfig[] = [];

    for (const source of sources) {
        const latest = await prisma.inflationIndex.findFirst({
            where: { source },
            orderBy: { period: 'desc' },
        });

        configs.push({
            source,
            // For now, we don't store nextScrapeDate in DB - we get it from scraping
            nextScrapeDate: null,
            lastScrapedAt: latest?.scrapedAt || null,
            lastPeriod: latest?.period || null,
        });
    }

    return configs;
}

/**
 * Check if we should scrape today based on:
 * 1. Never scraped before
 * 2. Last scrape was more than 12 hours ago
 * 3. It's the expected report date
 */
export function shouldScrapeToday(config: ScheduledScrapeConfig): boolean {
    // Never scraped - definitely scrape
    if (!config.lastScrapedAt) {
        return true;
    }

    const now = new Date();
    const hoursSinceLastScrape = (now.getTime() - config.lastScrapedAt.getTime()) / (1000 * 60 * 60);

    // If last scrape was more than 12 hours ago, try again
    if (hoursSinceLastScrape > 12) {
        return true;
    }

    // If we have a scheduled date and it's today or past, scrape
    if (config.nextScrapeDate) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const scheduleDay = new Date(
            config.nextScrapeDate.getFullYear(),
            config.nextScrapeDate.getMonth(),
            config.nextScrapeDate.getDate()
        );

        if (scheduleDay <= today) {
            return true;
        }
    }

    return false;
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

    try {
        // Get current schedule
        const schedules = await getScrapeSchedule();

        // Check if any source needs scraping
        const needsScraping = schedules.some(s => shouldScrapeToday(s));

        if (!needsScraping) {
            console.log('[InflationCron] No scraping needed today');
            return {
                success: true,
                scraped: false,
                reason: 'No sources need scraping today',
                durationMs: Date.now() - startTime,
            };
        }

        console.log('[InflationCron] Scraping is due, running unified scraper...');

        // Run the unified scraper
        const scraper = getIndecUnifiedScraper();
        const result = await scraper.scrapeAndSave();

        // Close browser to free resources
        await scraper.closeBrowser();

        if (!result.success) {
            console.error('[InflationCron] Scrape failed:', result.error);
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
        const scraper = getIndecUnifiedScraper();
        const result = await scraper.scrapeAndSave();
        await scraper.closeBrowser();

        return {
            success: result.success,
            scraped: true,
            reason: result.success ? 'Force scrape succeeded' : 'Force scrape failed',
            data: result,
            error: result.error,
            durationMs: Date.now() - startTime,
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
 * Get the current status of inflation indices.
 */
export async function getInflationIndexStatus() {
    const indices = await prisma.inflationIndex.findMany({
        orderBy: { period: 'desc' },
        take: 10,
    }) as InflationIndexRecord[];

    const ipcLatest = indices.find((i: InflationIndexRecord) => i.source === 'INDEC_IPC_GENERAL');
    const iccLatest = indices.find((i: InflationIndexRecord) => i.source === 'CAC_ICC_GENERAL');

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
    };
}
