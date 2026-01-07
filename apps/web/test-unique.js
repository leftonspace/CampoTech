
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const sampleUser = await prisma.user.findFirst();
        const orgId = sampleUser.organizationId;
        const phone = sampleUser.phone;

        console.log('Using Org ID:', orgId);
        console.log('Using duplicate phone:', phone);

        const user = await prisma.user.create({
            data: {
                name: 'Duplicate Test',
                phone: phone,
                organizationId: orgId
            }
        });
        console.log('SUCCESS! Created duplicate phone user.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'P2002') {
            console.log('CAUGHT UNIQUE CONSTRAINT ERROR (P2002) - AS EXPECTED');
            console.log('Target fields:', error.meta.target);
        } else {
            console.error('Unexpected error:', error);
        }
        process.exit(0);
    } finally {
        await prisma.$disconnect();
    }
}

main();
