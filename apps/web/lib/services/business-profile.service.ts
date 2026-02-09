/**
 * Business Profile Auto-Creation Service
 * =======================================
 * 
 * Automatically creates a BusinessPublicProfile for each organization.
 * This ensures all organizations appear in the marketplace and can accumulate ratings.
 * 
 * Similar to Google Maps - every business automatically gets a public profile page
 * where ratings compile over time.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateProfileResult {
    success: boolean;
    profileId?: string;
    slug?: string;
    error?: string;
}

export interface ProfileData {
    organizationId: string;
    displayName: string;
    whatsappNumber: string;
    phone?: string;
    description?: string;
    categories?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLUG GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a URL-safe slug from organization name
 * Example: "Plomería García S.A." → "plomeria-garcia-sa"
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .slice(0, 50); // Limit length
}

/**
 * Generate a unique slug by appending a random suffix if needed
 */
async function generateUniqueSlug(baseName: string): Promise<string> {
    const slug = generateSlug(baseName);

    // Check if slug exists
    const existing = await prisma.businessPublicProfile.findUnique({
        where: { slug },
    });

    if (!existing) {
        return slug;
    }

    // Add random suffix to make unique
    const suffix = randomUUID().slice(0, 6);
    return `${slug}-${suffix}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a BusinessPublicProfile for an organization
 * Called automatically when a new organization is created
 * 
 * @param data - Profile creation data
 * @returns Result with profile ID and slug
 */
export async function createBusinessProfile(data: ProfileData): Promise<CreateProfileResult> {
    try {
        // Check if profile already exists
        const existing = await prisma.businessPublicProfile.findUnique({
            where: { organizationId: data.organizationId },
        });

        if (existing) {
            return {
                success: true,
                profileId: existing.id,
                slug: existing.slug,
            };
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(data.displayName);

        // Create profile with sensible defaults
        const profile = await prisma.businessPublicProfile.create({
            data: {
                organizationId: data.organizationId,
                displayName: data.displayName,
                whatsappNumber: data.whatsappNumber,
                phone: data.phone || null,
                description: data.description || null,
                categories: data.categories || [],
                slug,
                // Start with zero metrics - these will be updated as ratings come in
                averageRating: 0,
                totalReviews: 0,
                totalJobs: 0,
                responseRate: 0,
                responseTime: 0,
                // Default to active so it appears in marketplace
                isActive: true,
                // Verification statuses (false by default)
                cuitVerified: false,
                insuranceVerified: false,
                backgroundCheck: false,
                professionalLicense: false,
            },
        });

        console.log(`[BusinessProfile] Created profile for org ${data.organizationId}: slug=${slug}`);

        return {
            success: true,
            profileId: profile.id,
            slug: profile.slug,
        };
    } catch (error) {
        console.error('[BusinessProfile] Error creating profile:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Ensure a BusinessPublicProfile exists for an organization
 * Creates one if it doesn't exist, returns existing if it does
 * 
 * @param organizationId - The organization ID
 * @returns Result with profile ID and slug
 */
export async function ensureBusinessProfileExists(organizationId: string): Promise<CreateProfileResult> {
    try {
        // Check if profile exists
        const existing = await prisma.businessPublicProfile.findUnique({
            where: { organizationId },
        });

        if (existing) {
            return {
                success: true,
                profileId: existing.id,
                slug: existing.slug,
            };
        }

        // Get organization data
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                phone: true,
            },
        });

        if (!org) {
            return {
                success: false,
                error: 'Organization not found',
            };
        }

        // Create profile
        return createBusinessProfile({
            organizationId: org.id,
            displayName: org.name,
            whatsappNumber: org.phone || '',
            phone: org.phone || undefined,
        });
    } catch (error) {
        console.error('[BusinessProfile] Error ensuring profile exists:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Backfill BusinessPublicProfiles for all existing organizations
 * Run this once to create profiles for organizations that existed before auto-creation
 */
export async function backfillBusinessProfiles(): Promise<{ created: number; skipped: number; errors: number }> {
    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Get all organizations without a profile
    const orgsWithoutProfile = await prisma.organization.findMany({
        where: {
            publicProfile: null,
        },
        select: {
            id: true,
            name: true,
            phone: true,
        },
    });

    console.log(`[BusinessProfile] Backfilling ${orgsWithoutProfile.length} organizations...`);

    for (const org of orgsWithoutProfile) {
        const result = await createBusinessProfile({
            organizationId: org.id,
            displayName: org.name,
            whatsappNumber: org.phone || '',
            phone: org.phone || undefined,
        });

        if (result.success) {
            created++;
        } else if (result.error?.includes('already exists')) {
            skipped++;
        } else {
            errors++;
            console.error(`[BusinessProfile] Failed for org ${org.id}: ${result.error}`);
        }
    }

    console.log(`[BusinessProfile] Backfill complete: created=${created}, skipped=${skipped}, errors=${errors}`);

    return { created, skipped, errors };
}
