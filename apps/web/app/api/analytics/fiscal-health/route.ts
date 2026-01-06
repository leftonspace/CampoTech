/**
 * Fiscal Health API Endpoint
 * ==========================
 *
 * Phase 2.4 Task 2.4.3: Fiscal Health API
 *
 * Provides fiscal health data for dashboards and widgets.
 * Returns Monotributo billing status with traffic light indicators.
 *
 * GET /api/analytics/fiscal-health
 *   - Returns full fiscal health data
 *   - Query param: summary=true for simplified mobile response
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { fiscalHealthService } from '@/lib/services/fiscal-health.service';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if summary only is requested (for mobile/widgets)
        const { searchParams } = new URL(request.url);
        const summaryOnly = searchParams.get('summary') === 'true';

        if (summaryOnly) {
            const summary = await fiscalHealthService.getFiscalHealthSummary(
                session.organizationId
            );

            return NextResponse.json({
                success: true,
                data: summary,
            });
        }

        // Get full fiscal health with formatted values
        const { health, formatted } = await fiscalHealthService.getFormattedFiscalHealth(
            session.organizationId
        );

        return NextResponse.json({
            success: true,
            data: {
                ...health,
                formatted,
            },
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Fiscal health API error:', err.message);
        return NextResponse.json(
            { success: false, error: 'Error fetching fiscal health data' },
            { status: 500 }
        );
    }
}
