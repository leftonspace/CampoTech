/**
 * Populate Verification Registry
 * ===============================
 *
 * This script populates the verification_registry table from unclaimed_profiles.
 * The verification_registry is optimized for fast matricula lookups during
 * badge verification.
 *
 * Run: pnpm tsx scripts/populate-verification-registry.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Specialty mapping from profession
const PROFESSION_TO_SPECIALTY: Record<string, string> = {
    GASISTA: 'GASISTA',
    gasista: 'GASISTA',
    Gasista: 'GASISTA',
    ELECTRICISTA: 'ELECTRICISTA',
    electricista: 'ELECTRICISTA',
    Electricista: 'ELECTRICISTA',
    PLOMERO: 'PLOMERO',
    plomero: 'PLOMERO',
    Plomero: 'PLOMERO',
    'HVAC/Refrigeración': 'REFRIGERACION',
    REFRIGERACION: 'REFRIGERACION',
    refrigeracion: 'REFRIGERACION',
    Refrigeración: 'REFRIGERACION',
};

// Source normalization
const SOURCE_MAP: Record<string, string> = {
    ERSEP: 'ERSEP',
    ersep: 'ERSEP',
    GASNOR: 'GASNOR',
    gasnor: 'GASNOR',
    GASNEA: 'GASNEA',
    gasnea: 'GASNEA',
    CACAAV: 'CACAAV',
    cacaav: 'CACAAV',
};

async function main() {
    console.log('═'.repeat(60));
    console.log('📋 POPULATING VERIFICATION REGISTRY');
    console.log('═'.repeat(60));

    // Get current counts
    const profileCount = await prisma.unclaimedProfile.count({
        where: {
            matricula: { not: null },
        },
    });

    const registryCount = await prisma.verificationRegistry.count();

    console.log(`\n📊 Current state:`);
    console.log(`   Unclaimed profiles with matricula: ${profileCount}`);
    console.log(`   Verification registry entries: ${registryCount}`);

    if (profileCount === 0) {
        console.log('\n⚠️  No profiles with matricula found. Run scrapers first.');
        return;
    }

    // Get all profiles with matricula
    const profiles = await prisma.unclaimedProfile.findMany({
        where: {
            matricula: { not: null },
        },
        select: {
            matricula: true,
            fullName: true,
            province: true,
            profession: true,
            source: true,
            scrapedAt: true,
        },
    });

    console.log(`\n🔄 Processing ${profiles.length} profiles...`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of profiles) {
        try {
            // Skip if no matricula
            if (!profile.matricula) {
                skipped++;
                continue;
            }

            // Normalize source
            const source = SOURCE_MAP[profile.source] || profile.source;

            // Map profession to specialty
            const specialty = profile.profession
                ? PROFESSION_TO_SPECIALTY[profile.profession] || profile.profession.toUpperCase()
                : 'UNKNOWN';

            // Upsert into verification registry
            const result = await prisma.verificationRegistry.upsert({
                where: {
                    matricula_source: {
                        matricula: profile.matricula,
                        source: source,
                    },
                },
                update: {
                    fullName: profile.fullName,
                    province: profile.province,
                    specialty: specialty,
                    lastVerified: new Date(),
                },
                create: {
                    matricula: profile.matricula,
                    source: source,
                    specialty: specialty,
                    fullName: profile.fullName,
                    province: profile.province,
                    status: 'active',
                    scrapedAt: profile.scrapedAt,
                },
            });

            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                created++;
            } else {
                updated++;
            }
        } catch (error) {
            errors++;
            if (errors <= 5) {
                console.error(`   ❌ Error processing profile:`, error);
            }
        }
    }

    console.log(`\n✅ Done!`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

    // Final count
    const finalCount = await prisma.verificationRegistry.count();
    console.log(`\n📊 Final registry count: ${finalCount}`);

    // Breakdown by source
    const bySource = await prisma.verificationRegistry.groupBy({
        by: ['source'],
        _count: { id: true },
    });

    console.log(`\n📊 By source:`);
    for (const row of bySource) {
        console.log(`   ${row.source}: ${row._count.id}`);
    }

    // Breakdown by specialty
    const bySpecialty = await prisma.verificationRegistry.groupBy({
        by: ['specialty'],
        _count: { id: true },
    });

    console.log(`\n📊 By specialty:`);
    for (const row of bySpecialty) {
        console.log(`   ${row.specialty}: ${row._count.id}`);
    }
}

main()
    .then(() => {
        console.log('\n✨ Complete!\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💀 Fatal error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
