/**
 * Seed Inflation Indices for Testing
 * 
 * Run with: npx ts-node --skip-project scripts/seed-inflation.ts
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding inflation indices...');

    // Generate indices for the last 6 months
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indices: any[] = [];

    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        // CAC ICC General (construction index) - typical Argentine inflation rates
        indices.push({
            source: 'CAC_ICC_GENERAL',
            period,
            rate: new Decimal(4 + Math.random() * 3), // 4-7% monthly
            publishedAt: new Date(date.getFullYear(), date.getMonth() + 1, 10), // Published 10th of next month
            scrapedAt: new Date(),
        });

        // INDEC IPC (consumer price index)
        indices.push({
            source: 'INDEC_IPC',
            period,
            rate: new Decimal(3.5 + Math.random() * 2.5), // 3.5-6% monthly
            publishedAt: new Date(date.getFullYear(), date.getMonth() + 1, 15), // Published 15th of next month
            scrapedAt: new Date(),
        });
    }

    // Upsert all indices
    for (const index of indices) {
        await prisma.inflationIndex.upsert({
            where: {
                source_period: {
                    source: index.source,
                    period: index.period,
                },
            },
            update: {
                rate: index.rate,
                publishedAt: index.publishedAt,
                scrapedAt: index.scrapedAt,
            },
            create: index,
        });
        console.log(`  ✓ ${index.source} ${index.period}: ${index.rate.toFixed(1)}%`);
    }

    console.log(`\n✅ Seeded ${indices.length} inflation indices`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
