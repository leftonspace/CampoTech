/**
 * Backfill BusinessPublicProfiles Script
 * =======================================
 * 
 * Creates BusinessPublicProfile for all existing organizations that don't have one.
 * Run this once to ensure all organizations appear in the marketplace.
 * 
 * Usage:
 *   npx tsx scripts/backfill-business-profiles.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a URL-safe slug from organization name
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
 * Generate a unique slug
 */
async function generateUniqueSlug(baseName: string): Promise<string> {
    let slug = generateSlug(baseName);

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

async function main() {
    console.log('\n🔄 Backfilling BusinessPublicProfiles\n');
    console.log('='.repeat(60));

    // Get all organizations without a profile
    const orgsWithoutProfile = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        phone: string | null;
    }>>`
    SELECT o.id, o.name, o.phone
    FROM organizations o
    LEFT JOIN business_public_profiles bp ON o.id = bp."organizationId"
    WHERE bp.id IS NULL
  `;

    console.log(`\nFound ${orgsWithoutProfile.length} organizations without profiles\n`);

    if (orgsWithoutProfile.length === 0) {
        console.log('✅ All organizations already have profiles!\n');
        return;
    }

    let created = 0;
    let errors = 0;

    for (const org of orgsWithoutProfile) {
        try {
            const slug = await generateUniqueSlug(org.name);

            await prisma.businessPublicProfile.create({
                data: {
                    organizationId: org.id,
                    displayName: org.name,
                    whatsappNumber: org.phone || '',
                    phone: org.phone || null,
                    slug,
                    averageRating: 0,
                    totalReviews: 0,
                    totalJobs: 0,
                    responseRate: 0,
                    responseTime: 0,
                    isActive: true,
                    cuitVerified: false,
                    insuranceVerified: false,
                    backgroundCheck: false,
                    professionalLicense: false,
                    categories: [],
                    services: [],
                },
            });

            console.log(`✅ Created profile for "${org.name}" → /p/${slug}`);
            created++;
        } catch (error) {
            console.error(`❌ Error for "${org.name}":`, error instanceof Error ? error.message : error);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Backfill complete:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📂 Total orgs: ${orgsWithoutProfile.length}\n`);

    // Show marketplace URLs for created profiles
    if (created > 0) {
        console.log('🌐 Marketplace URLs:');
        const profiles = await prisma.businessPublicProfile.findMany({
            where: {
                organizationId: { in: orgsWithoutProfile.map(o => o.id) },
            },
            select: {
                displayName: true,
                slug: true,
            },
        });

        for (const profile of profiles) {
            console.log(`   http://localhost:3000/p/${profile.slug}`);
        }
        console.log('');
    }
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
