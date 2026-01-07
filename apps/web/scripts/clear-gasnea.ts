// Script to clear GasNEA profiles for re-import
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.unclaimedProfile.deleteMany({
        where: {
            source: 'GASNEA',
        },
    });
    console.log(`Deleted ${result.count} GASNEA profiles`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
