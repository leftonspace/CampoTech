/**
 * Create Test Owner Account
 * ==========================
 * Creates a test owner account for development testing.
 * 
 * Usage: npx tsx scripts/create-test-owner.ts
 * Login with: Phone +5493516000001, OTP 123456
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('═'.repeat(60));
    console.log('🧪 CREATE TEST OWNER ACCOUNT');
    console.log('═'.repeat(60));

    // Find or create a test organization with EMPRESA tier
    let testOrg = await prisma.organization.findFirst({
        where: { name: 'Test Company' }
    });

    if (!testOrg) {
        testOrg = await prisma.organization.create({
            data: {
                name: 'Test Company',
                phone: '+5493516000001',
                email: 'test@company.com',
                subscriptionTier: 'EMPRESA',
                subscriptionStatus: 'active',
            }
        });
        console.log('\n✅ Created organization:', testOrg.name);
    } else {
        // Update to EMPRESA if not already
        testOrg = await prisma.organization.update({
            where: { id: testOrg.id },
            data: { subscriptionTier: 'EMPRESA' }
        });
        console.log('\n✅ Found existing org:', testOrg.name);
    }

    // Create test owner user
    const testUser = await prisma.user.upsert({
        where: { phone: '+5493516000001' },
        update: {
            name: 'Test Owner',
            role: 'OWNER',
            isActive: true,
            organizationId: testOrg.id,
        },
        create: {
            phone: '+5493516000001',
            name: 'Test Owner',
            email: 'testowner@campotech.ar',
            role: 'OWNER',
            isActive: true,
            organizationId: testOrg.id,
        }
    });

    console.log('\n📋 Test account ready:');
    console.log('   Phone: +5493516000001');
    console.log('   Name:', testUser.name);
    console.log('   Role:', testUser.role);
    console.log('   Org:', testOrg.name);
    console.log('   Tier: EMPRESA');
    console.log('\n🔐 Login with OTP: 123456');
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
