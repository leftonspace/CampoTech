
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const cuit = '20123456780';
        console.log('Testing JSON filter for CUIT:', cuit);

        const existingOrg = await prisma.organization.findFirst({
            where: {
                settings: {
                    path: ['cuit'],
                    equals: cuit,
                },
            },
        });
        console.log('JSON filter SUCCESS. Org found:', !!existingOrg);

        process.exit(0);
    } catch (error) {
        console.error('JSON filter ERROR:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
