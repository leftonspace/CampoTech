import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearJobs() {
  // Find Kevin's user and organization
  const kevin = await prisma.user.findFirst({
    where: { name: { contains: 'Kevin', mode: 'insensitive' } },
    select: { id: true, name: true, organizationId: true }
  });

  if (!kevin) {
    console.log('User Kevin not found');
    return;
  }

  console.log(`Found user: ${kevin.name} (org: ${kevin.organizationId})`);

  // Count jobs before deletion
  const jobCount = await prisma.job.count({
    where: { organizationId: kevin.organizationId }
  });

  console.log(`Found ${jobCount} jobs to delete`);

  if (jobCount === 0) {
    console.log('No jobs to delete');
    return;
  }

  // Delete all jobs (cascades to JobVisit and JobAssignment)
  const deleted = await prisma.job.deleteMany({
    where: { organizationId: kevin.organizationId }
  });

  console.log(`Deleted ${deleted.count} jobs (and their visits/assignments)`);
}

clearJobs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
