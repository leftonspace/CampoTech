// Script to create test users with test phone numbers
// Run with: npx ts-node scripts/create-test-users.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // First, find or create a test organization
    let org = await prisma.organization.findFirst({
        where: { name: { contains: 'Test' } }
    });

    if (!org) {
        // Use the first organization (your existing one)
        org = await prisma.organization.findFirst();
    }

    if (!org) {
        console.error('No organization found. Please create one first.');
        return;
    }

    console.log(`Using organization: ${org.name} (${org.id})`);

    // Test users to create
    const testUsers = [
        {
            phone: '+543516000001',
            name: 'Test Technician 1',
            email: 'test1@campotech.local',
            role: 'TECHNICIAN' as const,
        },
        {
            phone: '+543516000002',
            name: 'Test Admin',
            email: 'admin@campotech.local',
            role: 'ADMIN' as const,
        },
        {
            phone: '+543516000003',
            name: 'Test Dispatcher',
            email: 'dispatcher@campotech.local',
            role: 'DISPATCHER' as const,
        },
    ];

    for (const userData of testUsers) {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { phone: userData.phone }
        });

        if (existing) {
            console.log(`✓ User already exists: ${userData.name} (${userData.phone})`);
            continue;
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                ...userData,
                organizationId: org.id,
                isActive: true,
            }
        });

        console.log(`✅ Created: ${user.name} (${user.phone}) - Role: ${user.role}`);
    }

    console.log('\n🎉 Done! Test users can login with code: 123456');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
