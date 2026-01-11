/**
 * Phase 4.5: Outreach Campaign Service
 * =====================================
 * 
 * Manages outreach campaigns for the Growth Engine.
 * Handles campaign CRUD, targeting, launching, and metrics.
 * 
 * Key Features:
 * - Campaign lifecycle management (draft ←’ approved ←’ launching ←’ completed)
 * - Launch Gate enforcement (owner approval required)
 * - Targeting with filters (source, province, profession)
 * - Rate limiting and batch processing
 * - Metrics tracking (sent, delivered, opened, clicked, claimed)
 */

import { prisma } from '@/lib/prisma';

// Local enum types (matching Prisma schema)
type CampaignStatus = 'draft' | 'ready' | 'approved' | 'launching' | 'paused' | 'completed' | 'cancelled';
type OutreachChannel = 'email' | 'whatsapp' | 'sms';
type TemplateApprovalStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
type UnclaimedProfileSource = 'ERSEP' | 'CACAAV' | 'GASNOR' | 'GASNEA' | 'ENARGAS' | 'MANUAL';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface CreateCampaignInput {
    organizationId: string;
    name: string;
    description?: string;
    channel: OutreachChannel;
    source?: UnclaimedProfileSource;
    targetProvince?: string;
    targetProfession?: string;
    dailyLimit?: number;
    batchSize?: number;
    batchDelayMs?: number;
    // Email-specific
    emailSubject?: string;
    emailFromName?: string;
    emailReplyTo?: string;
    // WhatsApp-specific
    templateName?: string;
    templateContent?: string;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
    id: string;
}

export interface CampaignMetrics {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    claimed: number;
    errors: number;
    unsubscribed: number;
    deliveryRate: string;
    openRate: string;
    clickRate: string;
    claimRate: string;
}

export interface CampaignWithMetrics {
    id: string;
    name: string;
    description: string | null;
    status: CampaignStatus;
    channel: OutreachChannel;
    source: UnclaimedProfileSource | null;
    targetProvince: string | null;
    targetProfession: string | null;
    targetCount: number;
    sentCount: number;
    claimedCount: number;
    createdAt: Date;
    launchedAt: Date | null;
    completedAt: Date | null;
    metrics: CampaignMetrics;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAMPAIGN SERVICE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class CampaignService {

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // CRUD OPERATIONS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Create a new campaign (starts in draft status)
     */
    async createCampaign(input: CreateCampaignInput) {
        // Calculate target count based on filters
        const targetCount = await this.calculateTargetCount(input);

        const campaign = await prisma.outreachCampaign.create({
            data: {
                organizationId: input.organizationId,
                name: input.name,
                description: input.description,
                channel: input.channel,
                source: input.source,
                targetProvince: input.targetProvince,
                targetProfession: input.targetProfession,
                targetCount,
                dailyLimit: input.dailyLimit || 1000,
                batchSize: input.batchSize || 50,
                batchDelayMs: input.batchDelayMs || 60000,
                // Email config
                emailSubject: input.emailSubject,
                emailFromName: input.emailFromName,
                emailReplyTo: input.emailReplyTo,
                // WhatsApp config
                templateName: input.templateName,
                templateContent: input.templateContent,
                templateStatus: input.templateName
                    ? 'not_submitted'
                    : 'not_submitted',
                status: 'draft',
            },
        });

        return campaign;
    }

    /**
     * Get a campaign by ID with metrics
     */
    async getCampaign(id: string): Promise<CampaignWithMetrics | null> {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) return null;

        return {
            ...campaign,
            metrics: this.calculateMetrics(campaign),
        };
    }

