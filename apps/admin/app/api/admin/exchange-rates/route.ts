/**
 * Exchange Rates Admin API
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/admin/exchange-rates - Get all current rates + stats
 * POST /api/admin/exchange-rates - Trigger manual refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Fetch All Current Rates with Stats
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get latest rate for each source
        const sources = ['OFICIAL', 'BLUE', 'MEP'];
        const rates = await Promise.all(
            sources.map(async (source) => {
                const rate = await prisma.exchangeRate.findFirst({
                    where: { source },
                    orderBy: { fetchedAt: 'desc' },
                });

                if (!rate) return null;

                // Check if stale (older than 1 hour)
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                const isStale = rate.fetchedAt < oneHourAgo;

                return {
                    id: rate.id,
                    source: rate.source,
                    buyRate: rate.buyRate.toNumber(),
                    sellRate: rate.sellRate.toNumber(),
                    averageRate: rate.averageRate.toNumber(),
                    fetchedAt: rate.fetchedAt.toISOString(),
                    validUntil: rate.validUntil.toISOString(),
                    isStale,
                };
            })
        );

        // Get stats for last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRates = await prisma.exchangeRate.findMany({
            where: {
                fetchedAt: { gte: oneDayAgo },
            },
            select: {
                source: true,
                averageRate: true,
                fetchedAt: true,
            },
            orderBy: { fetchedAt: 'desc' },
        });

        // Count by source
        const stats = {
            totalRecords24h: recentRates.length,
            bySource: sources.map(source => ({
                source,
                count: recentRates.filter(r => r.source === source).length,
            })),
            lastUpdate: recentRates[0]?.fetchedAt.toISOString() || null,
        };

        return NextResponse.json({
            success: true,
            data: {
                rates: rates.filter(Boolean),
                stats,
            },
        });
    } catch (error) {
        console.error('[Admin Exchange Rates] GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch rates' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Trigger Manual Refresh
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST() {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only super_admin can trigger refresh
        if (admin.role !== 'super_admin') {
            return NextResponse.json(
                { success: false, error: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        // Call the cron endpoint on apps/web to trigger refresh
        const webAppUrl = process.env.WEB_APP_URL || 'https://app.campotech.com.ar';
        const cronSecret = process.env.CRON_SECRET;

        const response = await fetch(`${webAppUrl}/api/cron/exchange-rates`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cronSecret}`,
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        console.log(`[Admin] ${admin.email} triggered exchange rate refresh`);

        return NextResponse.json({
            success: true,
            data: result.data || result,
            triggeredBy: admin.email,
        });
    } catch (error) {
        console.error('[Admin Exchange Rates] POST error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to trigger refresh' },
            { status: 500 }
        );
    }
}
