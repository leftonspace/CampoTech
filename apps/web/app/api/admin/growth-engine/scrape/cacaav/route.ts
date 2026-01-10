/**
 * CACAAV Scraper API
 * ===================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/scrape/cacaav
 * 
 * Triggers the CACAAV Playwright scraper to fetch HVAC technician profiles.
 * Uses Playwright to handle pagination and dynamic province filtering.
 * ~23,000 records across ~1,150 pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCACAAVPlaywrightScraper } from '@/lib/scrapers/cacaav-playwright-scraper';

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
        const importData = body.import !== false;
        const provinces = body.provinces; // Optional: filter by specific provinces
        const testMode = body.testMode === true; // Just scrape first page
        const maxPages = body.maxPages || 5; // Default to 5 pages per province for quick runs

        console.log(`[API/CACAAV] Starting Playwright scrape, import=${importData}, testMode=${testMode}, maxPages=${maxPages}`);

        const scraper = getCACAAVPlaywrightScraper();

        // Scrape the data
        let scrapeResult;
        if (testMode) {
            scrapeResult = await scraper.scrapeFirstPage();
        } else if (maxPages) {
            scrapeResult = await scraper.scrapePages(maxPages, provinces);
        } else {
            scrapeResult = await scraper.scrapeAll(provinces);
        }


        // Optionally import to database
        let importResult = null;
        if (importData && scrapeResult.records.length > 0) {
            importResult = await scraper.importRecords(scrapeResult.records);
        }

        console.log(`[API/CACAAV] Complete: ${scrapeResult.records.length} scraped, ${importResult?.imported || 0} imported`);

        return NextResponse.json({
            success: true,
            source: 'CACAAV',
            scrape: {
                records: scrapeResult.records.length,
                pages: scrapeResult.pages,
                errors: scrapeResult.errors.length,
                errorDetails: scrapeResult.errors.slice(0, 10),
            },
            import: importResult ? {
                imported: importResult.imported,
                updated: importResult.updated,
                errors: importResult.errors,
                total: importResult.total,
            } : null,
            message: importResult
                ? `Se importaron ${importResult.imported} perfiles nuevos de CACAAV (${importResult.updated} actualizados)`
                : `Se encontraron ${scrapeResult.records.length} perfiles de CACAAV`,
        });
    } catch (error) {
        console.error('[API/CACAAV] Error:', error);
        return NextResponse.json(
            { error: 'Error al ejecutar el scraper CACAAV' },
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
            source: 'CACAAV',
            name: 'CACAAV Nacional (HVAC/Refrigeración)',
            url: 'https://www.cacaav.com.ar/matriculados/listado',
            region: 'Nacional (24 provincias)',
            profession: 'HVAC/Refrigeración',
            estimatedRecords: 23000,
            dataPoints: ['Nombre', 'Teléfono', 'Email', 'Categoría', 'Ubicación', 'Vencimiento'],
            description: 'Cámara Argentina de Calefacción, Aire Acondicionado y Ventilación - Registro nacional de técnicos matriculados',
            notes: 'Usa Playwright para manejar paginación (~1,150 páginas). Puede filtrar por provincia.',
            options: {
                testMode: 'Solo primera página (para testing)',
                provinces: 'Array de provincias a scrapear (default: todas)',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Error al obtener información del scraper' },
            { status: 500 }
        );
    }
}

