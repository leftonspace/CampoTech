import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check Test Owner
    const owner = await prisma.user.findUnique({
        where: { phone: '+5493516000001' },
        select: {
            id: true,
            name: true,
            role: true,
            organizationId: true,
            organization: { select: { name: true } },
        },
    });

    console.log('\n👤 Test Owner (+5493516000001):');
    console.log(JSON.stringify(owner, null, 2));

    // Check technicians org
    const camila = await prisma.user.findUnique({
        where: { phone: '+543516000012' },
        select: {
            id: true,
            name: true,
            organizationId: true,
            organization: { select: { name: true } },
        },
    });

    console.log('\n👷 Camila Torres (+543516000012):');
    console.log(JSON.stringify(camila, null, 2));

    // Are they in the same org?
    if (owner && camila) {
        console.log('\n🔍 Same organization?', owner.organizationId === camila.organizationId ? 'YES ✅' : 'NO ❌');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
