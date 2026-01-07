/**
 * Unclaimed Profile Service
 * =========================
 * 
 * Phase 4.4: Growth Engine - Unclaimed Profile System
 * 
 * Manages "ghost profiles" from scraped registry data (ERSEP, CACAAV, etc.)
 * Handles profile search, claim verification, and linking to user accounts.
 */

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Type alias for source enum values
type UnclaimedSource = 'ERSEP' | 'CACAAV' | 'GASNOR' | 'GASNEA' | 'ENARGAS' | 'MANUAL';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SearchResult {
    id: string;
    fullName: string;
    profession: string | null;
    source: string;
    province: string | null;
    city: string | null;
    matricula: string | null;
    // Masked contact info for privacy
    maskedPhone: string | null;
    maskedEmail: string | null;
    isClaimed: boolean;
}


export interface ClaimRequestResult {
    success: boolean;
    error?: string;
    verificationMethod?: 'phone' | 'email';
    maskedContact?: string;
    expiresInMinutes?: number;
}

export interface ClaimVerifyResult {
    success: boolean;
    error?: string;
    organizationId?: string;
    userId?: string;
}

export interface ProfileStats {
    total: number;
    bySource: Record<string, {
        total: number;
        withPhone: number;
        withEmail: number;
        claimed: number;
    }>;
    totalWithPhone: number;
    totalWithEmail: number;
    totalClaimed: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CLAIM_TOKEN_EXPIRY_MINUTES = 15;
const CLAIM_TOKEN_LENGTH = 32;
const OTP_LENGTH = 6;

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class UnclaimedProfileService {

    /**
     * Search for unclaimed profiles by matricula or name
     */
    async searchProfiles(query: string, source?: UnclaimedSource): Promise<SearchResult[]> {
        const profiles = await prisma.unclaimedProfile.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { matricula: { contains: query, mode: 'insensitive' } },
                            { fullName: { contains: query, mode: 'insensitive' } },
                            { cuit: { contains: query, mode: 'insensitive' } },
                        ],
                    },
                    source ? { source } : {},
                    { isActive: true },
                ],
            },
            take: 20,
            orderBy: { fullName: 'asc' },
        });

        return profiles.map((p: { id: string; fullName: string; profession: string | null; source: string; province: string | null; city: string | null; matricula: string | null; phone: string | null; email: string | null; claimedAt: Date | null }) => ({
            id: p.id,
            fullName: p.fullName,
            profession: p.profession,
            source: p.source,
            province: p.province,
            city: p.city,
            matricula: p.matricula,
            maskedPhone: this.maskPhone(p.phone),
            maskedEmail: this.maskEmail(p.email),
            isClaimed: p.claimedAt !== null,
        }));
    }

    /**
     * Get a single profile by ID
     */
    async getProfile(profileId: string): Promise<SearchResult | null> {
        const profile = await prisma.unclaimedProfile.findUnique({
            where: { id: profileId },
        });

        if (!profile) return null;

        return {
            id: profile.id,
            fullName: profile.fullName,
            profession: profile.profession,
            source: profile.source,
            province: profile.province,
            city: profile.city,
            matricula: profile.matricula,
            maskedPhone: this.maskPhone(profile.phone),
            maskedEmail: this.maskEmail(profile.email),
            isClaimed: profile.claimedAt !== null,
        };
    }

    /**
     * Request to claim a profile - sends OTP to registered contact
     */
    async requestClaim(profileId: string): Promise<ClaimRequestResult> {
        const profile = await prisma.unclaimedProfile.findUnique({
            where: { id: profileId },
        });

        if (!profile) {
            return { success: false, error: 'Perfil no encontrado' };
        }

        if (profile.claimedAt) {
            return { success: false, error: 'Este perfil ya fue reclamado' };
        }

        // Determine verification method
        const hasPhone = profile.phone && profile.phone.length > 8;
        const hasEmail = profile.email && profile.email.includes('@');

        if (!hasPhone && !hasEmail) {
            return {
                success: false,
                error: 'No hay información de contacto disponible para verificar la identidad'
            };
        }

        // Generate OTP (6-digit code)
        const otp = this.generateOTP();
        const claimToken = this.generateClaimToken();
        const expiry = new Date(Date.now() + CLAIM_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        // Store claim token and OTP (OTP stored securely - would hash in production)
        await prisma.unclaimedProfile.update({
            where: { id: profileId },
            data: {
                claimToken: `${claimToken}:${otp}`,
                claimTokenExpiry: expiry,
                outreachStatus: 'verification_sent',
                lastContactedAt: new Date(),
                contactAttempts: { increment: 1 },
            },
        });

        // Determine method and send OTP
        let verificationMethod: 'phone' | 'email';
        let maskedContact: string;

        if (hasPhone) {
            verificationMethod = 'phone';
            maskedContact = this.maskPhone(profile.phone)!;
            // In production: send SMS via WhatsApp or SMS provider
            console.log(`[UnclaimedProfile] Would send OTP ${otp} to phone ${profile.phone}`);
        } else {
            verificationMethod = 'email';
            maskedContact = this.maskEmail(profile.email)!;
            // In production: send email via Resend/SendGrid
            console.log(`[UnclaimedProfile] Would send OTP ${otp} to email ${profile.email}`);
        }

        return {
            success: true,
            verificationMethod,
            maskedContact,
            expiresInMinutes: CLAIM_TOKEN_EXPIRY_MINUTES,
        };
    }

    /**
     * Verify OTP and complete the claim process
     */
    async verifyClaim(
        profileId: string,
        otp: string,
        userId: string,
        organizationId: string
    ): Promise<ClaimVerifyResult> {
        const profile = await prisma.unclaimedProfile.findUnique({
            where: { id: profileId },
        });

        if (!profile) {
            return { success: false, error: 'Perfil no encontrado' };
        }

        if (profile.claimedAt) {
            return { success: false, error: 'Este perfil ya fue reclamado' };
        }

        if (!profile.claimToken || !profile.claimTokenExpiry) {
            return { success: false, error: 'No hay solicitud de verificación activa' };
        }

        if (profile.claimTokenExpiry < new Date()) {
            return { success: false, error: 'El código de verificación ha expirado' };
        }

        // Verify OTP (from stored claim token format: token:otp)
        const [, storedOtp] = profile.claimToken.split(':');
        if (storedOtp !== otp) {
            return { success: false, error: 'Código de verificación incorrecto' };
        }

        // Complete the claim
        await prisma.unclaimedProfile.update({
            where: { id: profileId },
            data: {
                claimedAt: new Date(),
                claimedByUserId: userId,
                claimedOrgId: organizationId,
                outreachStatus: 'claimed',
                claimToken: null,
                claimTokenExpiry: null,
            },
        });

        return {
            success: true,
            organizationId,
            userId,
        };
    }

    /**
     * Get statistics for the admin dashboard
     */
    async getStats(): Promise<ProfileStats> {
        const profiles = await prisma.unclaimedProfile.groupBy({
            by: ['source'],
            _count: { id: true },
        });

        // Get detailed stats per source
        const sourceValues = profiles.map((p: { source: string }) => p.source);
        const uniqueSources = [...new Set(sourceValues)];
        const bySource: Record<string, { total: number; withPhone: number; withEmail: number; claimed: number }> = {};

        for (const source of uniqueSources) {
            const [total, withPhone, withEmail, claimed] = await Promise.all([
                prisma.unclaimedProfile.count({ where: { source: source as never } }),
                prisma.unclaimedProfile.count({ where: { source: source as never, phone: { not: null } } }),
                prisma.unclaimedProfile.count({ where: { source: source as never, email: { not: null } } }),
                prisma.unclaimedProfile.count({ where: { source: source as never, claimedAt: { not: null } } }),
            ]);

            bySource[source as string] = { total, withPhone, withEmail, claimed };
        }

        const [totalWithPhone, totalWithEmail, totalClaimed, total] = await Promise.all([
            prisma.unclaimedProfile.count({ where: { phone: { not: null } } }),
            prisma.unclaimedProfile.count({ where: { email: { not: null } } }),
            prisma.unclaimedProfile.count({ where: { claimedAt: { not: null } } }),
            prisma.unclaimedProfile.count(),
        ]);

        return {
            total,
            bySource,
            totalWithPhone,
            totalWithEmail,
            totalClaimed,
        };
    }

    /**
     * List profiles with pagination and filters
     */
    async listProfiles(options: {
        source?: UnclaimedSource;
        province?: string;
        status?: 'unclaimed' | 'claimed' | 'all';
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { source, province, status = 'all', search, page = 1, limit = 50 } = options;
        const skip = (page - 1) * limit;

        const where = {
            AND: [
                source ? { source } : {},
                province ? { province } : {},
                status === 'claimed' ? { claimedAt: { not: null } } :
                    status === 'unclaimed' ? { claimedAt: null } : {},
                search ? {
                    OR: [
                        { fullName: { contains: search, mode: 'insensitive' as const } },
                        { matricula: { contains: search, mode: 'insensitive' as const } },
                        { email: { contains: search, mode: 'insensitive' as const } },
                    ],
                } : {},
                { isActive: true },
            ],
        };

        const [profiles, total] = await Promise.all([
            prisma.unclaimedProfile.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    fullName: true,
                    profession: true,
                    source: true,
                    province: true,
                    city: true,
                    matricula: true,
                    phone: true,
                    email: true,
                    outreachStatus: true,
                    claimedAt: true,
                    createdAt: true,
                },
            }),
            prisma.unclaimedProfile.count({ where }),
        ]);

        return {
            profiles,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Import profiles from scraped data
     */
    async importProfiles(profiles: {
        source: UnclaimedSource;
        sourceId?: string;
        sourceUrl?: string;
        fullName: string;
        phone?: string;
        email?: string;
        cuit?: string;
        matricula?: string;
        province?: string;
        city?: string;
        profession?: string;
        specialty?: string;
        category?: string;
    }[]): Promise<{ imported: number; updated: number; errors: number }> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const profileData of profiles) {
            try {
                // Check for existing profile by source + matricula (if available)
                const existingByMatricula = profileData.matricula
                    ? await prisma.unclaimedProfile.findUnique({
                        where: {
                            source_matricula: {
                                source: profileData.source,
                                matricula: profileData.matricula,
                            },
                        },
                    })
                    : null;

                if (existingByMatricula) {
                    // Update existing
                    await prisma.unclaimedProfile.update({
                        where: { id: existingByMatricula.id },
                        data: {
                            fullName: profileData.fullName,
                            phone: profileData.phone,
                            email: profileData.email,
                            cuit: profileData.cuit,
                            province: profileData.province,
                            city: profileData.city,
                            profession: profileData.profession,
                            specialty: profileData.specialty,
                            category: profileData.category,
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    // Create new
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: profileData.source,
                            sourceId: profileData.sourceId,
                            sourceUrl: profileData.sourceUrl,
                            fullName: profileData.fullName,
                            phone: profileData.phone,
                            email: profileData.email,
                            cuit: profileData.cuit,
                            matricula: profileData.matricula,
                            province: profileData.province,
                            city: profileData.city,
                            profession: profileData.profession,
                            specialty: profileData.specialty,
                            category: profileData.category,
                        },
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`[UnclaimedProfile] Import error for ${profileData.fullName}:`, error);
                errors++;
            }
        }

        return { imported, updated, errors };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    private maskPhone(phone: string | null): string | null {
        if (!phone || phone.length < 8) return null;
        const visible = 4;
        return '*'.repeat(phone.length - visible) + phone.slice(-visible);
    }

    private maskEmail(email: string | null): string | null {
        if (!email || !email.includes('@')) return null;
        const [local, domain] = email.split('@');
        if (local.length <= 2) return `**@${domain}`;
        return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }

    private generateOTP(): string {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < OTP_LENGTH; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }
        return otp;
    }

    private generateClaimToken(): string {
        return randomBytes(CLAIM_TOKEN_LENGTH).toString('hex');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let unclaimedProfileServiceInstance: UnclaimedProfileService | null = null;

export function getUnclaimedProfileService(): UnclaimedProfileService {
    if (!unclaimedProfileServiceInstance) {
        unclaimedProfileServiceInstance = new UnclaimedProfileService();
    }
    return unclaimedProfileServiceInstance;
}

export default UnclaimedProfileService;
