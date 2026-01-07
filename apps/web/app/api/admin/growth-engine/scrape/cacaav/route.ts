/**
 * CACAAV Scraper API
 * ===================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/scrape/cacaav
 * 
 * Triggers the CACAAV scraper to fetch HVAC technician profiles.
 * This is an admin-only endpoint that starts a background scraping job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCACAAVScraper } from '@/lib/scrapers/cacaav-scraper';

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
        const importData = body.import !== false; // Default to import

        console.log(`[API/CACAAV] Starting scrape, import=${importData}`);

        const scraper = getCACAAVScraper();

        // Scrape the data
        const scrapeResult = await scraper.scrape();

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
            url: 'https://cacaav.com.ar/matriculados/listado',
            region: 'Nacional',
            profession: 'HVAC/Refrigeración',
            estimatedRecords: 23000,
            dataPoints: ['Nombre', 'Celular', 'Ciudad'],
            description: 'Cámara Argentina de Calefacción, Aire Acondicionado y Ventilación - Registro nacional de técnicos matriculados',
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Error al obtener información del scraper' },
            { status: 500 }
        );
    }
}

