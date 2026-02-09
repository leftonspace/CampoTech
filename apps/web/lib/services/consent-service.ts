/**
 * CampoTech Consent Management Service
 * =====================================
 *
 * Handles user consent tracking per Ley 25.326 (Argentine Data Protection).
 * Implements version control and audit trail for all consent events.
 *
 * Consent Types:
 * - privacy_policy: Privacy policy acceptance
 * - terms_of_service: Terms of service acceptance
 * - marketing: Marketing communications consent
 * - data_processing: Data processing consent
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsentType = 'privacy_policy' | 'terms_of_service' | 'marketing' | 'data_processing';

export interface ConsentRecord {
    id: string;
    userId: string;
    consentType: ConsentType;
    version: string;
    granted: boolean;
    grantedAt: Date;
    withdrawnAt?: Date;
    ipAddress?: string;
    userAgent?: string;
}

export interface GrantConsentParams {
    userId: string;
    consentType: ConsentType;
    version: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

export interface WithdrawConsentParams {
    userId: string;
    consentType: ConsentType;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsentService {
    /**
     * Grant consent for a user
     */
    async grantConsent(params: GrantConsentParams): Promise<ConsentRecord> {
        const consent = await prisma.userConsentLog.create({
            data: {
                userId: params.userId,
                consentType: params.consentType,
                version: params.version,
                granted: true,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                metadata: params.metadata,
            },
        });

        console.log(
            `[Consent] User ${params.userId} granted ${params.consentType} v${params.version}`
        );

        return this.mapConsentRecord(consent);
    }

    /**
     * Withdraw consent for a user
     */
    async withdrawConsent(params: WithdrawConsentParams): Promise<ConsentRecord> {
        // Find the most recent active consent
        const existingConsent = await prisma.userConsentLog.findFirst({
            where: {
                userId: params.userId,
                consentType: params.consentType,
                granted: true,
                withdrawnAt: null,
            },
            orderBy: { grantedAt: 'desc' },
        });

        if (!existingConsent) {
            throw new Error(`No active ${params.consentType} consent found for user ${params.userId}`);
        }

        // Mark as withdrawn
        const withdrawn = await prisma.userConsentLog.update({
            where: { id: existingConsent.id },
            data: {
                granted: false,
                withdrawnAt: new Date(),
                metadata: {
                    ...(existingConsent.metadata as Record<string, unknown>),
                    withdrawalReason: params.reason,
                    withdrawalIp: params.ipAddress,
                    withdrawalUserAgent: params.userAgent,
                },
            },
        });

        console.log(
            `[Consent] User ${params.userId} withdrew ${params.consentType} v${existingConsent.version}`
        );

        return this.mapConsentRecord(withdrawn);
    }

    /**
     * Check if user has active consent for a specific type
     */
    async hasActiveConsent(userId: string, consentType: ConsentType): Promise<boolean> {
        const consent = await prisma.userConsentLog.findFirst({
            where: {
                userId,
                consentType,
                granted: true,
                withdrawnAt: null,
            },
            orderBy: { grantedAt: 'desc' },
        });

        return consent !== null;
    }

    /**
     * Get consent history for a user
     */
    async getConsentHistory(
        userId: string,
        consentType?: ConsentType
    ): Promise<ConsentRecord[]> {
        const consents = await prisma.userConsentLog.findMany({
            where: {
                userId,
                ...(consentType && { consentType }),
            },
            orderBy: { grantedAt: 'desc' },
        });

        return consents.map((c: typeof consents[0]) => this.mapConsentRecord({ ...c, metadata: c.metadata || undefined }));
    }

    /**
     * Get all active consents for a user
     */
    async getActiveConsents(userId: string): Promise<ConsentRecord[]> {
        const consents = await prisma.userConsentLog.findMany({
            where: {
                userId,
                granted: true,
                withdrawnAt: null,
            },
            orderBy: { grantedAt: 'desc' },
        });

        return consents.map((c: typeof consents[0]) => this.mapConsentRecord({ ...c, metadata: c.metadata || undefined }));
    }

    /**
     * Bulk grant consents (for registration flow)
     */
    async grantMultipleConsents(
        userId: string,
        consents: Array<{ type: ConsentType; version: string }>,
        ipAddress?: string,
        userAgent?: string
    ): Promise<ConsentRecord[]> {
        const records = await Promise.all(
            consents.map((consent) =>
                this.grantConsent({
                    userId,
                    consentType: consent.type,
                    version: consent.version,
                    ipAddress,
                    userAgent,
                })
            )
        );

        console.log(`[Consent] Granted ${consents.length} consents for user ${userId}`);

        return records;
    }

    /**
     * Helper to map database record to ConsentRecord
     */
    private mapConsentRecord(consent: {
        id: string;
        userId: string;
        consentType: string;
        version: string;
        granted: boolean;
        grantedAt: Date;
        withdrawnAt: Date | null;
        ipAddress: string | null;
        userAgent: string | null;
        metadata?: unknown;
    }): ConsentRecord {
        return {
            id: consent.id,
            userId: consent.userId,
            consentType: consent.consentType as ConsentType,
            version: consent.version,
            granted: consent.granted,
            grantedAt: consent.grantedAt,
            withdrawnAt: consent.withdrawnAt || undefined,
            ipAddress: consent.ipAddress || undefined,
            userAgent: consent.userAgent || undefined,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let consentServiceInstance: ConsentService | null = null;

export function getConsentService(): ConsentService {
    if (!consentServiceInstance) {
        consentServiceInstance = new ConsentService();
    }
    return consentServiceInstance;
}

export const consentService = getConsentService();

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENT POLICY VERSIONS
// Update these when policies change
// ═══════════════════════════════════════════════════════════════════════════════

export const CURRENT_POLICY_VERSIONS = {
    privacy_policy: '1.0',
    terms_of_service: '1.0',
    marketing: '1.0',
    data_processing: '1.0',
} as const;
