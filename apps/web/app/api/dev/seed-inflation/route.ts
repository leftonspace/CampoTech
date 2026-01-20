/**
 * Seed Inflation Indices API (Development Only)
 * 
 * GET/POST /api/dev/seed-inflation - Seeds test inflation indices
 * 
 * WARNING: This should only be enabled in development!
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

// GET handler - allows visiting URL directly in browser
export async function GET(_request: NextRequest) {
    return seedInflationIndices();
}

export async function POST(_request: NextRequest) {
    return seedInflationIndices();
}

async function seedInflationIndices() {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            { success: false, error: 'Only available in development' },
            { status: 403 }
        );
    }

    try {
        console.log('[Dev Seed] Seeding inflation indices...');

        const now = new Date();
        const created: string[] = [];

        // Generate indices for the last 6 months
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            // CAC ICC General
            await prisma.inflationIndex.upsert({
                where: {
                    source_period: {
                        source: 'CAC_ICC_GENERAL',
                        period,
                    },
                },
                update: {
                    rate: new Decimal(4 + Math.random() * 3),
                    scrapedAt: new Date(),
                },
                create: {
                    source: 'CAC_ICC_GENERAL',
                    period,
                    rate: new Decimal(4 + Math.random() * 3),
                    publishedAt: new Date(date.getFullYear(), date.getMonth() + 1, 10),
                    scrapedAt: new Date(),
                },
            });
            created.push(`CAC_ICC_GENERAL ${period}`);

            // INDEC IPC General
            await prisma.inflationIndex.upsert({
                where: {
                    source_period: {
                        source: 'INDEC_IPC_GENERAL',
                        period,
                    },
                },
                update: {
                    rate: new Decimal(3.5 + Math.random() * 2.5),
                    scrapedAt: new Date(),
                },
                create: {
                    source: 'INDEC_IPC_GENERAL',
                    period,
                    rate: new Decimal(3.5 + Math.random() * 2.5),
                    publishedAt: new Date(date.getFullYear(), date.getMonth() + 1, 15),
                    scrapedAt: new Date(),
                },
            });
            created.push(`INDEC_IPC_GENERAL ${period}`);
        }

        console.log('[Dev Seed] Created indices:', created);

        return NextResponse.json({
            success: true,
            data: {
                message: 'Inflation indices seeded successfully',
                created,
            },
        });
    } catch (error) {
        console.error('[Dev Seed] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
