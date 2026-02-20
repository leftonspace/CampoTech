/**
 * Seed Map Organizations
 * ======================
 *
 * Creates 10 fake organizations across Buenos Aires with:
 * - Organization records (marketplace visible)
 * - BusinessPublicProfile (categories, service area, ratings)
 * - Users (OWNER, ADMIN, TECHNICIAN roles)
 * - TechnicianLocation (GPS coordinates with jitter)
 *
 * Usage:
 *   pnpm tsx scripts/simulation/maps/seed-map-orgs.ts          # Seed
 *   pnpm tsx scripts/simulation/maps/seed-map-orgs.ts --clean   # Clean + reseed
 *   pnpm tsx scripts/simulation/maps/seed-map-orgs.ts --clean-only  # Just clean
 */

import { PrismaClient } from '@prisma/client';
import { SIM_ORGANIZATIONS, BA_ZONES, type SimOrganization, type SimWorker } from './config';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// IDENTIFIERS — All simulation-created records are tagged with this prefix
// ═══════════════════════════════════════════════════════════════════════════════

const SIM_PREFIX = 'sim-maps-';

function simOrgId(slug: string): string {
    return `${SIM_PREFIX}org-${slug}`;
}

function simUserId(slug: string, workerIndex: number): string {
    return `${SIM_PREFIX}usr-${slug}-${workerIndex}`;
}

function simProfileId(slug: string): string {
    return `${SIM_PREFIX}prof-${slug}`;
}

