/**
 * Phase 4.6: Email Campaign Send API
 * ====================================
 * 
 * API to trigger sending an email campaign.
 * Respects Launch Gate and campaign status.
 * 
 * POST - Start sending emails for a campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmailOutreachService } from '@/lib/services/email-outreach.service';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Send email campaign
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { campaignId, limit } = body;

        if (!campaignId) {
            return NextResponse.json(
                { error: 'campaignId is required' },
                { status: 400 }
            );
        }

        const emailService = getEmailOutreachService();

        // Start sending (this can take a while for large campaigns)
        const result = await emailService.sendEmailCampaign(
            campaignId,
            session.organizationId,
            limit
        );

        return NextResponse.json({
            success: true,
            message: `Email campaign sending complete`,
            result: {
                total: result.total,
                sent: result.sent,
                failed: result.failed,
            },
        });
    } catch (error) {
        console.error('[Email Send API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
