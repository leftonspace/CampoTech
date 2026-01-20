/**
 * Dev API: Clean up fake inflation data
 * 
 * DELETE /api/dev/cleanup-inflation-seeds
 * 
 * Removes fake seeded inflation data that has future/unreleased periods
 * and keeps only real scraped data.
 * 
 * The real INDEC reports are:
 * - IPC December 2025 (2.8%) - already released
 * - ICC November 2025 (2.5%) - already released
 * - ICC December 2025 - releases Jan 19, 2026
 * - IPC January 2026 - releases Feb 10, 2026
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Type for inflation index records returned from Prisma
interface InflationIndexRecord {
    id: string;
    source: string;
    period: string;
    rate: Decimal;
    publishedAt: Date;
    scrapedAt: Date;
    rawData?: unknown;
    createdAt: Date;
}

export async function DELETE() {
    try {
        // The last PUBLISHED periods from INDEC as of Jan 18, 2026:
        // - IPC: December 2025 (published Jan 13, 2026)
        // - ICC: November 2025 (next report Jan 19, 2026)

        // Any period >= 2026-01 is UNRELEASED/FAKE seeded data
        // We also want to clean up fake December 2025 ICC data if rate doesn't match real scraped

        console.log('[Dev API] Cleaning up fake inflation data...');

        // Delete all 2026-01 records (these are seeded because real data isn't available yet)
        const deleted2026 = await prisma.inflationIndex.deleteMany({
            where: {
                period: '2026-01',
            },
        });

        // Also delete fake 2025-12 ICC records (real ICC for Dec 2025 not released until Jan 19)
        // Keep only records with rate = 2.5 for CAC_ICC_GENERAL 2025-11 (real scraped)
        const deletedFakeICC = await prisma.inflationIndex.deleteMany({
            where: {
                source: 'CAC_ICC_GENERAL',
                period: '2025-12',
            },
        });

        const totalDeleted = deleted2026.count + deletedFakeICC.count;
        console.log(`[Dev API] Deleted ${totalDeleted} fake records (${deleted2026.count} from 2026-01, ${deletedFakeICC.count} fake ICC Dec)`);

        // Get remaining records
        const remaining = await prisma.inflationIndex.findMany({
            orderBy: { period: 'desc' },
            take: 10,
        });

        return NextResponse.json({
            success: true,
            deleted: totalDeleted,
            message: `Removed ${totalDeleted} fake inflation records`,
            breakdown: {
                '2026-01': deleted2026.count,
                'fake_icc_dec': deletedFakeICC.count,
            },
            remaining: remaining.map((r: InflationIndexRecord) => ({
                source: r.source,
                period: r.period,
                rate: Number(r.rate),
                scrapedAt: r.scrapedAt,
            })),
        });

    } catch (error) {
        console.error('[Dev API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Show what would be cleaned up
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const fakeRecords = await prisma.inflationIndex.findMany({
        where: {
            period: {
                gt: currentPeriod,
            },
        },
        orderBy: { period: 'desc' },
    });

    const realRecords = await prisma.inflationIndex.findMany({
        where: {
            period: {
                lte: currentPeriod,
            },
        },
        orderBy: { period: 'desc' },
        take: 10,
    });

    return NextResponse.json({
        success: true,
        currentPeriod,
        fakeRecords: fakeRecords.map((r: InflationIndexRecord) => ({
            source: r.source,
            period: r.period,
            rate: Number(r.rate),
        })),
        realRecords: realRecords.map((r: InflationIndexRecord) => ({
            source: r.source,
            period: r.period,
            rate: Number(r.rate),
        })),
        message: `Found ${fakeRecords.length} fake records to delete. Use DELETE method to clean up.`,
    });
}
