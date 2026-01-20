/**
 * Dev API: Scrape INDEC Unified (IPC + ICC)
 * 
 * Scrapes both IPC and ICC from the INDEC Precios overview page.
 * 
 * GET /api/dev/scrape-indec-unified
 * - save=false: Don't save to database
 * - full=true: Also fetch next report dates
 */

import { NextResponse } from 'next/server';
import { getIndecUnifiedScraper } from '@/lib/scrapers/indec-unified-scraper';

export async function GET(request: Request) {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            { success: false, error: 'This endpoint is only available in development' },
            { status: 403 }
        );
    }

    const url = new URL(request.url);
    const saveToDb = url.searchParams.get('save') !== 'false';
    const fullScrape = url.searchParams.get('full') === 'true';

    try {
        console.log('[Dev API] Scraping INDEC Unified...', { saveToDb, fullScrape });

        const scraper = getIndecUnifiedScraper();

        let result;
        if (saveToDb) {
            result = await scraper.scrapeAndSave();
        } else if (fullScrape) {
            result = await scraper.scrapeAll();
        } else {
            result = await scraper.scrapeOverview();
        }

        return NextResponse.json({
            success: result.success,
            ipc: result.ipc,
            icc: result.icc,
            nextReportDates: result.nextReportDates,
            error: result.error,
            savedToDatabase: saveToDb && result.success,
            debug: result.debug,
        });

    } catch (error) {
        console.error('[Dev API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
