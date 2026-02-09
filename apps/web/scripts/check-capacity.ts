/**
 * Unified System Status Check CLI
 *
 * Run with: pnpm tsx scripts/check-capacity.ts
 *
 * Options:
 *   --json     Output JSON instead of formatted text
 *   --simple   Output simple status for scripts
 *   --ai=N     Estimated daily AI calls (default: 100)
 */

import { PrismaClient } from '@prisma/client';
import {
    getUnifiedSystemStatus,
    formatUnifiedReport,
} from '../lib/services/system-capacity.service';

async function main() {
    const args = process.argv.slice(2);
    const outputJson = args.includes('--json');
    const outputSimple = args.includes('--simple');
    const aiCallsArg = args.find(a => a.startsWith('--ai='));
    const estimatedDailyAICalls = aiCallsArg ? parseInt(aiCallsArg.split('=')[1], 10) : 100;

    if (!outputJson && !outputSimple) {
        console.log('\n🔍 Checking CampoTech unified system status...\n');
    }

    const prisma = new PrismaClient();

    try {
        const status = await getUnifiedSystemStatus(prisma, {
            estimatedDailyAICalls,
        });

        if (outputSimple) {
            // Single line for scripts
            console.log(`${status.combined.toUpperCase()} | Health: ${status.operationalHealth.status} | Capacity: ${status.overallCapacity} | Orgs: ${status.businessMetrics.organizations} | DB: ${status.businessMetrics.databaseSizeMB}MB`);
        } else if (outputJson) {
            console.log(JSON.stringify(status, null, 2));
        } else {
            console.log(formatUnifiedReport(status));
        }

        // Exit code based on status
        if (status.combined === 'critical') {
            process.exit(2);
        } else if (status.combined === 'warning') {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error checking system status:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
