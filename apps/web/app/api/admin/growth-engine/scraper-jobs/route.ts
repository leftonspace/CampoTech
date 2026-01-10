/**
 * Scraper Jobs API
 * =================
 * 
 * GET /api/admin/growth-engine/scraper-jobs
 * Returns status of all scraper jobs
 * 
 * GET /api/admin/growth-engine/scraper-jobs/[source]
 * Returns jobs for a specific source
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveJobs, getScraperJobs } from '@/lib/scrapers/job-tracker';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Acceso no autorizado' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const source = searchParams.get('source');

        if (source) {
            // Get jobs for specific source
            const jobs = await getScraperJobs(source);
            return NextResponse.json({
                source,
                jobs,
                count: jobs.length,
            });
        }

        // Get all active jobs
        const activeJobs = await getActiveJobs();

        return NextResponse.json({
            activeJobs,
            count: activeJobs.length,
            message: activeJobs.length > 0
                ? `${activeJobs.length} trabajos de scraping activos`
                : 'No hay trabajos de scraping activos',
        });
    } catch (error) {
        console.error('[API/ScraperJobs] Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener los trabajos de scraping' },
            { status: 500 }
        );
    }
}
