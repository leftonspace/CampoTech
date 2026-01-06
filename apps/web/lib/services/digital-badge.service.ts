/**
 * Digital Badge Service
 * =====================
 * 
 * Phase 4.3 Task 4.3.2: Digital Entry Badge System
 * 
 * Generates and manages digital badges for technicians entering
 * gated communities (Countries). Includes ART insurance and
 * background check verification.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { differenceInDays, addDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ARTStatus = 'valid' | 'expiring' | 'expired' | 'missing';

export interface BadgeVerification {
    artStatus: ARTStatus;
    artExpiry: Date | null;
    artProvider: string | null;
    artPolicyNumber: string | null;
    backgroundCheck: string;
    backgroundCheckDate: Date | null;
    backgroundCheckProvider: string | null;
}

export interface BadgeData {
    technician: {
        id: string;
        name: string;
        photo: string | null;
        specialty: string | null;
        phone: string;
    };
    organization: {
        id: string;
        name: string;
        logo: string | null;
    };
    verification: BadgeVerification;
    qrPayload: string;
    generatedAt: Date;
    validUntil: Date | null;
    isValid: boolean;
}

export interface BadgeVerificationResult {
    valid: boolean;
    expired: boolean;
    notFound: boolean;
    badge: BadgeData | null;
    verifiedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DigitalBadgeService {
    private static readonly BADGE_TOKEN_VALIDITY_DAYS = 30;
    private static readonly ART_EXPIRY_WARNING_DAYS = 30;

    /**
     * Generate badge data for a user
     */
    async generateBadgeData(userId: string): Promise<BadgeData> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Generate or refresh badge token if expired
        if (!user.badgeToken || !user.badgeTokenExpiresAt || user.badgeTokenExpiresAt < new Date()) {
            await this.refreshBadgeToken(userId);
            // Re-fetch to get the new token
            const updatedUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { badgeToken: true, badgeTokenExpiresAt: true },
            });
            if (updatedUser) {
                user.badgeToken = updatedUser.badgeToken;
                user.badgeTokenExpiresAt = updatedUser.badgeTokenExpiresAt;
            }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

        return {
            technician: {
                id: user.id,
                name: user.name,
                photo: user.avatar,
                specialty: user.specialty,
                phone: user.phone,
            },
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                logo: user.organization.logo,
            },
            verification: {
                artStatus: this.getARTStatus(user.artExpiryDate),
                artExpiry: user.artExpiryDate,
                artProvider: user.artProvider,
                artPolicyNumber: user.artPolicyNumber,
                backgroundCheck: user.backgroundCheckStatus,
                backgroundCheckDate: user.backgroundCheckDate,
                backgroundCheckProvider: user.backgroundCheckProvider,
            },
            qrPayload: `${appUrl}/verify-badge/${user.badgeToken}`,
            generatedAt: new Date(),
            validUntil: user.badgeTokenExpiresAt,
            isValid: this.isBadgeValid(user),
        };
    }

    /**
     * Verify a badge by token (for security guards scanning QR)
     */
    async verifyBadge(token: string): Promise<BadgeVerificationResult> {
        const user = await prisma.user.findUnique({
            where: { badgeToken: token },
            include: { organization: true },
        });

        // Badge not found
        if (!user) {
            return {
                valid: false,
                expired: false,
                notFound: true,
                badge: null,
                verifiedAt: new Date(),
            };
        }

        // Check if token is expired
        const isExpired = user.badgeTokenExpiresAt ? user.badgeTokenExpiresAt < new Date() : true;

        if (isExpired) {
            return {
                valid: false,
                expired: true,
                notFound: false,
                badge: null,
                verifiedAt: new Date(),
            };
        }

        // Return badge data
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

        return {
            valid: true,
            expired: false,
            notFound: false,
            badge: {
                technician: {
                    id: user.id,
                    name: user.name,
                    photo: user.avatar,
                    specialty: user.specialty,
                    phone: user.phone,
                },
                organization: {
                    id: user.organization.id,
                    name: user.organization.name,
                    logo: user.organization.logo,
                },
                verification: {
                    artStatus: this.getARTStatus(user.artExpiryDate),
                    artExpiry: user.artExpiryDate,
                    artProvider: user.artProvider,
                    artPolicyNumber: user.artPolicyNumber,
                    backgroundCheck: user.backgroundCheckStatus,
                    backgroundCheckDate: user.backgroundCheckDate,
                    backgroundCheckProvider: user.backgroundCheckProvider,
                },
                qrPayload: `${appUrl}/verify-badge/${user.badgeToken}`,
                generatedAt: new Date(),
                validUntil: user.badgeTokenExpiresAt,
                isValid: this.isBadgeValid(user),
            },
            verifiedAt: new Date(),
        };
    }

    /**
     * Refresh badge token (generates new secure token valid for 30 days)
     */
    async refreshBadgeToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = addDays(new Date(), DigitalBadgeService.BADGE_TOKEN_VALIDITY_DAYS);

        await prisma.user.update({
            where: { id: userId },
            data: {
                badgeToken: token,
                badgeTokenExpiresAt: expiresAt,
            },
        });

        return { token, expiresAt };
    }

    /**
     * Update ART certificate information
     */
    async updateARTCertificate(
        userId: string,
        data: {
            certificateUrl: string;
            expiryDate: Date;
            provider: string;
            policyNumber: string;
        }
    ): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                artCertificateUrl: data.certificateUrl,
                artExpiryDate: data.expiryDate,
                artProvider: data.provider,
                artPolicyNumber: data.policyNumber,
            },
        });
    }

    /**
     * Update background check status
     */
    async updateBackgroundCheck(
        userId: string,
        data: {
            status: 'pending' | 'approved' | 'rejected' | 'expired';
            provider?: string;
        }
    ): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                backgroundCheckStatus: data.status,
                backgroundCheckDate: data.status === 'approved' ? new Date() : undefined,
                backgroundCheckProvider: data.provider,
            },
        });
    }

    /**
     * Get users with expiring ART certificates (for notifications)
     */
    async getUsersWithExpiringART(
        organizationId: string,
        daysUntilExpiry: number = 30
    ): Promise<Array<{ id: string; name: string; artExpiryDate: Date; daysRemaining: number }>> {
        const warningDate = addDays(new Date(), daysUntilExpiry);

        const users = await prisma.user.findMany({
            where: {
                organizationId,
                artExpiryDate: {
                    lte: warningDate,
                    gte: new Date(), // Not already expired
                },
            },
            select: {
                id: true,
                name: true,
                artExpiryDate: true,
            },
        });

        return users.map((user: { id: string; name: string; artExpiryDate: Date | null }) => ({
            id: user.id,
            name: user.name,
            artExpiryDate: user.artExpiryDate!,
            daysRemaining: differenceInDays(user.artExpiryDate!, new Date()),
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    private getARTStatus(artExpiryDate: Date | null): ARTStatus {
        if (!artExpiryDate) return 'missing';

        const daysUntilExpiry = differenceInDays(artExpiryDate, new Date());

        if (daysUntilExpiry < 0) return 'expired';
        if (daysUntilExpiry < DigitalBadgeService.ART_EXPIRY_WARNING_DAYS) return 'expiring';
        return 'valid';
    }

    private isBadgeValid(user: {
        artExpiryDate: Date | null;
        backgroundCheckStatus: string;
        isActive: boolean;
    }): boolean {
        // Badge is valid if:
        // 1. User is active
        // 2. ART is not expired (can be missing or expiring but not expired)
        // 3. Background check is approved
        if (!user.isActive) return false;

        const artStatus = this.getARTStatus(user.artExpiryDate);
        if (artStatus === 'expired') return false;

        if (user.backgroundCheckStatus !== 'approved') return false;

        return true;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let digitalBadgeServiceInstance: DigitalBadgeService | null = null;

export function getDigitalBadgeService(): DigitalBadgeService {
    if (!digitalBadgeServiceInstance) {
        digitalBadgeServiceInstance = new DigitalBadgeService();
    }
    return digitalBadgeServiceInstance;
}

export default DigitalBadgeService;
