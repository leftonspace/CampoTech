/**
 * Dev API: Scrape INDEC IPC
 * 
 * Development-only endpoint to test the INDEC scraper.
 * GET /api/dev/scrape-indec - Scrapes and saves the latest INDEC IPC rate
 * 
 * Query params:
 * - save=false: Don't save to database
 * - debug=true: Return HTML snippets for debugging
 * - playwright=true: Use Playwright scraper (handles JS)
 */

import { NextResponse } from 'next/server';
import { scrapeAndSaveIndecIpc, scrapeIndecIpc } from '@/lib/scrapers/indec-ipc-scraper';
import { getIndecScraper } from '@/lib/scrapers/indec-playwright-scraper';

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
    const debug = url.searchParams.get('debug') === 'true';

    // Debug mode: fetch and return snippets of the HTML
    if (debug) {
        try {
            const response = await fetch('https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            const html = await response.text();

            // Find relevant snippets
            const snippets: string[] = [];
            const keywords = ['variaci', 'Próximo', 'diciembre', 'enero', '2,8', '2.8', '%'];

            for (const keyword of keywords) {
                const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
                if (idx !== -1) {
                    snippets.push(`[${keyword}]: ...${html.substring(Math.max(0, idx - 50), idx + 100)}...`);
                }
            }

            return NextResponse.json({
                htmlLength: html.length,
                snippets,
                first500: html.substring(0, 500),
            });
        } catch (error) {
            return NextResponse.json({ error: String(error) }, { status: 500 });
        }
    }

    // Check if using Playwright scraper
    const usePlaywright = url.searchParams.get('playwright') === 'true';

    try {
        console.log('[Dev API] Scraping INDEC IPC...', { saveToDb, usePlaywright });

        let result;

        if (usePlaywright) {
            // Use Playwright scraper (handles JavaScript)
            const scraper = getIndecScraper();
            result = saveToDb
                ? await scraper.scrapeAndSave()
                : await scraper.scrape();
        } else {
            // Use simple fetch scraper
            result = saveToDb
                ? await scrapeAndSaveIndecIpc()
                : await scrapeIndecIpc();
        }

        return NextResponse.json({
            success: result.success,
            data: result.data,
            error: result.error,
            savedToDatabase: saveToDb && result.success,
            debug: result.debug,
            method: usePlaywright ? 'playwright' : 'fetch',
        });

    } catch (error) {
        console.error('[Dev API] Error scraping INDEC:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
