/**
 * ERSEP Scraper API
 * ==================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/scrape/ersep
 * 
 * Triggers the ERSEP scraper to fetch electricista profiles from ersep.cba.gov.ar
 * This is an admin-only endpoint that starts a background scraping job.
 * 
 * IMPORTANT: Requires Argentina VPN to access!
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getERSEPPlaywrightScraper } from '@/lib/scrapers/ersep-playwright-scraper';

export async function POST(request: NextRequest) {
    try {
        // Auth check - SUPER_ADMIN only (platform admin, not org owner)
        const session = await getSession();
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const importData = body.import !== false; // Default to import

        console.log(`[API/ERSEP] Starting Playwright scrape, import=${importData}`);

        const scraper = getERSEPPlaywrightScraper();

        // Check access first (requires Argentina VPN)
        const accessCheck = await scraper.checkAccess();
        if (!accessCheck.accessible) {
            return NextResponse.json({
                success: false,
                source: 'ERSEP',
                error: accessCheck.message,
                message: '⚠️ ERSEP requiere VPN de Argentina para acceder. Por favor, conectá un VPN argentino y volvé a intentar.',
            }, { status: 403 });
        }

        // Scrape the data
        const scrapeResult = await scraper.scrapeAll();

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
                errorDetails: scrapeResult.errors.slice(0, 10),
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
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            source: 'ERSEP',
            name: 'ERSEP Córdoba (Electricistas)',
            url: 'https://ersep.cba.gov.ar/registros-de-electricistas/',
            region: 'Córdoba',
            profession: 'Electricista',
            estimatedRecords: 33000,
            dataPoints: ['Nombre', 'Teléfono', 'Email', 'CUIL', 'Categoría', 'Matrícula'],
            description: 'Registro público de electricistas matriculados en la provincia de Córdoba',
            requirements: '⚠️ Requiere VPN de Argentina para acceder',
        });
    } catch (_error) {
        return NextResponse.json(
            { error: 'Error al obtener información del scraper' },
            { status: 500 }
        );
    }
}