    /**
     * List campaigns for an organization
     */
    async listCampaigns(options: {
        organizationId: string;
        status?: CampaignStatus;
        channel?: OutreachChannel;
        page?: number;
        limit?: number;
    }) {
        const { organizationId, status, channel, page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;

        const where = {
            organizationId,
            ...(status && { status }),
            ...(channel && { channel }),
        };

        const [campaigns, total] = await Promise.all([
            prisma.outreachCampaign.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.outreachCampaign.count({ where }),
        ]);

        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            campaigns: campaigns.map((c: any) => ({
                ...c,
                metrics: this.calculateMetrics(c),
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update a campaign (only draft campaigns can be modified)
     */
    async updateCampaign(input: UpdateCampaignInput) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id: input.id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'draft') {
            throw new Error('Only draft campaigns can be modified');
        }

        // Recalculate target count if filters changed
        let targetCount = campaign.targetCount;
        if (input.source !== undefined ||
            input.targetProvince !== undefined ||
            input.targetProfession !== undefined) {
            targetCount = await this.calculateTargetCount({
                source: input.source || campaign.source || undefined,
                targetProvince: input.targetProvince || campaign.targetProvince || undefined,
                targetProfession: input.targetProfession || campaign.targetProfession || undefined,
                channel: input.channel || campaign.channel,
                organizationId: campaign.organizationId,
                name: campaign.name,
            });
        }

        const updated = await prisma.outreachCampaign.update({
            where: { id: input.id },
            data: {
                ...(input.name && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.channel && { channel: input.channel }),
                ...(input.source !== undefined && { source: input.source }),
                ...(input.targetProvince !== undefined && { targetProvince: input.targetProvince }),
                ...(input.targetProfession !== undefined && { targetProfession: input.targetProfession }),
                ...(input.dailyLimit && { dailyLimit: input.dailyLimit }),
                ...(input.batchSize && { batchSize: input.batchSize }),
                ...(input.batchDelayMs && { batchDelayMs: input.batchDelayMs }),
                ...(input.emailSubject !== undefined && { emailSubject: input.emailSubject }),
                ...(input.emailFromName !== undefined && { emailFromName: input.emailFromName }),
                ...(input.emailReplyTo !== undefined && { emailReplyTo: input.emailReplyTo }),
                ...(input.templateName !== undefined && { templateName: input.templateName }),
                ...(input.templateContent !== undefined && { templateContent: input.templateContent }),
                targetCount,
            },
        });

        return updated;
    }

    /**
     * Delete a campaign (only draft campaigns)
     */
    async deleteCampaign(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'draft') {
            throw new Error('Only draft campaigns can be deleted');
        }

        await prisma.outreachCampaign.delete({
            where: { id },
        });

        return { success: true };
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // CAMPAIGN LIFECYCLE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Mark campaign as ready for approval
     */
    async markReady(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'draft') {
            throw new Error('Only draft campaigns can be marked ready');
        }

        // Validate campaign is properly configured
        const validationErrors = await this.validateCampaign(campaign);
        if (validationErrors.length > 0) {
            throw new Error(`Campaign validation failed: ${validationErrors.join(', ')}`);
        }

        return prisma.outreachCampaign.update({
            where: { id },
            data: { status: 'ready' },
        });
    }

    /**
     * Approve campaign for launching (OWNER ONLY)
     * This is a critical gate - only approved campaigns can send messages
     */
    async approveCampaign(id: string, userId: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'ready') {
            throw new Error('Only ready campaigns can be approved');
        }

        return prisma.outreachCampaign.update({
            where: { id },
            data: {
                status: 'approved',
                approvedAt: new Date(),
                approvedBy: userId,
            },
        });
    }

    /**
     * Launch a campaign (start sending messages)
     */
    async launchCampaign(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'approved') {
            throw new Error('Only approved campaigns can be launched');
        }

        // Assign profiles to this campaign
        await this.assignProfilesToCampaign(campaign);

        return prisma.outreachCampaign.update({
            where: { id },
            data: {
                status: 'launching',
                launchedAt: new Date(),
            },
        });
    }

    /**
     * Pause a running campaign
     */
    async pauseCampaign(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'launching') {
            throw new Error('Only launching campaigns can be paused');
        }

