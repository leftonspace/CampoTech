/**
 * Phase 4.6: Email Outreach Stats API
 * =====================================
 * 
 * API to get email outreach statistics.
 * 
 * GET - Get email outreach stats
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmailOutreachService } from '@/lib/services/email-outreach.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get email stats
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const emailService = getEmailOutreachService();
        const stats = await emailService.getEmailStats();

        return NextResponse.json({
            success: true,
            stats,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Email Stats API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
