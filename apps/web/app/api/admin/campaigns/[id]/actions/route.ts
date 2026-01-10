/**
 * Phase 4.5: Campaign Actions API
 * ================================
 * 
 * API for campaign lifecycle actions.
 * 
 * POST - Execute action (mark-ready, approve, launch, pause, resume, cancel)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCampaignService } from '@/lib/services/campaign.service';
import { getLaunchGateService } from '@/lib/services/launch-gate.service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Valid actions
type CampaignAction = 'mark-ready' | 'approve' | 'launch' | 'pause' | 'resume' | 'cancel';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Execute campaign action
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const action = body.action as CampaignAction;

        if (!action) {
            return NextResponse.json(
                { error: 'Action is required' },
                { status: 400 }
            );
        }

        const validActions: CampaignAction[] = ['mark-ready', 'approve', 'launch', 'pause', 'resume', 'cancel'];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
                { status: 400 }
            );
        }

        const campaignService = getCampaignService();
        const launchGateService = getLaunchGateService();
        let campaign;

        switch (action) {
            case 'mark-ready':
                campaign = await campaignService.markReady(id);
                break;

            case 'approve':
                // 🔒 Owner approval required
                campaign = await campaignService.approveCampaign(id, session.userId);
                break;

            case 'launch':
                // 🔒 Check Growth Engine is launched
                await launchGateService.requireLaunched(session.organizationId);
                campaign = await campaignService.launchCampaign(id);
                break;

            case 'pause':
                campaign = await campaignService.pauseCampaign(id);
                break;

            case 'resume':
                // 🔒 Check Growth Engine is still launched
                await launchGateService.requireLaunched(session.organizationId);
                campaign = await campaignService.resumeCampaign(id);
                break;

            case 'cancel':
                campaign = await campaignService.cancelCampaign(id);
                break;
        }

        return NextResponse.json({
            success: true,
            action,
            campaign,
            message: getActionMessage(action),
        });
    } catch (error) {
        console.error('[Campaign Actions API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

function getActionMessage(action: CampaignAction): string {
    const messages: Record<CampaignAction, string> = {
        'mark-ready': '✅ Campaign marked as ready for approval',
        'approve': '🔓 Campaign approved - ready to launch',
        'launch': '🚀 Campaign launched - messages will start sending',
        'pause': '⏸️ Campaign paused',
        'resume': '▶️ Campaign resumed',
        'cancel': '❌ Campaign cancelled',
    };
    return messages[action];
}
