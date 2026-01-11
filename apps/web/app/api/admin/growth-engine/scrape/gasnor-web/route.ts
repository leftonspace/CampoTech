/**
 * Gasnor Web Scraper API
 * =======================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/scrape/gasnor-web
 * 
 * Triggers the Gasnor web scraper to fetch gasista profiles from naturgynoa.com.ar
 * This scraper uses Playwright to extract emails from the installers page.
 * 
 * Data: Name, Matrícula, Category, Address, Phone, Cell, Email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGasnorWebScraper } from '@/lib/scrapers/gasnor-web-scraper';

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
        const provinces = body.provinces || ['JUJUY', 'SALTA', 'SANTIAGO DEL ESTERO', 'TUCUMAN'];

        console.log(`[API/Gasnor-Web] Starting Playwright scrape for ${provinces.length} provinces`);

        const scraper = getGasnorWebScraper();

        // Scrape all provinces
        const scrapeResult = await scraper.scrapeAll();

        // Import to database
        let importResult = null;
        if (importData && scrapeResult.records.length > 0) {
            importResult = await scraper.importRecords(scrapeResult.records);
        }

        console.log(`[API/Gasnor-Web] Complete: ${scrapeResult.records.length} scraped, ${importResult?.imported || 0} imported`);

        return NextResponse.json({
            success: true,
            source: 'GASNOR_WEB',
            scrape: {
                records: scrapeResult.records.length,
                provinces: scrapeResult.provinces,
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
                ? `Se importaron ${importResult.imported} perfiles nuevos de Gasnor Web (${importResult.updated} actualizados)`
                : `Se encontraron ${scrapeResult.records.length} perfiles de Gasnor Web`,
        });
    } catch (error) {
        console.error('[API/Gasnor-Web] Error:', error);
        return NextResponse.json(
            { error: 'Error al ejecutar el scraper Gasnor Web' },
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
            source: 'GASNOR_WEB',
            name: 'Gasnor/Naturgy NOA (Gasistas Web)',
            url: 'https://www.naturgynoa.com.ar/instaladores',
            region: 'Norte (Jujuy, Salta, Santiago del Estero, Tucumán)',
            profession: 'Gasista',
            estimatedRecords: 1033,
            dataPoints: ['Nombre', 'Matrícula', 'Categoría', 'Domicilio', 'Teléfono', 'Celular', 'Email'],
            description: 'Registro de instaladores de gas de Naturgy NOA (incluye emails)',
            notes: 'Usa Playwright para extraer emails del DOM',
        });
    } catch (_error) {
        return NextResponse.json(
            { error: 'Error al obtener información del scraper' },
            { status: 500 }
        );
    }
}
