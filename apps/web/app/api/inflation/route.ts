/**
 * Inflation Index API (User-facing)
 * 
 * Phase 4 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/inflation - Get latest inflation indices for adjustment UI
 * 
 * This is read-only for organization users. Writing is done via apps/admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Valid inflation index sources
const VALID_SOURCES = [
    'CAC_ICC_GENERAL',
    'CAC_ICC_MANO_OBRA',
    'CAC_ICC_MATERIALES',
    'INDEC_IPC',
    'INDEC_IPC_GENERAL',      // From unified scraper
    'INDEC_IPC_VIVIENDA',
    'CUSTOM',
] as const;

const SOURCE_LABELS: Record<string, string> = {
    CAC_ICC_GENERAL: 'ICC General (CAC)',
    CAC_ICC_MANO_OBRA: 'ICC Mano de Obra (CAC)',
    CAC_ICC_MATERIALES: 'ICC Materiales (CAC)',
    INDEC_IPC: 'IPC General (INDEC)',
    INDEC_IPC_GENERAL: 'IPC General (INDEC)',      // Scraped version
    INDEC_IPC_VIVIENDA: 'IPC Vivienda (INDEC)',
    CUSTOM: 'Índice Personalizado',
};

const SOURCE_RECOMMENDATIONS: Record<string, string> = {
    CAC_ICC_GENERAL: 'Recomendado para servicios de construcción en general',
    CAC_ICC_MANO_OBRA: 'Ideal si tu principal costo es mano de obra',
    CAC_ICC_MATERIALES: 'Para negocios con alto componente de materiales',
    INDEC_IPC: 'Inflación general del país',
    INDEC_IPC_GENERAL: 'Inflación general del país (datos oficiales INDEC)',
    INDEC_IPC_VIVIENDA: 'Para gastos relacionados al hogar',
    CUSTOM: 'Define tu propio porcentaje de ajuste',
};

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const sourceParam = searchParams.get('source');
        const periodsParam = searchParams.get('periods');

        // Number of periods to return (default 6 months)
        const periods = Math.min(parseInt(periodsParam || '6', 10) || 6, 24);

        // Get all recent indices grouped by period
        const recentIndices = await prisma.inflationIndex.findMany({
            where: sourceParam && VALID_SOURCES.includes(sourceParam as typeof VALID_SOURCES[number])
                ? { source: sourceParam as typeof VALID_SOURCES[number] }
                : undefined,
            orderBy: { period: 'desc' },
            take: periods * 6, // 6 possible sources per period
        });

        // Get latest index for each source
        const latestBySource: Record<string, typeof recentIndices[0]> = {};
        for (const index of recentIndices) {
            if (!latestBySource[index.source]) {
                latestBySource[index.source] = index;
            }
        }

        // Group by period for history view
        const byPeriod: Record<string, typeof recentIndices> = {};
        for (const index of recentIndices) {
            if (!byPeriod[index.period]) {
                byPeriod[index.period] = [];
            }
            byPeriod[index.period].push(index);
        }

        // Get user's org pricing settings
        const orgSettings = await prisma.organizationPricingSettings.findUnique({
            where: { organizationId: session.organizationId },
            select: {
                inflationIndexSource: true,
                autoInflationAdjust: true,
                inflationExtraPercent: true,
                lastInflationCheck: true,
            },
        });

        // Calculate available updates (indices newer than last check)
        const lastCheck = orgSettings?.lastInflationCheck;
        const availableUpdates = lastCheck
            ? Object.values(latestBySource).filter(i => i.createdAt > lastCheck).length
            : Object.values(latestBySource).length;

        // Format response
        const formattedLatest = Object.entries(latestBySource).map(([source, index]) => ({
            source,
            label: SOURCE_LABELS[source] || source,
            recommendation: SOURCE_RECOMMENDATIONS[source] || '',
            period: index.period,
            rate: index.rate.toNumber(),
            publishedAt: index.publishedAt.toISOString(),
            isRecommended: source === 'CAC_ICC_GENERAL', // Default recommendation
        }));

        const formattedHistory = Object.entries(byPeriod)
            .map(([period, indices]) => ({
                period,
                periodLabel: formatPeriod(period),
                indices: indices.map((i: typeof recentIndices[0]) => ({
                    source: i.source,
                    label: SOURCE_LABELS[i.source] || i.source,
                    rate: i.rate.toNumber(),
                })),
            }))
            .slice(0, periods);

        return NextResponse.json({
            success: true,
            data: {
                latest: formattedLatest,
                history: formattedHistory,
                settings: {
                    preferredSource: orgSettings?.inflationIndexSource || null,
                    autoAdjust: orgSettings?.autoInflationAdjust || false,
                    extraPercent: orgSettings?.inflationExtraPercent?.toNumber() || 0,
                    lastCheck: orgSettings?.lastInflationCheck?.toISOString() || null,
                },
                availableUpdates,
                sources: VALID_SOURCES.map(s => ({
                    value: s,
                    label: SOURCE_LABELS[s],
                    recommendation: SOURCE_RECOMMENDATIONS[s],
                })),
            },
        });
    } catch (error) {
        console.error('[Inflation API] GET error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch inflation indices',
            },
            { status: 500 }
        );
    }
}

// Helper to format period
function formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[parseInt(month) - 1]} ${year}`;
}
