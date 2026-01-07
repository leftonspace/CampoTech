
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const pendingCount = await prisma.pendingRegistration.count();
        console.log('Pending registration count:', pendingCount);

        const pendings = await prisma.pendingRegistration.findMany();
        console.log('Pending registrations:', JSON.stringify(pendings, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Prisma test error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
