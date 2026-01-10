/**
 * Phase 4.5: Launch Gate API
 * ===========================
 * 
 * API for Growth Engine pre-launch checklist and approval.
 * 
 * GET   - Get current launch status and checklist
 * PATCH - Update checklist items  
 * POST  - Approve launch (OWNER ONLY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getLaunchGateService, LaunchChecklist } from '@/lib/services/launch-gate.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get launch status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
        }

        const launchGateService = getLaunchGateService();
        const status = await launchGateService.getStatus(session.organizationId);

        return NextResponse.json({
            success: true,
            ...status,
        });
    } catch (error) {
        console.error('[Launch Gate API] Get error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update checklist
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
        }

        const body = await request.json();
        const updates = body.checklist as Partial<LaunchChecklist>;

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                { error: 'Checklist updates required' },
                { status: 400 }
            );
        }

        const launchGateService = getLaunchGateService();
        const status = await launchGateService.updateChecklist(
            session.organizationId,
            updates
        );

        return NextResponse.json({
            success: true,
            ...status,
        });
    } catch (error) {
        console.error('[Launch Gate API] Update error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Approve launch
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
        }

        const body = await request.json();
        const checklist = body.checklist as LaunchChecklist;

        if (!checklist || typeof checklist !== 'object') {
            return NextResponse.json(
                { error: 'Complete checklist required' },
                { status: 400 }
            );
        }

        const launchGateService = getLaunchGateService();

        // Verify checklist is complete
        if (!launchGateService.canLaunch(checklist)) {
            return NextResponse.json(
                {
                    error: 'Checklist incomplete',
                    message: '⚠️ Complete all required items before launching'
                },
                { status: 400 }
            );
        }

        // Approve launch
        await launchGateService.approveLaunch(
            session.organizationId,
            session.userId,
            checklist
        );

        return NextResponse.json({
            success: true,
            message: '🚀 Growth Engine launched! Campaigns can now be sent.',
            launchedAt: new Date().toISOString(),
            launchedBy: session.userId,
        });
    } catch (error) {
        console.error('[Launch Gate API] Approve error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
