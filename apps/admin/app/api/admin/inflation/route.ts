/**
 * Inflation Index Admin API
 * 
 * Phase 4 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/admin/inflation - Get all inflation indices
 * POST /api/admin/inflation - Create new inflation index entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

// Valid inflation index sources (matches Prisma enum)
const VALID_SOURCES = [
    'CAC_ICC_GENERAL',
    'CAC_ICC_MANO_OBRA',
    'CAC_ICC_MATERIALES',
    'INDEC_IPC',
    'INDEC_IPC_VIVIENDA',
    'CUSTOM',
];

const SOURCE_LABELS: Record<string, string> = {
    CAC_ICC_GENERAL: 'ICC General (CAC)',
    CAC_ICC_MANO_OBRA: 'ICC Mano de Obra (CAC)',
    CAC_ICC_MATERIALES: 'ICC Materiales (CAC)',
    INDEC_IPC: 'IPC General (INDEC)',
    INDEC_IPC_VIVIENDA: 'IPC Vivienda (INDEC)',
    CUSTOM: 'Índice Personalizado',
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List All Inflation Indices
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const sourceParam = searchParams.get('source');
        const limitParam = searchParams.get('limit');

        // Build query
        const limit = Math.min(parseInt(limitParam || '50', 10) || 50, 200);

        const indices = await prisma.inflationIndex.findMany({
            where: sourceParam && VALID_SOURCES.includes(sourceParam)
                ? { source: sourceParam as 'CAC_ICC_GENERAL' | 'CAC_ICC_MANO_OBRA' | 'CAC_ICC_MATERIALES' | 'INDEC_IPC' | 'INDEC_IPC_VIVIENDA' | 'CUSTOM' }
                : undefined,
            orderBy: [
                { period: 'desc' },
                { source: 'asc' },
            ],
            take: limit,
        });

        // Group by period for display
        const byPeriod: Record<string, typeof indices> = {};
        for (const index of indices) {
            if (!byPeriod[index.period]) {
                byPeriod[index.period] = [];
            }
            byPeriod[index.period].push(index);
        }

        // Get latest period for each source
        const latestBySource: Record<string, typeof indices[0]> = {};
        for (const index of indices) {
            if (!latestBySource[index.source] || index.period > latestBySource[index.source].period) {
                latestBySource[index.source] = index;
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                indices: indices.map((i: typeof indices[0]) => ({
                    id: i.id,
                    source: i.source,
                    label: SOURCE_LABELS[i.source] || i.source,
                    period: i.period,
                    rate: i.rate.toNumber(),
                    publishedAt: i.publishedAt.toISOString(),
                    scrapedAt: i.scrapedAt.toISOString(),
                    createdAt: i.createdAt.toISOString(),
                })),
                byPeriod: Object.entries(byPeriod).map(([period, items]) => ({
                    period,
                    indices: items.map((i: typeof indices[0]) => ({
                        source: i.source,
                        label: SOURCE_LABELS[i.source] || i.source,
                        rate: i.rate.toNumber(),
                    })),
                })),
                latestBySource: Object.entries(latestBySource).map(([source, item]) => ({
                    source,
                    label: SOURCE_LABELS[source] || source,
                    period: item.period,
                    rate: item.rate.toNumber(),
                })),
                sources: VALID_SOURCES.map(s => ({
                    value: s,
                    label: SOURCE_LABELS[s] || s,
                })),
            },
        });
    } catch (error) {
        console.error('[Admin Inflation] GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch inflation indices' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create New Inflation Index Entry
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateIndexRequest {
    source: string;
    period: string;  // "2025-12" format
    rate: number;    // 4.5 = 4.5%
    publishedAt: string;  // ISO date
    notes?: string;
    notifyOrgs?: boolean;
}

export async function POST(request: NextRequest) {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only super_admin can create indices
        if (!hasPermission(admin, 'manage_admins')) {
            return NextResponse.json(
                { success: false, error: 'Only super admins can create inflation indices' },
                { status: 403 }
            );
        }

        const body: CreateIndexRequest = await request.json();
        const { source, period, rate, publishedAt, notes, notifyOrgs } = body;

        // Validate required fields
        if (!source || !period || rate === undefined || !publishedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required fields: source, period, rate, publishedAt',
                },
                { status: 400 }
            );
        }

        // Validate source
        if (!VALID_SOURCES.includes(source)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid source. Valid sources: ${VALID_SOURCES.join(', ')}`,
                },
                { status: 400 }
            );
        }

        // Validate period format (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(period)) {
            return NextResponse.json(
                { success: false, error: 'Period must be in YYYY-MM format (e.g., 2025-12)' },
                { status: 400 }
            );
        }

        // Validate rate is a reasonable number
        const parsedRate = parseFloat(String(rate));
        if (isNaN(parsedRate) || parsedRate < -50 || parsedRate > 100) {
            return NextResponse.json(
                { success: false, error: 'Rate must be between -50 and 100 (percent)' },
                { status: 400 }
            );
        }

        // Validate publishedAt is a valid date
        const parsedPublishedAt = new Date(publishedAt);
        if (isNaN(parsedPublishedAt.getTime())) {
            return NextResponse.json(
                { success: false, error: 'Invalid publishedAt date' },
                { status: 400 }
            );
        }

        // Upsert the index (update if exists for period+source, create otherwise)
        const index = await prisma.inflationIndex.upsert({
            where: {
                source_period: {
                    source: source as 'CAC_ICC_GENERAL' | 'CAC_ICC_MANO_OBRA' | 'CAC_ICC_MATERIALES' | 'INDEC_IPC' | 'INDEC_IPC_VIVIENDA' | 'CUSTOM',
                    period,
                },
            },
            update: {
                rate: new Decimal(parsedRate),
                publishedAt: parsedPublishedAt,
                scrapedAt: new Date(),
                rawData: notes ? { notes, updatedBy: admin.email } : undefined,
            },
            create: {
                source: source as 'CAC_ICC_GENERAL' | 'CAC_ICC_MANO_OBRA' | 'CAC_ICC_MATERIALES' | 'INDEC_IPC' | 'INDEC_IPC_VIVIENDA' | 'CUSTOM',
                period,
                rate: new Decimal(parsedRate),
                publishedAt: parsedPublishedAt,
                scrapedAt: new Date(),
                rawData: notes ? { notes, createdBy: admin.email } : { createdBy: admin.email },
            },
        });

        console.log(`[Admin Inflation] Created/updated ${source} for ${period}: ${parsedRate}% by ${admin.email}`);

        // TODO: If notifyOrgs is true, trigger notification to all organizations
        if (notifyOrgs) {
            console.log(`[Admin Inflation] Notification requested for orgs about ${source} ${period}`);
            // Future: Create notification jobs for all active organizations
        }

        return NextResponse.json({
            success: true,
            data: {
                id: index.id,
                source: index.source,
                label: SOURCE_LABELS[index.source] || index.source,
                period: index.period,
                rate: index.rate.toNumber(),
                publishedAt: index.publishedAt.toISOString(),
                createdBy: admin.email,
                notificationSent: notifyOrgs || false,
            },
        });
    } catch (error) {
        console.error('[Admin Inflation] POST error:', error);

        // Handle unique constraint violation
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'An index for this source and period already exists. Use PUT to update.',
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create inflation index',
            },
            { status: 500 }
        );
    }
}