        return prisma.outreachCampaign.update({
            where: { id },
            data: { status: 'paused' },
        });
    }

    /**
     * Resume a paused campaign
     */
    async resumeCampaign(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'paused') {
            throw new Error('Only paused campaigns can be resumed');
        }

        return prisma.outreachCampaign.update({
            where: { id },
            data: { status: 'launching' },
        });
    }

    /**
     * Cancel a campaign
     */
    async cancelCampaign(id: string) {
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status === 'completed' ||
            campaign.status === 'cancelled') {
            throw new Error('Campaign is already finished');
        }

        return prisma.outreachCampaign.update({
            where: { id },
            data: {
                status: 'cancelled',
                completedAt: new Date(),
            },
        });
    }

    /**
     * Mark campaign as completed
     */
    async completeCampaign(id: string) {
        return prisma.outreachCampaign.update({
            where: { id },
            data: {
                status: 'completed',
                completedAt: new Date(),
            },
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // METRICS & UPDATES
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Increment campaign metrics (called by outreach workers)
     */
    async incrementMetric(
        id: string,
        metric: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'claimed' | 'error' | 'unsubscribed'
    ) {
        const fieldMap: Record<string, string> = {
            sent: 'sentCount',
            delivered: 'deliveredCount',
            opened: 'openedCount',
            clicked: 'clickedCount',
            replied: 'repliedCount',
            claimed: 'claimedCount',
            error: 'errorCount',
            unsubscribed: 'unsubscribedCount',
        };

        await prisma.outreachCampaign.update({
            where: { id },
            data: {
                [fieldMap[metric]]: { increment: 1 },
            },
        });
    }

    /**
     * Get campaign stats for dashboard
     */
    async getCampaignStats(organizationId: string) {
        const campaigns = await prisma.outreachCampaign.findMany({
            where: { organizationId },
        });

        const stats = {
            total: campaigns.length,
            byStatus: {} as Record<string, number>,
            byChannel: {} as Record<string, number>,
            totalSent: 0,
            totalClaimed: 0,
            overallClaimRate: '0',
        };

        for (const campaign of campaigns) {
            // Count by status
            stats.byStatus[campaign.status] = (stats.byStatus[campaign.status] || 0) + 1;
            // Count by channel
            stats.byChannel[campaign.channel] = (stats.byChannel[campaign.channel] || 0) + 1;
            // Sum metrics
            stats.totalSent += campaign.sentCount;
            stats.totalClaimed += campaign.claimedCount;
        }

        stats.overallClaimRate = stats.totalSent > 0
            ? ((stats.totalClaimed / stats.totalSent) * 100).toFixed(2)
            : '0';

        return stats;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // PRIVATE HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Calculate target count based on campaign filters
     */
    private async calculateTargetCount(input: {
        source?: UnclaimedProfileSource;
        targetProvince?: string;
        targetProfession?: string;
        channel: OutreachChannel;
        organizationId: string;
        name: string;
    }): Promise<number> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            isActive: true,
            claimedAt: null,
            outreachStatus: 'not_contacted',
        };

        if (input.source) {
            where.source = input.source;
        }

        if (input.targetProvince) {
            where.province = input.targetProvince;
        }

        if (input.targetProfession) {
            where.profession = { contains: input.targetProfession, mode: 'insensitive' };
        }

        // For email campaigns, require email
        if (input.channel === 'email') {
            where.email = { not: null };
        }

        // For WhatsApp campaigns, require phone
        if (input.channel === 'whatsapp') {
            where.phone = { not: null };
        }

        return prisma.unclaimedProfile.count({ where });
    }

    /**
     * Validate campaign configuration
     */
    private async validateCampaign(campaign: {
        channel: OutreachChannel;
        emailSubject?: string | null;
        templateName?: string | null;
        templateStatus?: TemplateApprovalStatus | null;
        targetCount: number;
    }): Promise<string[]> {
        const errors: string[] = [];

        if (campaign.targetCount === 0) {
            errors.push('No profiles match the campaign filters');
        }

        if (campaign.channel === 'email') {
            if (!campaign.emailSubject) {
                errors.push('Email subject is required for email campaigns');
            }
        }

        if (campaign.channel === 'whatsapp') {
            if (!campaign.templateName) {
                errors.push('Template name is required for WhatsApp campaigns');
            }
            if (campaign.templateStatus !== 'approved') {
                errors.push('WhatsApp template must be approved by Meta');
            }
        }

        return errors;
    }

    /**
     * Assign unclaimed profiles to a campaign for tracking
     */
    private async assignProfilesToCampaign(campaign: {
        id: string;
        source: UnclaimedProfileSource | null;
        targetProvince: string | null;
        targetProfession: string | null;
        channel: OutreachChannel;
        targetCount: number;
    }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            isActive: true,
            claimedAt: null,
            outreachStatus: 'not_contacted',
            campaignId: null, // Not already assigned
        };

        if (campaign.source) {
            where.source = campaign.source;
        }

        if (campaign.targetProvince) {
            where.province = campaign.targetProvince;
        }

        if (campaign.targetProfession) {
            where.profession = { contains: campaign.targetProfession, mode: 'insensitive' };
        }

        // Channel-specific filters
        if (campaign.channel === 'email') {
            where.email = { not: null };
        }

        if (campaign.channel === 'whatsapp') {
            where.phone = { not: null };
        }

        // Assign profiles to campaign (up to targetCount)
        await prisma.unclaimedProfile.updateMany({
            where,
            data: {
                campaignId: campaign.id,
            },
        });
    }

    /**
     * Calculate metrics from campaign data
     */
    private calculateMetrics(campaign: {
        targetCount: number;
        sentCount: number;
        deliveredCount: number;
        openedCount: number;
        clickedCount: number;
        repliedCount: number;
        claimedCount: number;
        errorCount: number;
        unsubscribedCount: number;
    }): CampaignMetrics {
        const {
            targetCount, sentCount, deliveredCount, openedCount,
            clickedCount, repliedCount, claimedCount, errorCount, unsubscribedCount
        } = campaign;

        return {
            total: targetCount,
            sent: sentCount,
            delivered: deliveredCount,
            opened: openedCount,
            clicked: clickedCount,
            replied: repliedCount,
            claimed: claimedCount,
            errors: errorCount,
            unsubscribed: unsubscribedCount,
            deliveryRate: sentCount > 0 ? ((deliveredCount / sentCount) * 100).toFixed(2) : '0',
            openRate: deliveredCount > 0 ? ((openedCount / deliveredCount) * 100).toFixed(2) : '0',
            clickRate: deliveredCount > 0 ? ((clickedCount / deliveredCount) * 100).toFixed(2) : '0',
            claimRate: sentCount > 0 ? ((claimedCount / sentCount) * 100).toFixed(2) : '0',
        };
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON EXPORT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let campaignServiceInstance: CampaignService | null = null;

export function getCampaignService(): CampaignService {
    if (!campaignServiceInstance) {
        campaignServiceInstance = new CampaignService();
    }
    return campaignServiceInstance;
}

export default CampaignService;
