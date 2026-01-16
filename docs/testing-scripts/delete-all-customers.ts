/**
 * Delete all customers for an organization
 * Usage: npx tsx docs/testing-scripts/delete-all-customers.ts [org-id]
 * 
 * ⚠️  WARNING: This will also delete all related jobs, invoices, and conversations!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllCustomers(organizationId: string) {
    console.log(`🗑️  Deleting all customers for organization: ${organizationId}`);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
        where: { id: organizationId }
    });

    if (!org) {
        throw new Error(`Organization ${organizationId} not found`);
    }

    // Count customers before deletion
    const customerCount = await prisma.customer.count({
        where: { organizationId }
    });

    console.log(`   Found ${customerCount} customers to delete`);

    if (customerCount === 0) {
        console.log('✅ No customers to delete');
        return;
    }

    // Get all customer IDs
    const customerIds = await prisma.customer.findMany({
        where: { organizationId },
        select: { id: true }
    });
    const ids = customerIds.map(c => c.id);

    // First, delete all jobs (which reference customers)
    // Get job IDs for these customers
    const jobIds = await prisma.job.findMany({
        where: { customerId: { in: ids } },
        select: { id: true }
    });
    const jIds = jobIds.map(j => j.id);

    if (jIds.length > 0) {
        console.log(`   Found ${jIds.length} related jobs to delete first...`);

        // Delete job-related records
        console.log('   Deleting job visit vehicle drivers...');
        await prisma.jobVisitVehicleDriver.deleteMany({
            where: {
                jobVisitVehicle: {
                    jobVisit: {
                        jobId: { in: jIds }
                    }
                }
            }
        });

        console.log('   Deleting job visit vehicles...');
        await prisma.jobVisitVehicle.deleteMany({
            where: {
                jobVisit: {
                    jobId: { in: jIds }
                }
            }
        });

        console.log('   Deleting job visits...');
        await prisma.jobVisit.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting job assignments...');
        await prisma.jobAssignment.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting job materials...');
        await prisma.jobMaterial.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting job photos...');
        await prisma.jobPhoto.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting job line items...');
        await prisma.jobLineItem.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting stock movements...');
        await prisma.stockMovement.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting stock reservations...');
        await prisma.stockReservation.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting tracking sessions...');
        await prisma.trackingSession.deleteMany({
            where: { jobId: { in: jIds } }
        });

        console.log('   Deleting jobs...');
        await prisma.job.deleteMany({
            where: { customerId: { in: ids } }
        });
    }

    // Delete invoices (they reference customers)
    console.log('   Deleting invoices...');
    await prisma.invoice.deleteMany({
        where: { customerId: { in: ids } }
    });

    // Delete reviews (they reference customers)
    console.log('   Deleting reviews...');
    await prisma.review.deleteMany({
        where: { customerId: { in: ids } }
    });

    // Delete WhatsApp conversations (they reference customers)
    console.log('   Deleting WhatsApp conversations...');
    await prisma.waConversation.deleteMany({
        where: { customerId: { in: ids } }
    });

    // Finally delete the customers
    console.log('   Deleting customers...');
    const result = await prisma.customer.deleteMany({
        where: { organizationId }
    });

    console.log(`✅ Deleted ${result.count} customers`);
}

async function main() {
    const orgId = process.argv[2] || 'test-org-001';

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  DELETE ALL CUSTOMERS FOR ORGANIZATION');
    console.log('  ⚠️  This also deletes related jobs, invoices, and conversations!');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    try {
        await deleteAllCustomers(orgId);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
