/**
 * Seed Demo Technicians and Vehicles
 * ===================================
 * 
 * Creates 5 technicians and 3 vehicles for the organization owned by +54 9 35 1600 0001
 * 
 * Run with: npx tsx scripts/seed-demo-technicians.ts
 * 
 * All technicians use test phone numbers that work with OTP code: 123456
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Seeding demo technicians and vehicles...\n');

    // Find the organization owned by +54 9 35 1600 0001
    const ownerPhone = '+5493516000001'; // Normalized format

    const owner = await prisma.user.findFirst({
        where: {
            phone: { contains: '3516000001' },
            role: 'OWNER'
        },
        include: { organization: true }
    });

    if (!owner || !owner.organization) {
        console.error('❌ Could not find owner with phone containing 3516000001');
        console.log('   Looking for first organization instead...');

        const org = await prisma.organization.findFirst({
            include: { users: { where: { role: 'OWNER' } } }
        });

        if (!org) {
            console.error('❌ No organization found. Please create one first.');
            return;
        }

        console.log(`   Found organization: ${org.name}`);
    }

    const organizationId = owner?.organizationId || (await prisma.organization.findFirst())?.id;

    if (!organizationId) {
        console.error('❌ No organization found');
        return;
    }

    console.log(`📍 Organization ID: ${organizationId}\n`);

    // ═══════════════════════════════════════════════════════════════════════════
    // TECHNICIANS
    // ═══════════════════════════════════════════════════════════════════════════

    const technicians = [
        {
            phone: '+543516000002',
            name: 'Marcelo Conta',
            email: 'marcelo.conta@demo.campotech.com',
        },
        {
            phone: '+543516000003',
            name: 'Adara Esber',
            email: 'adara.esber@demo.campotech.com',
        },
        {
            phone: '+543516000004',
            name: 'Erik Conta',
            email: 'erik.conta@demo.campotech.com',
        },
        {
            phone: '+543516000005',
            name: 'Alex Conta',
            email: 'alex.conta@demo.campotech.com',
        },
        {
            phone: '+543516000006',
            name: 'Mathieu PG',
            email: 'mathieu.pg@demo.campotech.com',
        },
    ];

    console.log('👷 Creating technicians...\n');

    for (const techData of technicians) {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { phone: techData.phone }
        });

        if (existing) {
            console.log(`  ⏭️  Already exists: ${techData.name} (${techData.phone})`);
            continue;
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                phone: techData.phone,
                name: techData.name,
                email: techData.email,
                role: 'TECHNICIAN',
                organizationId,
                isActive: true,
                verificationStatus: 'verified', // Pre-verified for demo
                canBeAssignedJobs: true, // Can receive jobs immediately
            }
        });

        console.log(`  ✅ Created: ${user.name} (${user.phone})`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VEHICLES
    // ═══════════════════════════════════════════════════════════════════════════

    const vehicles = [
        {
            plateNumber: 'AA 123 BB',
            make: 'Renault',
            model: 'Kangoo',
            year: 2022,
            color: 'Blanco',
        },
        {
            plateNumber: 'AC 456 CD',
            make: 'Ford',
            model: 'Transit Connect',
            year: 2021,
            color: 'Gris',
        },
        {
            plateNumber: 'AD 789 EF',
            make: 'Fiat',
            model: 'Fiorino',
            year: 2023,
            color: 'Azul',
        },
    ];

    console.log('\n🚗 Creating vehicles...\n');

    for (const vehicleData of vehicles) {
        // Check if vehicle already exists
        const existing = await prisma.vehicle.findUnique({
            where: {
                organizationId_plateNumber: {
                    organizationId,
                    plateNumber: vehicleData.plateNumber
                }
            }
        });

        if (existing) {
            console.log(`  ⏭️  Already exists: ${vehicleData.make} ${vehicleData.model} (${vehicleData.plateNumber})`);
            continue;
        }

        // Create vehicle
        const vehicle = await prisma.vehicle.create({
            data: {
                plateNumber: vehicleData.plateNumber,
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                color: vehicleData.color,
                organizationId,
                status: 'ACTIVE',
            }
        });

        console.log(`  ✅ Created: ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DONE! Demo data created successfully.');
    console.log('═'.repeat(60));
    console.log('\n📱 Technician Login Info:');
    console.log('   All technicians can login using OTP code: 123456');
    console.log('\n   Phone numbers:');
    technicians.forEach(t => {
        console.log(`   • ${t.name}: ${t.phone}`);
    });
    console.log('\n🚗 Vehicles created: ' + vehicles.length);
    vehicles.forEach(v => {
        console.log(`   • ${v.make} ${v.model} - ${v.plateNumber}`);
    });
    console.log('');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
