/**
 * Seed Admin Account
 * ===================
 * 
 * Creates a test admin (OWNER) account for development testing.
 * Run with: npx ts-node scripts/seed-admin.ts
 * Or call the API: POST /api/dev/seed-admin
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding admin account...');

    // Create test organization
    const org = await prisma.organization.upsert({
        where: { id: 'test-org-001' },
        update: {},
        create: {
            id: 'test-org-001',
            name: 'CampoTech Admin',
            slug: 'campotech-admin',
            settings: {
                cuit: '30123456789',
                timezone: 'America/Argentina/Buenos_Aires',
            },
            subscriptionTier: 'EMPRESA',
            subscriptionStatus: 'ACTIVE',
        },
    });

    console.log(`✅ Organization: ${org.name} (${org.id})`);

    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Create admin user
    const user = await prisma.user.upsert({
        where: { phone: '+5491112345678' },
        update: {
            role: 'OWNER',
            passwordHash,
        },
        create: {
            phone: '+5491112345678',
            email: 'admin@campotech.ar',
            name: 'Admin Test',
            passwordHash,
            role: 'OWNER',
            organizationId: org.id,
            isActive: true,
        },
    });

    console.log(`✅ Admin user: ${user.name} (${user.phone})`);
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Phone: +5491112345678');
    console.log('   Password: admin123');
    console.log('');
    console.log('🌐 Access: http://localhost:3000');
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
