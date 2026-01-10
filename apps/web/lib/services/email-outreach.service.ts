/**
 * Phase 4.6: Email Outreach Service
 * ===================================
 * 
 * Manages email campaigns for the Growth Engine.
 * Uses Resend for email delivery with rate limiting and tracking.
 * 
 * Key Features:
 * - Individual and batch email sending
 * - Rate limiting (10k/day, 100/batch)
 * - Open/click/bounce tracking via webhooks
 * - Launch Gate enforcement
 * - Campaign progress tracking
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateEmailProvider } from '@/lib/email';
import { getLaunchGateService } from '@/lib/services/launch-gate.service';
import { getCampaignService } from '@/lib/services/campaign.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UnclaimedProfileForEmail {
    id: string;
    fullName: string;
    email: string;
    matricula: string | null;
    profession: string | null;
    province: string | null;
    source: string;
}

interface SendResult {
    success: boolean;
    profileId: string;
    email: string;
    messageId?: string;
    error?: string;
}

interface BatchResult {
    total: number;
    sent: number;
    failed: number;
    results: SendResult[];
}

interface EmailStats {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    bySource: Record<string, {
        total: number;
        sent: number;
        claimed: number;
    }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DAILY_LIMIT = 10000;      // Max emails per day
const BATCH_SIZE = 100;         // Emails per batch
const BATCH_DELAY_MS = 1000;    // Delay between batches (1 second)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar';

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL OUTREACH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class EmailOutreachService {
    private emailProvider = getOrCreateEmailProvider();
    private launchGateService = getLaunchGateService();
    private campaignService = getCampaignService();

    // ═══════════════════════════════════════════════════════════════════════════
    // SEND INDIVIDUAL EMAIL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Send a claim profile email to a single unclaimed profile
     */
    async sendClaimEmail(profile: UnclaimedProfileForEmail): Promise<SendResult> {
        try {
            const claimUrl = this.generateClaimUrl(profile);
            const unsubscribeUrl = this.generateUnsubscribeUrl(profile.id);

            const firstName = profile.fullName.split(' ')[0];
            const html = this.generateClaimEmailHTML({
                name: firstName,
                matricula: profile.matricula || 'N/A',
                authority: this.getAuthorityName(profile.source),
                profession: profile.profession || 'Profesional',
                claimUrl,
                unsubscribeUrl,
            });

            const result = await this.emailProvider.sendEmail({
                to: profile.email,
                subject: `${firstName}, tu matrícula ya está en CampoTech - Reclamá tu perfil gratis`,
                html,
                text: this.generateClaimEmailText({
                    name: firstName,
                    matricula: profile.matricula || 'N/A',
                    claimUrl,
                    unsubscribeUrl,
                }),
            });

            // Update profile tracking
            if (result.success) {
                await prisma.unclaimedProfile.update({
                    where: { id: profile.id },
                    data: {
                        emailSentAt: new Date(),
                        outreachStatus: 'email_sent',
                        lastContactedAt: new Date(),
                        contactAttempts: { increment: 1 },
                    },
                });
            }

            return {
                success: result.success,
                profileId: profile.id,
                email: profile.email,
                messageId: result.messageId,
                error: result.error,
            };
        } catch (error) {
            console.error(`[Email Outreach] Failed to send to ${profile.email}:`, error);
            return {
                success: false,
                profileId: profile.id,
                email: profile.email,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEND BATCH CAMPAIGN
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Send emails for an approved email campaign
     * Respects rate limits and Launch Gate
     */
    async sendEmailCampaign(
        campaignId: string,
        organizationId: string,
        limit?: number
    ): Promise<BatchResult> {
        // 🔒 Check Launch Gate
        await this.launchGateService.requireLaunched(organizationId);

        // Get campaign and verify it's approved
        const campaign = await prisma.outreachCampaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'launching') {
            throw new Error('Campaign must be in launching status. Current: ' + campaign.status);
        }

        if (campaign.channel !== 'email') {
            throw new Error('This is not an email campaign');
        }

        // Get profiles for this campaign that haven't been emailed yet
        const profiles = await this.getProfilesForCampaign(campaign, limit || DAILY_LIMIT);

        if (profiles.length === 0) {
            return {
                total: 0,
                sent: 0,
                failed: 0,
                results: [],
            };
        }

        console.log(`[Email Outreach] Sending ${profiles.length} emails for campaign ${campaignId}`);

        const allResults: SendResult[] = [];
        let sentCount = 0;
        let failedCount = 0;

        // Process in batches
        for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
            const batch = profiles.slice(i, i + BATCH_SIZE);

            console.log(`[Email Outreach] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(profiles.length / BATCH_SIZE)}`);

            // Send batch in parallel
            const results = await Promise.all(
                batch.map(profile => this.sendClaimEmail(profile))
            );

            allResults.push(...results);

            // Count successes and failures
            for (const result of results) {
                if (result.success) {
                    sentCount++;
                    await this.campaignService.incrementMetric(campaignId, 'sent');
                } else {
                    failedCount++;
                    await this.campaignService.incrementMetric(campaignId, 'error');
                }
            }

            // Delay between batches to respect rate limits
            if (i + BATCH_SIZE < profiles.length) {
                await this.delay(BATCH_DELAY_MS);
            }
        }

        console.log(`[Email Outreach] Campaign ${campaignId} complete: ${sentCount} sent, ${failedCount} failed`);

        return {
            total: profiles.length,
            sent: sentCount,
            failed: failedCount,
            results: allResults,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WEBHOOK HANDLERS (for tracking)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Handle email delivered webhook from Resend
     */
    async handleEmailDelivered(email: string, messageId: string): Promise<void> {
        await prisma.unclaimedProfile.updateMany({
            where: { email },
            data: { emailDeliveredAt: new Date() },
        });

        // Increment campaign delivered count if profile has campaign
        const profile = await prisma.unclaimedProfile.findFirst({
            where: { email },
            select: { campaignId: true },
        });
        if (profile?.campaignId) {
            await this.campaignService.incrementMetric(profile.campaignId, 'delivered');
        }
    }

    /**
     * Handle email opened webhook from Resend
     */
    async handleEmailOpened(email: string, messageId: string): Promise<void> {
        // Only update if not already opened (first open counts)
        await prisma.unclaimedProfile.updateMany({
            where: {
                email,
                emailOpenedAt: null,
            },
            data: { emailOpenedAt: new Date() },
        });

        const profile = await prisma.unclaimedProfile.findFirst({
            where: { email },
            select: { campaignId: true },
        });
        if (profile?.campaignId) {
            await this.campaignService.incrementMetric(profile.campaignId, 'opened');
        }
    }

    /**
     * Handle email clicked webhook from Resend
     */
    async handleEmailClicked(email: string, link: string): Promise<void> {
        // Only update if not already clicked (first click counts)
        await prisma.unclaimedProfile.updateMany({
            where: {
                email,
                emailClickedAt: null,
            },
            data: { emailClickedAt: new Date() },
        });

        const profile = await prisma.unclaimedProfile.findFirst({
            where: { email },
            select: { campaignId: true },
        });
        if (profile?.campaignId) {
            await this.campaignService.incrementMetric(profile.campaignId, 'clicked');
        }
    }

    /**
     * Handle email bounced webhook from Resend
     */
    async handleEmailBounced(email: string, messageId: string): Promise<void> {
        await prisma.unclaimedProfile.updateMany({
            where: { email },
            data: {
                emailBouncedAt: new Date(),
                outreachStatus: 'bounced',
            },
        });

        const profile = await prisma.unclaimedProfile.findFirst({
            where: { email },
            select: { campaignId: true },
        });
        if (profile?.campaignId) {
            await this.campaignService.incrementMetric(profile.campaignId, 'error');
        }
    }

    /**
     * Handle unsubscribe request
     */
    async handleUnsubscribe(profileId: string): Promise<void> {
        await prisma.unclaimedProfile.update({
            where: { id: profileId },
            data: {
                emailUnsubscribedAt: new Date(),
                outreachStatus: 'opted_out',
                isActive: false,
            },
        });

        const profile = await prisma.unclaimedProfile.findUnique({
            where: { id: profileId },
            select: { campaignId: true },
        });
        if (profile?.campaignId) {
            await this.campaignService.incrementMetric(profile.campaignId, 'unsubscribed');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get email outreach statistics
     */
    async getEmailStats(): Promise<EmailStats> {
        const [
            total,
            sent,
            delivered,
            opened,
            clicked,
            bounced,
            unsubscribed,
            bySourceData,
        ] = await Promise.all([
            prisma.unclaimedProfile.count({
                where: { isActive: true, email: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailSentAt: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailDeliveredAt: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailOpenedAt: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailClickedAt: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailBouncedAt: { not: null } },
            }),
            prisma.unclaimedProfile.count({
                where: { emailUnsubscribedAt: { not: null } },
            }),
            prisma.unclaimedProfile.groupBy({
                by: ['source'],
                where: { isActive: true, email: { not: null } },
                _count: { id: true },
            }),
        ]);

        // Get sent and claimed counts by source
        const bySource: Record<string, { total: number; sent: number; claimed: number }> = {};

        for (const item of bySourceData) {
            const [sentCount, claimedCount] = await Promise.all([
                prisma.unclaimedProfile.count({
                    where: {
                        source: item.source,
                        emailSentAt: { not: null }
                    },
                }),
                prisma.unclaimedProfile.count({
                    where: {
                        source: item.source,
                        claimedAt: { not: null }
                    },
                }),
            ]);

            bySource[item.source] = {
                total: item._count.id,
                sent: sentCount,
                claimed: claimedCount,
            };
        }

        return {
            total,
            sent,
            delivered,
            opened,
            clicked,
            bounced,
            unsubscribed,
            bySource,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get profiles for a campaign that haven't been emailed yet
     */
    private async getProfilesForCampaign(
        campaign: {
            id: string;
            source: string | null;
            targetProvince: string | null;
            targetProfession: string | null;
        },
        limit: number
    ): Promise<UnclaimedProfileForEmail[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            isActive: true,
            email: { not: null },
            emailSentAt: null,
            emailUnsubscribedAt: null,
            claimedAt: null,
            OR: [
                { campaignId: campaign.id },
                { campaignId: null }, // Include unassigned profiles matching criteria
            ],
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

        const profiles = await prisma.unclaimedProfile.findMany({
            where,
            take: limit,
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                fullName: true,
                email: true,
                matricula: true,
                profession: true,
                province: true,
                source: true,
            },
        });

        return profiles.filter((p: { email: string | null }) => p.email !== null) as UnclaimedProfileForEmail[];
    }

    /**
     * Generate claim URL with profile identifier
     */
    private generateClaimUrl(profile: UnclaimedProfileForEmail): string {
        const params = new URLSearchParams();
        if (profile.matricula) {
            params.set('m', profile.matricula);
        } else {
            params.set('id', profile.id);
        }
        params.set('utm_source', 'email');
        params.set('utm_medium', 'outreach');
        params.set('utm_campaign', 'claim');
        return `${BASE_URL}/reclamar?${params.toString()}`;
    }

    /**
     * Generate unsubscribe URL
     */
    private generateUnsubscribeUrl(profileId: string): string {
        return `${BASE_URL}/api/unsubscribe?id=${profileId}`;
    }

    /**
     * Get human-readable authority name from source
     */
    private getAuthorityName(source: string): string {
        const authorities: Record<string, string> = {
            'ERSEP': 'ERSEP Córdoba',
            'CACAAV': 'CACAAV Nacional',
            'GASNOR': 'GASNOR Noroeste',
            'GASNEA': 'GASNEA Noreste',
            'ENARGAS': 'ENARGAS Nacional',
            'MANUAL': 'Registro de Matriculados',
        };
        return authorities[source] || source;
    }

    /**
     * Generate HTML email content
     */
    private generateClaimEmailHTML(data: {
        name: string;
        matricula: string;
        authority: string;
        profession: string;
        claimUrl: string;
        unsubscribeUrl: string;
    }): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reclamá tu perfil en CampoTech</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px;">
                            <img src="${BASE_URL}/logo.png" alt="CampoTech" width="150" style="display: block;">
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
                                👋 Hola ${data.name},
                            </h1>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                Encontramos tu matrícula <strong style="color: #059669;">${data.matricula}</strong> en los registros de <strong>${data.authority}</strong>.
                            </p>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                Tu perfil profesional como <strong>${data.profession}</strong> ya está listo en CampoTech. Solo necesitás reclamarlo para:
                            </p>
                            
                            <!-- Benefits Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="color: #059669; font-size: 15px; margin: 0 0 12px;">✅ Facturar con AFIP en 2 clicks</p>
                                        <p style="color: #059669; font-size: 15px; margin: 0 0 12px;">✅ Recibir pedidos de clientes por WhatsApp</p>
                                        <p style="color: #059669; font-size: 15px; margin: 0 0 12px;">✅ Control de inventario y materiales</p>
                                        <p style="color: #059669; font-size: 15px; margin: 0;">✅ Perfil público verificado con tu matrícula</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 24px;">
                                <strong>Probá GRATIS por 21 días.</strong> Sin tarjeta de crédito.
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="${data.claimUrl}" 
                                           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; padding: 16px 48px; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                                            Reclamar mi perfil →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; border-top: 1px solid #e5e7eb; margin-top: 40px;">
                            <p style="color: #6b7280; font-size: 14px; line-height: 22px; margin: 0 0 16px;">
                                ¿Preguntas? Respondé este email o escribinos por WhatsApp al +54 9 351 XXX-XXXX.
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; line-height: 20px; margin: 0;">
                                Recibís este email porque tu matrícula profesional está registrada en ${data.authority}.
                                <br>
                                <a href="${data.unsubscribeUrl}" style="color: #9ca3af;">Dar de baja</a> • 
                                <a href="${BASE_URL}/privacy" style="color: #9ca3af;">Política de Privacidad</a>
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">
                                © 2026 CampoTech. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
    }

    /**
     * Generate plain text email content
     */
    private generateClaimEmailText(data: {
        name: string;
        matricula: string;
        claimUrl: string;
        unsubscribeUrl: string;
    }): string {
        return `
Hola ${data.name},

Encontramos tu matrícula ${data.matricula} en los registros profesionales.

Tu perfil ya está listo en CampoTech. Solo necesitás reclamarlo para:

✅ Facturar con AFIP en 2 clicks
✅ Recibir pedidos de clientes por WhatsApp
✅ Control de inventario y materiales
✅ Perfil público verificado con tu matrícula

Probá GRATIS por 21 días. Sin tarjeta de crédito.

👉 Reclamá tu perfil: ${data.claimUrl}

¿Preguntas? Respondé este email.

---
Para dejar de recibir estos emails: ${data.unsubscribeUrl}

© 2026 CampoTech
`;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

let emailOutreachServiceInstance: EmailOutreachService | null = null;

export function getEmailOutreachService(): EmailOutreachService {
    if (!emailOutreachServiceInstance) {
        emailOutreachServiceInstance = new EmailOutreachService();
    }
    return emailOutreachServiceInstance;
}

export default EmailOutreachService;
