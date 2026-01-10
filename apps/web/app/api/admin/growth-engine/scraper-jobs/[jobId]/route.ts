/**
 * Scraper Job Status API
 * =======================
 * 
 * GET /api/admin/growth-engine/scraper-jobs/[jobId]
 * Returns real-time status of a specific scraper job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Acceso no autorizado' },
                { status: 403 }
            );
        }

        const { jobId } = await params;

        const job = await prisma.scraperJob.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Calculate progress percentage
        const completedCount = (job.completedProvinces as string[])?.length || 0;
        const totalCount = job.totalProvinces || 1;
        const progressPercent = Math.round((completedCount / totalCount) * 100);

        return NextResponse.json({
            id: job.id,
            source: job.source,
            status: job.status,
            progress: {
                completedProvinces: job.completedProvinces,
                totalProvinces: job.totalProvinces,
                currentProvince: job.currentProvince,
                currentPage: job.currentPage,
                totalRecords: job.totalRecords,
                percent: progressPercent,
            },
            errors: job.errors,
            startedAt: job.startedAt,
            updatedAt: job.updatedAt,
            completedAt: job.completedAt,
        });
    } catch (error) {
        console.error('[API/ScraperJob] Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener el estado del job' },
            { status: 500 }
        );
    }
}
