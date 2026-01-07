// Script to clear Gasnor profiles for re-import
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.unclaimedProfile.deleteMany({
        where: {
            source: 'GASNOR',
        },
    });
    console.log(`Deleted ${result.count} Gasnor profiles`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
