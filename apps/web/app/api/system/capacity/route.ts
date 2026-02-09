import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getUnifiedSystemStatus,
    formatUnifiedReport,
} from '@/lib/services/system-capacity.service';

/**
 * GET /api/system/capacity
 *
 * Returns unified system status combining:
 * - Operational health (from degradation manager)
 * - Infrastructure capacity (database, API quotas, etc.)
 *
 * Query params:
 * - format: 'json' (default), 'text' (console format), 'simple' (monitoring tools)
 * - aiCalls: estimated daily AI calls for projections (default: 100)
 * - skipHealth: skip operational health check (faster, default: false)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'json';
    const estimatedDailyAICalls = parseInt(searchParams.get('aiCalls') ?? '100', 10);
    const skipOperationalHealth = searchParams.get('skipHealth') === 'true';

    try {
        const status = await getUnifiedSystemStatus(prisma, {
            estimatedDailyAICalls,
            skipOperationalHealth,
        });

        // Simple format for monitoring tools (Prometheus, Datadog, uptime checks)
        if (format === 'simple') {
            return NextResponse.json({
                healthy: status.combined === 'healthy',
                status: status.combined,
                operationalStatus: status.operationalHealth.status,
                bottleneckCount: status.infrastructureCapacity.bottlenecks.length,
                organizations: status.businessMetrics.organizations,
                databasePercent: status.infrastructureCapacity.services
                    .find(s => s.id === 'supabase')?.resources
                    .find(r => r.name === 'Database Size')?.percentUsed ?? 0,
                recommendations: status.recommendations.length,
                timestamp: status.timestamp,
            }, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
        }

        // Text format for console/terminal output
        if (format === 'text') {
            const report = formatUnifiedReport(status);
            return new Response(report, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
        }

        // Full JSON format (default)
        return NextResponse.json(status, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('[System Capacity] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to check system capacity',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
