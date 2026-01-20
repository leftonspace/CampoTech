/**
 * Make User SUPER_ADMIN Script
 * ============================
 * 
 * This script promotes a user to SUPER_ADMIN role.
 * SUPER_ADMINs are CampoTech platform administrators who can:
 * - Run scrapers
 * - Access platform-wide admin features
 * - Manage verification queue
 * - View all organizations
 * 
 * Usage:
 *   pnpm tsx scripts/make-super-admin.ts <email>
 * 
 * Example:
 *   pnpm tsx scripts/make-super-admin.ts admin@campotech.ar
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Usage: pnpm tsx scripts/make-super-admin.ts <email>');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🔐 MAKE USER SUPER_ADMIN');
    console.log('═'.repeat(60));

    // Find the user
    const user = await prisma.user.findFirst({
        where: { email },
        include: { organization: true },
    });

    if (!user) {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
    }

    console.log(`\n👤 User found:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Organization: ${user.organization.name}`);

    if (user.role === 'SUPER_ADMIN') {
        console.log(`\n✅ User is already SUPER_ADMIN`);
        process.exit(0);
    }

    // Update the user
    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' },
    });

    console.log(`\n✅ User promoted to SUPER_ADMIN`);
    console.log(`\n⚠️  The user needs to log out and log back in for the change to take effect.`);
}

main()
    .then(() => {
        console.log('\n✨ Done!\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💀 Error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
