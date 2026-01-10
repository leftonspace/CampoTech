/**
 * Phase 6.3: BSP Readiness API
 * =============================
 * 
 * Returns metrics indicating whether CampoTech is ready
 * to apply for Meta BSP (Business Solution Provider) partnership.
 * 
 * GET - Get readiness metrics and report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';
import { bspReadinessService } from '@/lib/services/bsp-readiness.service';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function requireAdmin(): Promise<{ user: TokenPayload } | NextResponse> {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only platform admins (OWNER role at platform level) can access this
        if (session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        return { user: session };
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Get BSP readiness metrics
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';

        if (format === 'markdown') {
            // Return formatted markdown report
            const report = await bspReadinessService.getReadinessReport();
            return new NextResponse(report, {
                headers: {
                    'Content-Type': 'text/markdown',
                },
            });
        }

        // Return JSON metrics
        const metrics = await bspReadinessService.getReadinessMetrics();

        return NextResponse.json({
            success: true,
            ...metrics,
            documentation: {
                guide: '/docs/bsp-partnership-guide.md',
                technical: '/docs/bsp-technical-documentation.md',
            },
        });
    } catch (error) {
        console.error('[BSP Readiness API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
