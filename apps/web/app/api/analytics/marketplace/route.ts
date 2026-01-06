import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

/**
 * Marketplace Analytics API
 * ==========================
 * 
 * Phase 3.2: WhatsApp Attribution Tracking
 * 
 * Returns metrics for marketplace clicks and conversions for the current organization.
 */

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const organizationId = session.organizationId;
        const searchParams = req.nextUrl.searchParams;
        const days = parseInt(searchParams.get('days') || '30');
        const startDate = startOfDay(subDays(new Date(), days));

        // 1. Fetch all clicks in the period
        const clicksResult = await prisma.marketplaceClick.findMany({
            where: {
                organizationId,
                clickedAt: { gte: startDate },
            },
            orderBy: { clickedAt: 'asc' },
        });

        // Use typed array to avoid implicit any issues
        type ClickType = (typeof clicksResult)[number];
        const clicks: ClickType[] = clicksResult;

        // 2. Fetch conversions (clicks that have a convertedJobId)
        const conversions = clicks.filter((click: ClickType) => click.convertedJobId !== null);

        // 3. Calculate metrics
        const totalClicks = clicks.length;
        const totalConversions = conversions.length;
        const conversionRate = totalClicks > 0
            ? ((totalConversions / totalClicks) * 100).toFixed(1)
            : "0.0";

        // 4. Group by day for the chart
        const daysInterval = eachDayOfInterval({
            start: startDate,
            end: new Date(),
        });

        const dailyBreakdown = daysInterval.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayClicks = clicks.filter((c: ClickType) =>
                format(c.clickedAt, 'yyyy-MM-dd') === dateStr
            );
            const dayConversions = dayClicks.filter((c: ClickType) => c.convertedJobId !== null);

            return {
                date: dateStr,
                displayDate: format(day, 'dd/MM'),
                clicks: dayClicks.length,
                conversions: dayConversions.length,
                rate: dayClicks.length > 0
                    ? ((dayConversions.length / dayClicks.length) * 100).toFixed(1)
                    : "0.0"
            };
        });

        // 5. Calculate change vs previous period (simple stub for now)
        // In a real app, we'd fetch the previous period too
        const clicksChange = 12.5; // Stub
        const conversionChange = 5.2; // Stub

        return NextResponse.json({
            kpis: {
                totalClicks: { value: totalClicks, change: clicksChange },
                totalConversions: { value: totalConversions, change: conversionChange },
                conversionRate: { value: parseFloat(conversionRate), change: 2.1 },
            },
            trends: {
                clicksOverTime: dailyBreakdown.map(d => ({ label: d.displayDate, value: d.clicks })),
                conversionsOverTime: dailyBreakdown.map(d => ({ label: d.displayDate, value: d.conversions })),
            },
            dailyBreakdown: dailyBreakdown.reverse(), // Show newest first for the table
        });

    } catch (error) {
        console.error('[MarketplaceAnalyticsAPI] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
