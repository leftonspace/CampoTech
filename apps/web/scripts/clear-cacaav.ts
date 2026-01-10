// Script to clear CACAAV profiles for re-import
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.unclaimedProfile.deleteMany({
        where: {
            source: 'CACAAV',
        },
    });
    console.log(`Deleted ${result.count} CACAAV profiles`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
