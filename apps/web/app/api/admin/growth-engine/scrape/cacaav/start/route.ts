/**
 * CACAAV Async Scraper API
 * =========================
 * 
 * POST /api/admin/growth-engine/scrape/cacaav/start
 * Starts a CACAAV scraping job in the background and returns job ID immediately.
 * Use the job status API to poll for progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCACAAVPlaywrightScraper } from '@/lib/scrapers/cacaav-playwright-scraper';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const provinces = body.provinces;
        const maxPages = body.maxPages || 5;
        const importData = body.import !== false;

        // Check for existing running job
        const existingJob = await prisma.scraperJob.findFirst({
            where: {
                source: 'CACAAV',
                status: { in: ['pending', 'running'] },
            },
        });

        if (existingJob) {
            return NextResponse.json({
                success: true,
                jobId: existingJob.id,
                status: existingJob.status,
                message: 'Ya hay un trabajo en progreso. Se continuará desde donde quedó.',
                resuming: true,
            });
        }

        // Create a new job record
        const provinceList = provinces || [
            'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
            'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
            'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
            'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
            'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
        ];


        const job = await prisma.scraperJob.create({
            data: {
                source: 'CACAAV',
                status: 'running',
                totalProvinces: provinceList.length,
                completedProvinces: [],
                currentProvince: null,
                currentPage: 0,
                totalRecords: 0,
                errors: [],
            },
        });

        console.log(`[API/CACAAV] Started job ${job.id} for ${provinceList.length} provinces, maxPages=${maxPages}`);

        // Start scraping in background (don't await)
        runScrapingJob(job.id, provinceList, maxPages, importData).catch(err => {
            console.error(`[API/CACAAV] Background job ${job.id} failed:`, err);
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            status: 'running',
            message: `Iniciando scraping de ${provinceList.length} provincias...`,
            pollUrl: `/api/admin/growth-engine/scraper-jobs/${job.id}`,
        });
    } catch (error) {
        console.error('[API/CACAAV/start] Error:', error);
        return NextResponse.json(
            { error: 'Error al iniciar el scraper CACAAV' },
            { status: 500 }
        );
    }
}

/**
 * Background scraping function
 */
async function runScrapingJob(
    jobId: string,
    provinces: string[],
    maxPages: number,
    importData: boolean
) {
    const scraper = getCACAAVPlaywrightScraper();
    scraper.setMaxPages(maxPages);

    let totalRecords = 0;

    for (const province of provinces) {
        try {
            // Update current province
            await prisma.scraperJob.update({
                where: { id: jobId },
                data: {
                    currentProvince: province,
                    currentPage: 0,
                },
            });

            console.log(`[CACAAV Job ${jobId}] Scraping province: ${province}`);

            // Scrape the province
            const records = await scraper.scrapeProvince(province);
            totalRecords += records.length;

            // Import if requested
            if (importData && records.length > 0) {
                await scraper.importRecords(records);
            }

            // Mark province completed
            await prisma.scraperJob.update({
                where: { id: jobId },
                data: {
                    completedProvinces: { push: province },
                    currentProvince: null,
                    totalRecords: totalRecords,
                },
            });

            console.log(`[CACAAV Job ${jobId}] Completed ${province}: ${records.length} records`);

            // Rate limiting between provinces
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            const errorMsg = `${province}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[CACAAV Job ${jobId}] Error:`, errorMsg);

            await prisma.scraperJob.update({
                where: { id: jobId },
                data: {
                    errors: { push: errorMsg },
                },
            });
        }
    }

    // Mark job as completed
    await prisma.scraperJob.update({
        where: { id: jobId },
        data: {
            status: 'completed',
            currentProvince: null,
            totalRecords: totalRecords,
            completedAt: new Date(),
        },
    });

    await scraper.closeBrowser();
    console.log(`[CACAAV Job ${jobId}] Completed: ${totalRecords} total records`);
}
