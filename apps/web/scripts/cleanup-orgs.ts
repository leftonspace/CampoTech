import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning up extra organizations...\n');

    // List orgs first
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true },
    });

    console.log('Organizations before cleanup:');
    for (const org of orgs) {
        console.log(`   ${org.id} - ${org.name}`);
    }

    // Delete the one we don't need (test-org-001)
    // First delete all related data
    const orgId = 'test-org-001';

    try {
        // Delete users first
        const deletedUsers = await prisma.user.deleteMany({
            where: { organizationId: orgId },
        });
        console.log(`\nDeleted ${deletedUsers.count} users from ${orgId}`);

        // Delete the org using raw SQL to bypass constraints
        await prisma.$executeRaw`DELETE FROM organizations WHERE id = ${orgId}`;
        console.log(`✅ Deleted org: ${orgId}`);
    } catch (e) {
        const err = e as Error;
        console.log(`⚠️  Could not delete ${orgId}: ${err.message}`);
    }

    // Verify
    const remaining = await prisma.organization.findMany({
        select: { id: true, name: true },
    });

    console.log('\n📋 Remaining organizations:');
    for (const org of remaining) {
        console.log(`   ${org.id} - ${org.name}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
