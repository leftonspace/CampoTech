
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);

        const users = await prisma.user.findMany({
            take: 5,
            select: { phone: true, name: true }
        });
        console.log('Sample users:', JSON.stringify(users, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Prisma test error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
