/**
 * Scraper Job Tracker
 * ====================
 * 
 * Tracks progress of long-running scraper jobs so they can:
 * - Resume from where they left off
 * - Report progress
 * - Track completion status per province/page
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScraperJobProgress {
    id: string;
    source: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    totalProvinces: number;
    completedProvinces: string[];
    currentProvince: string | null;
    currentPage: number;
    totalRecords: number;
    errors: string[];
    startedAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}

export interface ProvinceProgress {
    province: string;
    pagesCompleted: number;
    totalPages: number | null;
    recordsFound: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB TRACKER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ScraperJobTracker {
    private source: string;
    private jobId: string | null = null;
    private provinceProgress: Map<string, ProvinceProgress> = new Map();

    constructor(source: string) {
        this.source = source;
    }

    /**
     * Start a new scraping job
     */
    async startJob(provinces: string[]): Promise<string> {
        // Check for existing incomplete job
        const existing = await this.getIncompleteJob();
        if (existing) {
            console.log(`[JobTracker] Found existing job ${existing.id}, resuming...`);
            this.jobId = existing.id;
            return existing.id;
        }

        // Create new job
        const job = await prisma.scraperJob.create({
            data: {
                source: this.source,
                status: 'running',
                totalProvinces: provinces.length,
                completedProvinces: [],
                currentProvince: null,
                currentPage: 0,
                totalRecords: 0,
                errors: [],
                startedAt: new Date(),
            },
        });

        this.jobId = job.id;
        console.log(`[JobTracker] Started new job ${job.id} for ${this.source}`);
        return job.id;
    }

    /**
     * Get an incomplete job for this source (to resume)
     */
    async getIncompleteJob(): Promise<ScraperJobProgress | null> {
        const job = await prisma.scraperJob.findFirst({
            where: {
                source: this.source,
                status: { in: ['running', 'paused'] },
            },
            orderBy: { startedAt: 'desc' },
        });

        return job as ScraperJobProgress | null;
    }

    /**
     * Get list of provinces that still need to be scraped
     */
    async getRemainingProvinces(allProvinces: string[]): Promise<string[]> {
        if (!this.jobId) return allProvinces;

        const job = await prisma.scraperJob.findUnique({
            where: { id: this.jobId },
        });

        if (!job) return allProvinces;

        const completed = (job.completedProvinces as string[]) || [];
        return allProvinces.filter(p => !completed.includes(p));
    }

    /**
     * Get the last page scraped for a province
     */
    async getLastPageForProvince(province: string): Promise<number> {
        if (!this.jobId) return 0;

        const job = await prisma.scraperJob.findUnique({
            where: { id: this.jobId },
        });

        if (!job || job.currentProvince !== province) return 0;
        return job.currentPage || 0;
    }

    /**
     * Update progress for current province/page
     */
    async updateProgress(province: string, page: number, recordsOnPage: number): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                currentProvince: province,
                currentPage: page,
                totalRecords: { increment: recordsOnPage },
                updatedAt: new Date(),
            },
        });

        console.log(`[JobTracker] Progress: ${province} page ${page} (+${recordsOnPage} records)`);
    }

    /**
     * Mark a province as completed
     */
    async completeProvince(province: string, totalRecords: number): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                completedProvinces: { push: province },
                currentProvince: null,
                currentPage: 0,
                updatedAt: new Date(),
            },
        });

        console.log(`[JobTracker] Completed province: ${province} (${totalRecords} records)`);
    }

    /**
     * Add an error
     */
    async addError(error: string): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                errors: { push: error },
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Mark job as completed
     */
    async completeJob(totalRecords: number): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                status: 'completed',
                totalRecords,
                completedAt: new Date(),
                updatedAt: new Date(),
            },
        });

        console.log(`[JobTracker] Job ${this.jobId} completed with ${totalRecords} records`);
    }

    /**
     * Pause the job (for manual stop or errors)
     */
    async pauseJob(): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                status: 'paused',
                updatedAt: new Date(),
            },
        });

        console.log(`[JobTracker] Job ${this.jobId} paused`);
    }

    /**
     * Mark job as failed
     */
    async failJob(error: string): Promise<void> {
        if (!this.jobId) return;

        await prisma.scraperJob.update({
            where: { id: this.jobId },
            data: {
                status: 'failed',
                errors: { push: error },
                updatedAt: new Date(),
            },
        });

        console.log(`[JobTracker] Job ${this.jobId} failed: ${error}`);
    }

    /**
     * Get current job status
     */
    async getStatus(): Promise<ScraperJobProgress | null> {
        if (!this.jobId) return null;

        const job = await prisma.scraperJob.findUnique({
            where: { id: this.jobId },
        });

        return job as ScraperJobProgress | null;
    }
}

/**
 * Get all scraper jobs for a source
 */
export async function getScraperJobs(source: string): Promise<ScraperJobProgress[]> {
    const jobs = await prisma.scraperJob.findMany({
        where: { source },
        orderBy: { startedAt: 'desc' },
        take: 10,
    });

    return jobs as ScraperJobProgress[];
}

/**
 * Get the latest incomplete job for any source
 */
export async function getActiveJobs(): Promise<ScraperJobProgress[]> {
    const jobs = await prisma.scraperJob.findMany({
        where: {
            status: { in: ['running', 'paused'] },
        },
        orderBy: { startedAt: 'desc' },
    });

    return jobs as ScraperJobProgress[];
}
