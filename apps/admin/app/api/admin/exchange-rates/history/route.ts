/**
 * Exchange Rate History API (Admin)
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/admin/exchange-rates/history - Get rate history for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_SOURCES = ['OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM'];

const EXCHANGE_RATE_LABELS: Record<string, string> = {
    OFICIAL: 'Dólar Oficial',
    BLUE: 'Cotización de Mercado',
    MEP: 'Dólar MEP',
    CCL: 'Dólar CCL',
    CRYPTO: 'Cotización Crypto',
    CUSTOM: 'Cotización Personalizada',
};

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
        const sourceParam = searchParams.get('source')?.toUpperCase();
        const daysParam = searchParams.get('days');

        // Validate source if provided
        const source = sourceParam && VALID_SOURCES.includes(sourceParam)
            ? sourceParam
            : undefined;

        // Parse days (default 7, max 90)
        const days = Math.min(parseInt(daysParam || '7', 10) || 7, 90);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get history
        const rates = await prisma.exchangeRate.findMany({
            where: {
                ...(source && { source }),
                fetchedAt: { gte: startDate },
            },
            orderBy: { fetchedAt: 'asc' },
            take: 1000,
            select: {
                id: true,
                source: true,
                buyRate: true,
                sellRate: true,
                averageRate: true,
                fetchedAt: true,
                isStale: true,
            },
        });

        // Group by source for charting
        const groupedHistory: Record<string, typeof rates> = {};
        for (const entry of rates) {
            if (!groupedHistory[entry.source]) {
                groupedHistory[entry.source] = [];
            }
            groupedHistory[entry.source].push(entry);
        }

        // Calculate stats per source
        const stats = Object.entries(groupedHistory).map(([src, entries]) => {
            const values = entries.map(e => e.averageRate.toNumber());
            const min = Math.min(...values);
            const max = Math.max(...values);
            const current = values[values.length - 1];
            const first = values[0];
            const change = current - first;
            const changePercent = first ? (change / first) * 100 : 0;

            return {
                source: src,
                label: EXCHANGE_RATE_LABELS[src] || src,
                current,
                min,
                max,
                change,
                changePercent,
                dataPoints: entries.length,
            };
        });

        // Format for chart consumption
        const chartData = Object.entries(groupedHistory).map(([src, entries]) => ({
            source: src,
            label: EXCHANGE_RATE_LABELS[src] || src,
            data: entries.map(e => ({
                date: e.fetchedAt.toISOString(),
                buy: e.buyRate.toNumber(),
                sell: e.sellRate.toNumber(),
                avg: e.averageRate.toNumber(),
            })),
        }));

        return NextResponse.json({
            success: true,
            data: {
                history: chartData,
                stats,
                meta: {
                    source,
                    days,
                    totalRecords: rates.length,
                    sources: Object.keys(groupedHistory),
                },
            },
        });
    } catch (error) {
        console.error('[Admin Rate History] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get rate history',
            },
            { status: 500 }
        );
    }
}
