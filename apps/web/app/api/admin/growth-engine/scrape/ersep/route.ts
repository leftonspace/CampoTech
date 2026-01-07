/**
 * ERSEP Scraper API
 * ==================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/scrape/ersep
 * 
 * Triggers the ERSEP scraper to fetch electricista profiles from volta.net.ar
 * This is an admin-only endpoint that starts a background scraping job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getERSEPScraper } from '@/lib/scrapers/ersep-scraper';

export async function POST(request: NextRequest) {
    try {
        // Auth check - admin only
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Acceso no autorizado' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const maxPages = Math.min(body.maxPages || 10, 100); // Default 10 pages, max 100
        const importData = body.import !== false; // Default to import

        console.log(`[API/ERSEP] Starting scrape with maxPages=${maxPages}, import=${importData}`);

        const scraper = getERSEPScraper();

        // Scrape the data
        const scrapeResult = await scraper.scrapeAll(maxPages);

        // Optionally import to database
        let importResult = null;
        if (importData && scrapeResult.records.length > 0) {
            importResult = await scraper.importRecords(scrapeResult.records);
        }

        console.log(`[API/ERSEP] Complete: ${scrapeResult.records.length} scraped, ${importResult?.imported || 0} imported`);

        return NextResponse.json({
            success: true,
            source: 'ERSEP',
            scrape: {
                records: scrapeResult.records.length,
                pages: scrapeResult.pages,
                errors: scrapeResult.errors.length,
                errorDetails: scrapeResult.errors.slice(0, 10), // First 10 errors
            },
            import: importResult ? {
                imported: importResult.imported,
                updated: importResult.updated,
                errors: importResult.errors,
                total: importResult.total,
            } : null,
            message: importResult
                ? `Se importaron ${importResult.imported} perfiles nuevos de ERSEP (${importResult.updated} actualizados)`
                : `Se encontraron ${scrapeResult.records.length} perfiles de ERSEP`,
        });
    } catch (error) {
        console.error('[API/ERSEP] Error:', error);
        return NextResponse.json(
            { error: 'Error al ejecutar el scraper ERSEP' },
            { status: 500 }
        );
    }
}

// Get scraper status/info
export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Acceso no autorizado' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            source: 'ERSEP',
            name: 'ERSEP Córdoba (Electricistas)',
            url: 'https://volta.net.ar/matriculados',
            region: 'Córdoba',
            profession: 'Electricista',
            estimatedRecords: 33000,
            dataPoints: ['Nombre', 'Teléfono', 'Email', 'Categoría', 'Matrícula'],
            description: 'Registro público de electricistas matriculados en la provincia de Córdoba',
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Error al obtener información del scraper' },
            { status: 500 }
        );
    }
}

