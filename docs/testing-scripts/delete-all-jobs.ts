/**
 * Delete all jobs for an organization
 * Usage: npx tsx docs/testing-scripts/delete-all-jobs.ts [org-id]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllJobs(organizationId: string) {
    console.log(`🗑️  Deleting all jobs for organization: ${organizationId}`);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
        where: { id: organizationId }
    });

    if (!org) {
        throw new Error(`Organization ${organizationId} not found`);
    }

    // Count jobs before deletion
    const jobCount = await prisma.job.count({
        where: { organizationId }
    });

    console.log(`   Found ${jobCount} jobs to delete`);

    if (jobCount === 0) {
        console.log('✅ No jobs to delete');
        return;
    }

    // Get all job IDs
    const jobIds = await prisma.job.findMany({
        where: { organizationId },
        select: { id: true }
    });
    const ids = jobIds.map(j => j.id);

    // Delete related records in order (respecting foreign keys)
    console.log('   Deleting job visit vehicle drivers...');
    await prisma.jobVisitVehicleDriver.deleteMany({
        where: {
            jobVisitVehicle: {
                jobVisit: {
                    jobId: { in: ids }
                }
            }
        }
    });

    console.log('   Deleting job visit vehicles...');
    await prisma.jobVisitVehicle.deleteMany({
        where: {
            jobVisit: {
                jobId: { in: ids }
            }
        }
    });

    console.log('   Deleting job visits...');
    await prisma.jobVisit.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting job assignments...');
    await prisma.jobAssignment.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting job materials...');
    await prisma.jobMaterial.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting job photos...');
    await prisma.jobPhoto.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting job line items...');
    await prisma.jobLineItem.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting stock movements...');
    await prisma.stockMovement.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting stock reservations...');
    await prisma.stockReservation.deleteMany({
        where: { jobId: { in: ids } }
    });

    console.log('   Deleting tracking sessions...');
    await prisma.trackingSession.deleteMany({
        where: { jobId: { in: ids } }
    });

    // Delete invoices (they reference jobs)
    console.log('   Deleting related invoices...');
    await prisma.invoice.deleteMany({
        where: { jobId: { in: ids } }
    });

    // Finally delete the jobs
    console.log('   Deleting jobs...');
    const result = await prisma.job.deleteMany({
        where: { organizationId }
    });

    console.log(`✅ Deleted ${result.count} jobs`);
}

async function main() {
    const orgId = process.argv[2] || 'test-org-001';

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  DELETE ALL JOBS FOR ORGANIZATION');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    try {
        await deleteAllJobs(orgId);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
