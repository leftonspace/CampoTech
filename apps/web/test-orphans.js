
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            where: { organizationId: null }
        });
        console.log('Users with null org:', users.length);

        const usersWithOrg = await prisma.user.findMany({
            include: { organization: true }
        });
        const orphans = usersWithOrg.filter(u => !u.organization);
        console.log('Users with missing org relation:', orphans.length);
        if (orphans.length > 0) {
            console.log('Orphan user IDs:', orphans.map(u => u.id));
        }

        process.exit(0);
    } catch (error) {
        console.error('Check ERROR:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
