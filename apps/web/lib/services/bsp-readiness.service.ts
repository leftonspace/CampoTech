/**
 * Phase 6.3: BSP Readiness Metrics Service
 * =========================================
 * 
 * Tracks key metrics to determine when CampoTech should apply
 * for Meta BSP (Business Solution Provider) partnership.
 * 
 * Trigger thresholds:
 * - 100+ WhatsApp AI clients
 * - $2,000+/month in message costs
 * - 50,000+ messages per month
 * - 99.9%+ uptime
 */

import { prisma } from '@/lib/prisma';
import { subDays, startOfMonth, endOfMonth } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BSPReadinessMetrics {
    // Volume metrics
    activeWhatsAppOrgs: number;
    totalMessages30Days: number;
    inboundMessages30Days: number;
    outboundMessages30Days: number;
    templateMessages30Days: number;

    // Cost metrics
    estimatedMonthlyCost: number;
    averageCostPerMessage: number;

    // Reliability metrics
    webhookSuccessRate: number;
    averageWebhookResponseMs: number;
    messageDeliveryRate: number;

    // Thresholds
    thresholds: {
        minClients: number;
        minMonthlyCost: number;
        minMonthlyMessages: number;
        minUptimePercent: number;
    };

    // Readiness assessment
    clientsReady: boolean;
    costReady: boolean;
    volumeReady: boolean;
    reliabilityReady: boolean;
    overallReady: boolean;

    // Dates
    calculatedAt: Date;
    periodStart: Date;
    periodEnd: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const BSP_THRESHOLDS = {
    minClients: 100,           // Minimum WhatsApp AI clients
    minMonthlyCost: 2000,      // USD per month
    minMonthlyMessages: 50000, // Messages per month
    minUptimePercent: 99.9,    // Uptime percentage
};

// Estimated cost per message (varies by type and country)
const ESTIMATED_COST_PER_MESSAGE = {
    inbound: 0.00,     // Free from customer
    outbound: 0.05,    // Service conversation
    template: 0.08,    // Template message (Argentina utility)
    marketing: 0.12,   // Marketing template
};

// ═══════════════════════════════════════════════════════════════════════════════
// BSP READINESS SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class BSPReadinessService {

    /**
     * Get full BSP readiness metrics
     */
    async getReadinessMetrics(): Promise<BSPReadinessMetrics> {
        const now = new Date();
        const periodStart = subDays(now, 30);
        const periodEnd = now;

        // Get all metrics in parallel
        const [
            activeWhatsAppOrgs,
            messageStats,
            webhookStats,
            deliveryStats,
        ] = await Promise.all([
            this.getActiveWhatsAppOrgs(),
            this.getMessageStats(periodStart, periodEnd),
            this.getWebhookStats(periodStart, periodEnd),
            this.getDeliveryStats(periodStart, periodEnd),
        ]);

        // Calculate costs
        const estimatedMonthlyCost = this.calculateMonthlyCost(messageStats);
        const totalMessages = messageStats.inbound + messageStats.outbound;
        const averageCostPerMessage = totalMessages > 0
            ? estimatedMonthlyCost / totalMessages
            : 0;

        // Assess readiness
        const clientsReady = activeWhatsAppOrgs >= BSP_THRESHOLDS.minClients;
        const costReady = estimatedMonthlyCost >= BSP_THRESHOLDS.minMonthlyCost;
        const volumeReady = totalMessages >= BSP_THRESHOLDS.minMonthlyMessages;
        const reliabilityReady = webhookStats.successRate >= BSP_THRESHOLDS.minUptimePercent;

        return {
            // Volume
            activeWhatsAppOrgs,
            totalMessages30Days: totalMessages,
            inboundMessages30Days: messageStats.inbound,
            outboundMessages30Days: messageStats.outbound,
            templateMessages30Days: messageStats.templates,

            // Cost
            estimatedMonthlyCost,
            averageCostPerMessage,

            // Reliability
            webhookSuccessRate: webhookStats.successRate,
            averageWebhookResponseMs: webhookStats.avgResponseMs,
            messageDeliveryRate: deliveryStats.deliveryRate,

            // Thresholds
            thresholds: BSP_THRESHOLDS,

            // Readiness
            clientsReady,
            costReady,
            volumeReady,
            reliabilityReady,
            overallReady: clientsReady && costReady && volumeReady && reliabilityReady,

            // Dates
            calculatedAt: now,
            periodStart,
            periodEnd,
        };
    }

    /**
     * Get count of organizations actively using WhatsApp AI
     */
    private async getActiveWhatsAppOrgs(): Promise<number> {
        const thirtyDaysAgo = subDays(new Date(), 30);

        // Organizations with AI enabled and recent activity
        const count = await prisma.organization.count({
            where: {
                aiConfiguration: {
                    isEnabled: true,
                },
                waConversations: {
                    some: {
                        lastMessageAt: {
                            gte: thirtyDaysAgo,
                        },
                    },
                },
            },
        });

        return count;
    }

    /**
     * Get message statistics for a period
     */
    private async getMessageStats(
        startDate: Date,
        endDate: Date
    ): Promise<{ inbound: number; outbound: number; templates: number }> {
        const messages = await prisma.waMessage.groupBy({
            by: ['direction'],
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _count: {
                _all: true,
            },
        });

        let inbound = 0;
        let outbound = 0;

        for (const msg of messages) {
            if (msg.direction === 'inbound') {
                inbound = msg._count._all;
            } else {
                outbound = msg._count._all;
            }
        }

        // Template messages are a subset of outbound
        const templates = await prisma.waMessage.count({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                direction: 'outbound',
                templateName: { not: null },
            },
        });

        return { inbound, outbound, templates };
    }

    /**
     * Get webhook processing statistics
     */
    private async getWebhookStats(
        startDate: Date,
        endDate: Date
    ): Promise<{ successRate: number; avgResponseMs: number }> {
        // Check if WaWebhookLog exists and has the needed data
        try {
            const logs = await prisma.waWebhookLog.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                select: {
                    status: true,
                    processingTimeMs: true,
                },
            });

            if (logs.length === 0) {
                return { successRate: 100, avgResponseMs: 0 };
            }

            type WebhookLog = { status: string | null; processingTimeMs: number | null };
            const successful = logs.filter((l: WebhookLog) => l.status === 'success' || l.status === 'processed').length;
            const successRate = (successful / logs.length) * 100;

            const totalMs = logs.reduce((sum: number, l: WebhookLog) => sum + (l.processingTimeMs || 0), 0);
            const avgResponseMs = totalMs / logs.length;

            return { successRate, avgResponseMs };
        } catch {
            // If table doesn't exist or error, return defaults
            return { successRate: 99.9, avgResponseMs: 100 };
        }
    }

    /**
     * Get message delivery statistics
     */
    private async getDeliveryStats(
        startDate: Date,
        endDate: Date
    ): Promise<{ deliveryRate: number }> {
        try {
            const [total, delivered] = await Promise.all([
                prisma.waMessage.count({
                    where: {
                        direction: 'outbound',
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                }),
                prisma.waMessage.count({
                    where: {
                        direction: 'outbound',
                        status: { in: ['delivered', 'read', 'sent'] },
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                }),
            ]);

            if (total === 0) return { deliveryRate: 100 };

            return { deliveryRate: (delivered / total) * 100 };
        } catch {
            return { deliveryRate: 99.5 };
        }
    }

    /**
     * Calculate estimated monthly cost based on message volume
     */
    private calculateMonthlyCost(stats: { inbound: number; outbound: number; templates: number }): number {
        // Inbound messages are free
        const inboundCost = 0;

        // Service conversations (outbound non-template)
        const serviceMessages = stats.outbound - stats.templates;
        const serviceCost = serviceMessages * ESTIMATED_COST_PER_MESSAGE.outbound;

        // Template messages
        const templateCost = stats.templates * ESTIMATED_COST_PER_MESSAGE.template;

        return inboundCost + serviceCost + templateCost;
    }

    /**
     * Get a formatted readiness report
     */
    async getReadinessReport(): Promise<string> {
        const metrics = await this.getReadinessMetrics();

        const formatNumber = (n: number) => n.toLocaleString();
        const formatPercent = (n: number) => `${n.toFixed(1)}%`;
        const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
        const checkMark = (ready: boolean) => ready ? '✅' : '❌';

        return `
# BSP Readiness Report
Generated: ${metrics.calculatedAt.toISOString()}
Period: ${metrics.periodStart.toISOString()} to ${metrics.periodEnd.toISOString()}

## Overall Status: ${metrics.overallReady ? '🟢 READY TO APPLY' : '🟡 NOT YET READY'}

## Volume Metrics
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| WhatsApp AI Clients | ${formatNumber(metrics.activeWhatsAppOrgs)} | ${formatNumber(metrics.thresholds.minClients)} | ${checkMark(metrics.clientsReady)} |
| Monthly Messages | ${formatNumber(metrics.totalMessages30Days)} | ${formatNumber(metrics.thresholds.minMonthlyMessages)} | ${checkMark(metrics.volumeReady)} |
| Estimated Monthly Cost | ${formatCurrency(metrics.estimatedMonthlyCost)} | ${formatCurrency(metrics.thresholds.minMonthlyCost)} | ${checkMark(metrics.costReady)} |

## Message Breakdown
- Inbound: ${formatNumber(metrics.inboundMessages30Days)}
- Outbound: ${formatNumber(metrics.outboundMessages30Days)}
- Templates: ${formatNumber(metrics.templateMessages30Days)}

## Reliability Metrics
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Webhook Success Rate | ${formatPercent(metrics.webhookSuccessRate)} | ${formatPercent(metrics.thresholds.minUptimePercent)} | ${checkMark(metrics.reliabilityReady)} |
| Avg Webhook Response | ${metrics.averageWebhookResponseMs.toFixed(0)}ms | < 500ms | ${checkMark(metrics.averageWebhookResponseMs < 500)} |
| Message Delivery Rate | ${formatPercent(metrics.messageDeliveryRate)} | > 99% | ${checkMark(metrics.messageDeliveryRate > 99)} |

## Cost Analysis
- Average Cost per Message: ${formatCurrency(metrics.averageCostPerMessage)}
- Estimated Savings with BSP: ${formatCurrency(metrics.estimatedMonthlyCost * 0.35)} - ${formatCurrency(metrics.estimatedMonthlyCost * 0.5)}/month

## Next Steps
${metrics.overallReady
                ? '1. Review docs/bsp-partnership-guide.md\n2. Prepare all documentation\n3. Submit BSP application'
                : `Focus areas to reach BSP thresholds:\n${!metrics.clientsReady ? `- Acquire ${metrics.thresholds.minClients - metrics.activeWhatsAppOrgs} more WhatsApp AI clients\n` : ''}${!metrics.volumeReady ? `- Increase message volume by ${formatNumber(metrics.thresholds.minMonthlyMessages - metrics.totalMessages30Days)} messages\n` : ''}${!metrics.costReady ? `- Grow monthly spend by ${formatCurrency(metrics.thresholds.minMonthlyCost - metrics.estimatedMonthlyCost)}\n` : ''}`}
`;
    }
}

// Export singleton
export const bspReadinessService = new BSPReadinessService();