function simLocationId(slug: string, workerIndex: number): string {
    return `${SIM_PREFIX}loc-${slug}-${workerIndex}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAN — Remove all simulation data
// ═══════════════════════════════════════════════════════════════════════════════

async function cleanSimulationData(): Promise<void> {
    console.log('\n🧹 Cleaning simulation data...');

    // Find all sim orgs
    const simOrgs = await prisma.organization.findMany({
        where: { id: { startsWith: SIM_PREFIX } },
        select: { id: true },
    });

    if (simOrgs.length === 0) {
        console.log('   No simulation data found.');
        return;
    }

    const orgIds = simOrgs.map((o) => o.id);

    // Delete in correct order (respecting foreign keys)
    // 1. TechnicianLocations (via users)
    const simUsers = await prisma.user.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
    });
    const userIds = simUsers.map((u) => u.id);

    if (userIds.length > 0) {
        const locResult = await prisma.technicianLocation.deleteMany({
            where: { userId: { in: userIds } },
        });
        console.log(`   Deleted ${locResult.count} technician locations`);
    }

    // 2. Users
    const userResult = await prisma.user.deleteMany({
        where: { organizationId: { in: orgIds } },
    });
    console.log(`   Deleted ${userResult.count} users`);

    // 3. Public profiles
    const profileResult = await prisma.businessPublicProfile.deleteMany({
        where: { organizationId: { in: orgIds } },
    });
    console.log(`   Deleted ${profileResult.count} public profiles`);

    // 4. Organizations
    const orgResult = await prisma.organization.deleteMany({
        where: { id: { in: orgIds } },
    });
    console.log(`   Deleted ${orgResult.count} organizations`);

    console.log('   ✅ Clean complete\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED — Create all simulation organizations and users
// ═══════════════════════════════════════════════════════════════════════════════

async function seedOrganization(org: SimOrganization): Promise<void> {
    const orgId = simOrgId(org.slug);
    const zone = BA_ZONES[org.zone];

    // ─── 1. Create Organization ──────────────────────────────────────────
    await prisma.organization.create({
        data: {
            id: orgId,
            name: org.name,
            phone: org.whatsappNumber,
            email: `${org.slug}@sim.campotech.com`,
            marketplaceVisible: org.marketplaceVisible,
            canReceiveJobs: true,
            subscriptionTier: 'PROFESIONAL',
            subscriptionStatus: 'active',
            verificationStatus: 'verified',
            complianceScore: 85,
        },
    });

    // ─── 2. Create BusinessPublicProfile ─────────────────────────────────
    await prisma.businessPublicProfile.create({
        data: {
            id: simProfileId(org.slug),
            organizationId: orgId,
            displayName: org.name,
            slug: org.slug,
            description: `Servicios de ${org.categories.join(', ').toLowerCase()} en ${zone.label} y alrededores.`,
            categories: org.categories,
            serviceArea: {
                center: { lat: zone.lat, lng: zone.lng },
                radiusKm: org.serviceRadiusKm,
            },
            address: `${zone.label}, Buenos Aires`,
            whatsappNumber: org.whatsappNumber,
            averageRating: org.rating,
            totalReviews: org.totalReviews,
            totalJobs: org.totalJobs,
            responseRate: 0.85 + Math.random() * 0.15,
            responseTime: Math.floor(5 + Math.random() * 25),
            cuitVerified: Math.random() > 0.3,
            insuranceVerified: Math.random() > 0.5,
            backgroundCheck: Math.random() > 0.4,
            professionalLicense: Math.random() > 0.6,
            isActive: true,
        },
    });

    // ─── 3. Create Workers (Users + TechnicianLocations) ─────────────────
    for (let i = 0; i < org.workers.length; i++) {
        const worker = org.workers[i];
        const userId = simUserId(org.slug, i);
        const workerZone = BA_ZONES[worker.zone];

        // Compute actual coordinates with jitter
        const workerLat = workerZone.lat + worker.locationJitter.lat;
        const workerLng = workerZone.lng + worker.locationJitter.lng;

        try {
            // Create user
            await prisma.user.create({
                data: {
                    id: userId,
                    name: worker.name,
                    phone: worker.phone,
                    role: worker.role,
                    specialty: worker.specialty,
                    specialties: worker.specialties,
                    organizationId: orgId,
                    isActive: true,
                    canBeAssignedJobs: true,
                    verificationStatus: 'verified',
                    skillLevel: 'OFICIAL',
                },
            });

            // Create GPS location (all workers start "online")
            await prisma.technicianLocation.create({
                data: {
                    id: simLocationId(org.slug, i),
                    userId: userId,
                    latitude: workerLat,
                    longitude: workerLng,
                    accuracy: 5 + Math.random() * 10,
                    isOnline: true,
                    lastSeen: new Date(), // Just now = online
                },
            });
        } catch (err) {
            console.error(`     ❌ Worker ${worker.name} (${worker.role}) failed:`, (err as Error).message?.slice(0, 200));
        }
    }
}

async function seedAllOrganizations(): Promise<void> {
    console.log('\n🏗️  Seeding map simulation organizations...\n');

    for (const org of SIM_ORGANIZATIONS) {
        try {
            await seedOrganization(org);
            const zone = BA_ZONES[org.zone];
            const workerCount = org.workers.length;
            const typeLabel = workerCount === 1 ? 'solo' : `${workerCount} workers`;
            console.log(
                `   ✅ ${org.name.padEnd(30)} | ${zone.label.padEnd(18)} | ${typeLabel.padEnd(12)} | ${org.categories.join(', ')}`
            );
        } catch (error) {
            console.error(`   ❌ Failed to seed ${org.name}:`, error);
        }
    }

    // ─── Summary ─────────────────────────────────────────────────────────
    const totalWorkers = SIM_ORGANIZATIONS.reduce((sum, o) => sum + o.workers.length, 0);
    console.log(`\n📊 Summary:`);
    console.log(`   Organizations: ${SIM_ORGANIZATIONS.length}`);
    console.log(`   Total workers: ${totalWorkers}`);
    console.log(`   Solo owners:   ${SIM_ORGANIZATIONS.filter((o) => o.workers.length === 1).length}`);
    console.log(`   Team orgs:     ${SIM_ORGANIZATIONS.filter((o) => o.workers.length > 1).length}`);
    console.log(`\n✅ Seeding complete!\n`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean');
    const cleanOnly = args.includes('--clean-only');

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   🗺️  Maps Simulation — Seed Organizations   ║');
    console.log('╚══════════════════════════════════════════════╝');

    if (shouldClean || cleanOnly) {
        await cleanSimulationData();
        if (cleanOnly) {
            await prisma.$disconnect();
            return;
        }
    }

    await seedAllOrganizations();
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
});
