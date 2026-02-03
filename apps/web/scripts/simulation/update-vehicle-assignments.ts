/**
 * Update Vehicle Assignments
 * ===========================
 * 
 * Creates proper vehicle-driver assignments for technicians
 * 
 * Run with: npx tsx scripts/update-vehicle-assignments.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Driver assignments by phone
const DRIVER_ASSIGNMENTS = [
    // Company vehicles
    { phone: '+543516000002', plateNumber: 'AA 123 BB', isPrimary: true },  // Marcelo - Kangoo
    { phone: '+543516000011', plateNumber: 'AA 123 BB', isPrimary: false }, // Rodrigo - Kangoo (secondary)

    { phone: '+543516000003', plateNumber: 'AC 456 CD', isPrimary: true },  // Adara - Transit
    { phone: '+543516000012', plateNumber: 'AC 456 CD', isPrimary: false }, // Camila - Transit (secondary)

    { phone: '+543516000004', plateNumber: 'AD 789 EF', isPrimary: true },  // Erik - Fiorino
    { phone: '+543516000014', plateNumber: 'AD 789 EF', isPrimary: false }, // Federico - Fiorino (secondary)

    { phone: '+543516000009', plateNumber: 'AG 333 KL', isPrimary: true },  // Lucas - Hilux

    // Personal vehicles
    { phone: '+543516000005', plateNumber: 'AE 111 GH', isPrimary: true },  // Alex - VW Gol (personal)
    { phone: '+543516000016', plateNumber: 'AE 111 GH', isPrimary: false }, // Diego - VW Gol (secondary)

    { phone: '+543516000008', plateNumber: 'AF 222 IJ', isPrimary: true },  // Patricia - Spin (personal)
];

async function main() {
    console.log('🚗 Updating Vehicle Assignments...\n');

    // Find organization
    const orgs = await prisma.organization.findMany({
        include: { users: { where: { role: 'TECHNICIAN' } } },
    });
    orgs.sort((a: { users: unknown[] }, b: { users: unknown[] }) => b.users.length - a.users.length);

    const org = orgs[0];
    if (!org) {
        console.log('❌ No organization found');
        return;
    }

    const organizationId = org.id;
    console.log(`✅ Using organization: ${org.name}\n`);

    // Clear existing assignments to start fresh
    console.log('🧹 Clearing existing assignments...');
    await prisma.vehicleAssignment.deleteMany({
        where: {
            vehicle: { organizationId }
        }
    });
    console.log('   Done\n');

    // Create new assignments
    console.log('🔗 Creating vehicle assignments...');
    let created = 0;

    for (const assignment of DRIVER_ASSIGNMENTS) {
        try {
            const user = await prisma.user.findUnique({
                where: { phone: assignment.phone },
                select: { id: true, name: true, driverLicenseNumber: true },
            });

            if (!user) {
                console.log(`   ⚠️  User not found: ${assignment.phone}`);
                continue;
            }

            if (!user.driverLicenseNumber) {
                console.log(`   ⚠️  ${user.name} has no license - skipping assignment`);
                continue;
            }

            const vehicle = await prisma.vehicle.findFirst({
                where: { organizationId, plateNumber: assignment.plateNumber },
                select: { id: true, make: true, model: true },
            });

            if (!vehicle) {
                console.log(`   ⚠️  Vehicle not found: ${assignment.plateNumber}`);
                continue;
            }

            await prisma.vehicleAssignment.create({
                data: {
                    userId: user.id,
                    vehicleId: vehicle.id,
                    isPrimaryDriver: assignment.isPrimary,
                    notes: assignment.isPrimary ? 'Conductor principal' : 'Conductor secundario',
                },
            });

            const role = assignment.isPrimary ? '⭐' : '➕';
            console.log(`   ✅ ${role} ${user.name} → ${vehicle.make} ${vehicle.model}`);
            created++;
        } catch (e) {
            console.log(`   ⚠️  Error:`, e);
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 VEHICLE ASSIGNMENTS UPDATED!');
    console.log('═'.repeat(50));

    console.log(`\n📊 Created ${created} assignments\n`);

    // Show vehicle summary
    const vehicles = await prisma.vehicle.findMany({
        where: { organizationId },
        include: {
            assignments: {
                include: {
                    user: { select: { name: true } },
                },
            },
        },
    });

    console.log('🚗 Vehicle Assignments:');
    for (const v of vehicles) {
        console.log(`\n   ${v.make} ${v.model} (${v.plateNumber}):`);
        if (v.assignments.length === 0) {
            console.log('      └─ Sin conductor asignado');
        } else {
            for (const a of v.assignments) {
                const role = a.isPrimaryDriver ? '⭐ Principal' : '➕ Secundario';
                console.log(`      └─ ${a.user.name} (${role})`);
            }
        }
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
