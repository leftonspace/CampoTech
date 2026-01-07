
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const orgCount = await prisma.organization.count();
        console.log('Org count:', orgCount);

        const orgs = await prisma.organization.findMany({
            take: 1
        });
        console.log('Sample org settings:', JSON.stringify(orgs[0]?.settings, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Prisma test error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
