/**
 * Phase 4.5: Campaigns API
 * ========================
 * 
 * Admin API for managing outreach campaigns.
 * 
 * GET  - List campaigns with filters and pagination
 * POST - Create a new campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCampaignService } from '@/lib/services/campaign.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List campaigns
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const status = searchParams.get('status') as string | null;
        const channel = searchParams.get('channel');

        const campaignService = getCampaignService();
        const result = await campaignService.listCampaigns({
            organizationId: session.organizationId,
            status: status as never,
            channel: channel as never,
            page,
            limit,
        });

        // Also get stats
        const stats = await campaignService.getCampaignStats(session.organizationId);

        return NextResponse.json({
            success: true,
            ...result,
            stats,
        });
    } catch (error) {
        console.error('[Campaigns API] List error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create campaign
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.channel) {
            return NextResponse.json(
                { error: 'Name and channel are required' },
                { status: 400 }
            );
        }

        // Validate channel
        if (!['email', 'whatsapp', 'sms'].includes(body.channel)) {
            return NextResponse.json(
                { error: 'Invalid channel. Must be: email, whatsapp, or sms' },
                { status: 400 }
            );
        }

        // Validate source if provided
        if (body.source && !['ERSEP', 'CACAAV', 'GASNOR', 'GASNEA', 'ENARGAS', 'MANUAL'].includes(body.source)) {
            return NextResponse.json(
                { error: 'Invalid source' },
                { status: 400 }
            );
        }

        const campaignService = getCampaignService();
        const campaign = await campaignService.createCampaign({
            organizationId: session.organizationId,
            name: body.name,
            description: body.description,
            channel: body.channel as never,
            source: body.source as never,
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
        console.error('[Campaigns API] Create error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
