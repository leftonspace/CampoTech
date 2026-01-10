/**
 * Phase 4.8: WhatsApp Credits Service
 * =====================================
 * 
 * Manages credit-based WhatsApp AI conversations.
 * 
 * Key Features:
 * - Credit deduction for AI conversations
 * - One-time grace period (50 credits when balance hits 0)
 * - Grace forfeit on purchase (if unused)
 * - Alert thresholds (75%, 90%, 100%)
 * - Status transitions: inactive → active → grace → exhausted
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreditUsageResult {
    success: boolean;
    mode: 'paid' | 'grace' | 'exhausted';
    creditsRemaining: number;
    graceRemaining?: number;
    message?: string;
}

export interface CreditAccountInfo {
    balance: number;
    lifetimeCredits: number;
    lifetimeUsed: number;
    status: string;
    graceCredits: number;
    graceUsed: number;
    graceEverActivated: boolean;
    graceForfeited: boolean;
    bspStatus: string;
    bspPhoneNumber: string | null;
}

interface CreditPackage {
    name: string;
    credits: number;
    priceARS: number;
    priceUSD: number;
    description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
    starter: {
        name: 'Starter',
        credits: 200,
        priceARS: 12000,
        priceUSD: 12,
        description: '200 conversaciones de IA',
    },
    standard: {
        name: 'Standard',
        credits: 500,
        priceARS: 25000,
        priceUSD: 25,
        description: '500 conversaciones de IA - Mejor valor',
    },
    professional: {
        name: 'Profesional',
        credits: 1000,
        priceARS: 45000,
        priceUSD: 45,
        description: '1000 conversaciones de IA',
    },
    enterprise: {
        name: 'Empresa',
        credits: 5000,
        priceARS: 175000,
        priceUSD: 175,
        description: '5000 conversaciones de IA - Mayor ahorro',
    },
};

const GRACE_CREDITS_TOTAL = 50;

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP CREDITS SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class WhatsAppCreditsService {

    // ═══════════════════════════════════════════════════════════════════════════
    // GET OR CREATE ACCOUNT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get or create a WhatsApp credits account for an organization
     */
    async getOrCreateAccount(organizationId: string) {
        let account = await prisma.whatsAppCredits.findUnique({
            where: { organizationId },
        });

        if (!account) {
            account = await prisma.whatsAppCredits.create({
                data: {
                    organizationId,
                    graceCredits: GRACE_CREDITS_TOTAL,
                },
            });
        }

        return account;
    }

    /**
     * Get account info for display
     */
    async getAccountInfo(organizationId: string): Promise<CreditAccountInfo | null> {
        const account = await this.getOrCreateAccount(organizationId);

        return {
            balance: account.balance,
            lifetimeCredits: account.lifetimeCredits,
            lifetimeUsed: account.lifetimeUsed,
            status: account.status,
            graceCredits: account.graceCredits,
            graceUsed: account.graceUsed,
            graceEverActivated: account.graceEverActivated,
            graceForfeited: account.graceForfeited,
            bspStatus: account.bspStatus,
            bspPhoneNumber: account.bspPhoneNumber,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USE CREDIT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Deduct a credit for an AI conversation
     * Returns false if no credits available (triggers wa.me fallback)
     * 
     * Logic:
     * 1. Has paid credits → use them
     * 2. No paid credits + eligible for grace → activate grace (ONE-TIME ONLY)
     * 3. Using grace → deduct from grace
     * 4. Grace exhausted → return false, status = exhausted
     */
    async useCredit(
        organizationId: string,
        conversationId?: string
    ): Promise<CreditUsageResult> {
        const account = await this.getOrCreateAccount(organizationId);

        // Case 1: Has paid credits → use them
        if (account.balance > 0) {
            const updated = await prisma.whatsAppCredits.update({
                where: { id: account.id },
                data: {
                    balance: { decrement: 1 },
                    lifetimeUsed: { increment: 1 },
                    status: 'active',
                },
            });

            // Log usage
            await this.logUsage(account.id, {
                creditsUsed: 1,
                usageType: 'ai_conversation',
                balanceBefore: account.balance,
                balanceAfter: updated.balance,
                wasGraceCredit: false,
                conversationId,
            });

            // Check for low balance alerts
            await this.checkAlerts(organizationId);

            return {
                success: true,
                mode: 'paid',
                creditsRemaining: updated.balance,
                message: `Credit used. ${updated.balance} remaining.`,
            };
        }

        // Case 2: No paid credits → check grace eligibility
        // ⚠️ GRACE IS ONE-TIME ONLY
        if (!account.graceEverActivated && !account.graceForfeited) {
            // First time hitting 0 → activate grace
            if (!account.graceActivatedAt) {
                await prisma.whatsAppCredits.update({
                    where: { id: account.id },
                    data: {
                        graceActivatedAt: new Date(),
                        graceEverActivated: true, // NEVER AGAIN ELIGIBLE
                        status: 'grace',
                        statusChangedAt: new Date(),
                    },
                });

                // Send notification
                await this.notifyGraceActivated(organizationId);

                console.log(`[WhatsApp Credits] Grace activated for org ${organizationId}`);
            }
        }

        // Case 3: Check if has grace credits available
        const refreshedAccount = await prisma.whatsAppCredits.findUnique({
            where: { id: account.id },
        });

        if (refreshedAccount &&
            refreshedAccount.graceEverActivated &&
            !refreshedAccount.graceForfeited &&
            refreshedAccount.graceUsed < refreshedAccount.graceCredits) {

            const updated = await prisma.whatsAppCredits.update({
                where: { id: refreshedAccount.id },
                data: {
                    graceUsed: { increment: 1 },
                    lifetimeUsed: { increment: 1 },
                },
            });

            // Log grace usage
            await this.logUsage(refreshedAccount.id, {
                creditsUsed: 1,
                usageType: 'ai_conversation',
                balanceBefore: 0,
                balanceAfter: 0,
                wasGraceCredit: true,
                conversationId,
                description: `Grace credit ${updated.graceUsed}/${updated.graceCredits}`,
            });

            const graceRemaining = updated.graceCredits - updated.graceUsed;

            return {
                success: true,
                mode: 'grace',
                creditsRemaining: 0,
                graceRemaining,
                message: `Using grace credit. ${graceRemaining} grace credits remaining.`,
            };
        }

        // Case 4: Grace exhausted OR never eligible → wa.me fallback
        await prisma.whatsAppCredits.update({
            where: { id: account.id },
            data: {
                status: 'exhausted',
                statusChangedAt: new Date(),
            },
        });

        return {
            success: false,
            mode: 'exhausted',
            creditsRemaining: 0,
            message: 'No credits available. Falling back to wa.me link.',
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PURCHASE CREDITS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a purchase record (called when initiating payment)
     */
    async initiatePurchase(
        organizationId: string,
        packageName: string
    ): Promise<{ purchaseId: string; package: CreditPackage }> {
        const pkg = CREDIT_PACKAGES[packageName];
        if (!pkg) {
            throw new Error(`Invalid package: ${packageName}`);
        }

        const account = await this.getOrCreateAccount(organizationId);

        const purchase = await prisma.creditPurchase.create({
            data: {
                creditsAccountId: account.id,
                credits: pkg.credits,
                amountPaid: pkg.priceARS,
                currency: 'ARS',
                pricePerCredit: pkg.priceARS / pkg.credits,
                packageName: pkg.name,
                status: 'pending',
            },
        });

        return {
            purchaseId: purchase.id,
            package: pkg,
        };
    }

    /**
     * Complete a purchase - add credits after payment confirmed
     * ⚠️ If grace was activated but unused credits remain, FORFEIT THEM
     */
    async completePurchase(purchaseId: string): Promise<void> {
        const purchase = await prisma.creditPurchase.findUnique({
            where: { id: purchaseId },
            include: { creditsAccount: true },
        });

        if (!purchase) {
            throw new Error('Purchase not found');
        }

        if (purchase.status === 'completed') {
            console.log(`[WhatsApp Credits] Purchase ${purchaseId} already completed`);
            return;
        }

        const account = purchase.creditsAccount;

        // ⚠️ FORFEIT GRACE if activated but not fully used
        const shouldForfeitGrace = account.graceEverActivated &&
            account.graceUsed < account.graceCredits;

        await prisma.$transaction([
            // Update purchase status
            prisma.creditPurchase.update({
                where: { id: purchaseId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            }),
            // Add credits to account
            prisma.whatsAppCredits.update({
                where: { id: account.id },
                data: {
                    balance: { increment: purchase.credits },
                    lifetimeCredits: { increment: purchase.credits },
                    status: 'active',
                    statusChangedAt: new Date(),
                    // Reset alerts for new cycle
                    alert75SentAt: null,
                    alert90SentAt: null,
                    alert100SentAt: null,
                    // ⚠️ Forfeit unused grace credits
                    graceForfeited: shouldForfeitGrace,
                },
            }),
        ]);

        // Log the purchase
        await this.logUsage(account.id, {
            creditsUsed: -purchase.credits, // Negative = added
            usageType: 'ai_conversation',
            balanceBefore: account.balance,
            balanceAfter: account.balance + purchase.credits,
            wasGraceCredit: false,
            description: `Purchased ${purchase.packageName} package: +${purchase.credits} credits`,
        });

        if (shouldForfeitGrace) {
            const unusedGrace = account.graceCredits - account.graceUsed;
            console.log(`[WhatsApp Credits] Forfeited ${unusedGrace} unused grace credits for org ${account.organizationId}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ALERTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Check credit levels and send alerts at 75%, 90%, 100% thresholds
     */
    async checkAlerts(organizationId: string): Promise<void> {
        const account = await prisma.whatsAppCredits.findUnique({
            where: { organizationId },
        });

        if (!account || account.lifetimeCredits === 0) return;

        const usagePercent = (account.lifetimeUsed / account.lifetimeCredits) * 100;
        const remaining = account.balance;

        // 75% used - First warning
        if (usagePercent >= 75 && !account.alert75SentAt) {
            await this.sendAlert(organizationId, '75%', remaining);
            await prisma.whatsAppCredits.update({
                where: { id: account.id },
                data: { alert75SentAt: new Date() },
            });
        }

        // 90% used - Urgent warning
        if (usagePercent >= 90 && !account.alert90SentAt) {
            await this.sendAlert(organizationId, '90%', remaining);
            await prisma.whatsAppCredits.update({
                where: { id: account.id },
                data: { alert90SentAt: new Date() },
            });
        }

        // 100% used - Credits exhausted
        if (remaining === 0 && !account.alert100SentAt) {
            await this.sendAlert(organizationId, '100%', 0);
            await prisma.whatsAppCredits.update({
                where: { id: account.id },
                data: { alert100SentAt: new Date() },
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Admin: Add credits manually (for support/refunds/promotions)
     */
    async addCreditsManually(
        organizationId: string,
        credits: number,
        reason: string
    ): Promise<void> {
        const account = await this.getOrCreateAccount(organizationId);

        await prisma.whatsAppCredits.update({
            where: { id: account.id },
            data: {
                balance: { increment: credits },
                lifetimeCredits: { increment: credits },
                status: credits > 0 ? 'active' : undefined,
                statusChangedAt: credits > 0 ? new Date() : undefined,
            },
        });

        await this.logUsage(account.id, {
            creditsUsed: -credits,
            usageType: 'ai_conversation', // Will be mapped to admin_adjustment
            balanceBefore: account.balance,
            balanceAfter: account.balance + credits,
            wasGraceCredit: false,
            description: `Admin adjustment: ${reason}`,
        });

        console.log(`[WhatsApp Credits] Admin added ${credits} credits to org ${organizationId}: ${reason}`);
    }

    /**
     * Get purchase history for an organization
     */
    async getPurchaseHistory(organizationId: string) {
        const account = await prisma.whatsAppCredits.findUnique({
            where: { organizationId },
            include: {
                purchases: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        return account?.purchases || [];
    }

    /**
     * Get all accounts with low balance
     */
    async getAccountsWithLowBalance(threshold: number = 50) {
        return prisma.whatsAppCredits.findMany({
            where: {
                balance: { lte: threshold },
                status: 'active',
            },
            include: {
                organization: {
                    select: { name: true, email: true },
                },
            },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    private async logUsage(
        creditsAccountId: string,
        data: {
            creditsUsed: number;
            usageType: string;
            balanceBefore: number;
            balanceAfter: number;
            wasGraceCredit: boolean;
            conversationId?: string;
            description?: string;
        }
    ): Promise<void> {
        await prisma.creditUsageLog.create({
            data: {
                creditsAccountId,
                creditsUsed: data.creditsUsed,
                usageType: data.usageType as 'ai_conversation' | 'ai_followup' | 'template_message',
                balanceBefore: data.balanceBefore,
                balanceAfter: data.balanceAfter,
                wasGraceCredit: data.wasGraceCredit,
                conversationId: data.conversationId,
                description: data.description,
            },
        });
    }

    private async sendAlert(
        organizationId: string,
        threshold: string,
        remaining: number
    ): Promise<void> {
        const { sendCreditWarningEmail } = await import('@/lib/email/credit-alert-emails');

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true, email: true },
        });

        if (!organization?.email) {
            console.warn(`[WhatsApp Credits] No email for org ${organizationId}, skipping alert`);
            return;
        }

        try {
            await sendCreditWarningEmail({
                to: organization.email,
                organizationName: organization.name,
                threshold,
                remaining,
            });

            console.log(`[WhatsApp Credits] Sent ${threshold} alert to ${organization.email}`);
        } catch (error) {
            console.error(`[WhatsApp Credits] Failed to send alert email:`, error);
        }
    }

    private async notifyGraceActivated(organizationId: string): Promise<void> {
        const { sendGraceActivatedEmail } = await import('@/lib/email/credit-alert-emails');

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true, email: true },
        });

        if (!organization?.email) {
            console.warn(`[WhatsApp Credits] No email for org ${organizationId}, skipping grace notification`);
            return;
        }

        try {
            await sendGraceActivatedEmail({
                to: organization.email,
                organizationName: organization.name,
                graceCredits: GRACE_CREDITS_TOTAL,
            });

            console.log(`[WhatsApp Credits] Sent grace activation email to ${organization.email}`);
        } catch (error) {
            console.error(`[WhatsApp Credits] Failed to send grace activation email:`, error);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

let whatsappCreditsServiceInstance: WhatsAppCreditsService | null = null;

export function getWhatsAppCreditsService(): WhatsAppCreditsService {
    if (!whatsappCreditsServiceInstance) {
        whatsappCreditsServiceInstance = new WhatsAppCreditsService();
    }
    return whatsappCreditsServiceInstance;
}

export default WhatsAppCreditsService;
