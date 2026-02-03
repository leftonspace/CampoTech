/**
 * Optimized Jobs Stats API v2
 * 
 * Single query for all counts using v_jobs_counts view
 * Phase 3: Query Optimization (Feb 2026)
 * 
 * Performance: ~10ms (single query) vs ~50-100ms (4 separate queries) in v1
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Use optimized view-based query (single query for all counts)
        const counts = await JobService.getJobCountsFast(session.organizationId);

        if (!counts) {
            // No jobs for this organization yet
            return NextResponse.json({
                success: true,
                data: {
                    totalCount: 0,
                    inProgressCount: 0,
                    scheduledTodayCount: 0,
                    completedThisMonthCount: 0,
                    pendingVarianceCount: 0,
                    activeCount: 0,
                    cancelledCount: 0,
                    completedCount: 0,
                },
                _optimized: true,
            });
        }

        // Transform bigint counts to numbers for JSON serialization
        return NextResponse.json({
            success: true,
            data: {
                // Main stats (used by dashboard stats cards)
                totalCount: Number(counts.total_count),  // All jobs including cancelled
                inProgressCount: Number(counts.in_progress_count),
                scheduledTodayCount: Number(counts.scheduled_today),
                completedThisMonthCount: Number(counts.completed_this_month),
                pendingVarianceCount: Number(counts.pending_variance),
                // Tab badge counts (Todos, Activos, Cancelados)
                activeCount: Number(counts.active_count),  // All non-cancelled
                cancelledCount: Number(counts.cancelled_count),
                completedCount: Number(counts.completed_count),
            },
            _optimized: true, // Flag to indicate v2 optimized response
        });
    } catch (error) {
        console.error('Jobs stats v2 error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching job stats' },
            { status: 500 }
        );
    }
}
