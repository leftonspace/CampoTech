import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orgId = 'cmkzp66wa000bpvvd805x5ewo';

    const jobCount = await prisma.job.count({ where: { organizationId: orgId } });
    console.log('Total Jobs:', jobCount);

    // Check job number ranges
    const firstJob = await prisma.job.findFirst({
        where: { organizationId: orgId },
        orderBy: { jobNumber: 'asc' },
        select: { jobNumber: true }
    });

    const lastJob = await prisma.job.findFirst({
        where: { organizationId: orgId },
        orderBy: { jobNumber: 'desc' },
        select: { jobNumber: true }
    });

    console.log('First job number:', firstJob?.jobNumber);
    console.log('Last job number:', lastJob?.jobNumber);

    // Check by status
    const byStatus = await prisma.job.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true
    });

    console.log('\nJobs by status:');
    byStatus.forEach((s: typeof byStatus[number]) => console.log(`  ${s.status}: ${s._count}`));
}

main()
    .finally(() => prisma.$disconnect());
