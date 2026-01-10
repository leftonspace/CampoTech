/**
 * Phase 4.5: Campaign Detail API
 * ===============================
 * 
 * API for individual campaign operations.
 * 
 * GET    - Get campaign details
 * PATCH  - Update campaign
 * DELETE - Delete campaign (draft only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCampaignService } from '@/lib/services/campaign.service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get campaign details
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const campaignService = getCampaignService();
        const campaign = await campaignService.getCampaign(id);

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            campaign,
        });
    } catch (error) {
        console.error('[Campaign API] Get error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update campaign
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const campaignService = getCampaignService();
        const campaign = await campaignService.updateCampaign({
            id,
            name: body.name,
            description: body.description,
            channel: body.channel,
            source: body.source,
            targetProvince: body.targetProvince,
            targetProfession: body.targetProfession,
            dailyLimit: body.dailyLimit,
            batchSize: body.batchSize,
            batchDelayMs: body.batchDelayMs,
            emailSubject: body.emailSubject,
            emailFromName: body.emailFromName,
            emailReplyTo: body.emailReplyTo,
            templateName: body.templateName,
            templateContent: body.templateContent,
        });

        return NextResponse.json({
            success: true,
            campaign,
        });
    } catch (error) {
        console.error('[Campaign API] Update error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete campaign
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const campaignService = getCampaignService();
        await campaignService.deleteCampaign(id);

        return NextResponse.json({
            success: true,
            message: 'Campaign deleted',
        });
    } catch (error) {
        console.error('[Campaign API] Delete error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
