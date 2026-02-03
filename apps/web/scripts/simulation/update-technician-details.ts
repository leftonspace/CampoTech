/**
 * Update Technicians with License & Vehicle Details
 * ==================================================
 * 
 * Directly updates existing technicians with:
 * - Driver's license information
 * - Specialty certifications/matriculas
 * - Creates missing technicians
 * 
 * Run with: npx tsx scripts/update-technician-details.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Technician updates - phone as key
const TECHNICIAN_UPDATES: Record<string, {
    licenseNumber: string | null;
    licenseCategory: string | null;
    licenseExpiry: string | null;
    specialties: string[];
    certifications: Record<string, { matricula: string; category: string }>;
}> = {
    '+543516000002': {
        licenseNumber: 'B-0234567',
        licenseCategory: 'B1',
        licenseExpiry: '2027-08-15',
        specialties: ['REFRIGERACION', 'ELECTRICISTA'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-2156', category: '1RA' },
        },
    },
    '+543516000003': {
        licenseNumber: 'B-0345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-04-10',
        specialties: ['REFRIGERACION'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-3892', category: '2DA' },
        },
    },
    '+543516000004': {
        licenseNumber: 'B-0456789',
        licenseCategory: 'B2',
        licenseExpiry: '2028-11-22',
        specialties: ['REFRIGERACION', 'GASISTA'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-4521', category: '1RA' },
            GASISTA: { matricula: 'MG-ENARGAS-9872', category: '1RA' },
        },
    },
    '+543516000005': {
        licenseNumber: 'B-0567890',
        licenseCategory: 'B1',
        licenseExpiry: '2026-07-30',
        specialties: ['GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-1234', category: '1RA' },
        },
    },
    '+543516000006': {
        licenseNumber: null, // No license
        licenseCategory: null,
        licenseExpiry: null,
        specialties: ['GASISTA', 'PLOMERO'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-5678', category: '2DA' },
        },
    },
    '+543516000011': {
        licenseNumber: 'B-0901234',
        licenseCategory: 'B1',
        licenseExpiry: '2026-09-12',
        specialties: ['PLOMERO'],
        certifications: {},
    },
    '+543516000012': {
        licenseNumber: 'B-0012345',
        licenseCategory: 'B1',
        licenseExpiry: '2027-01-20',
        specialties: ['PLOMERO', 'GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-9123', category: '2DA' },
        },
    },
    '+543516000015': {
        licenseNumber: null, // New hire
        licenseCategory: null,
        licenseExpiry: null,
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-5678', category: '2DA' },
        },
    },
    '+543516000016': {
        licenseNumber: 'B-2345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-11-15',
        specialties: ['PLOMERO', 'GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-4567', category: '1RA' },
        },
    },
};

// New technicians to create
const NEW_TECHNICIANS = [
    {
        phone: '+543516000007',
        name: 'Javier Mendoza',
        email: 'javier.mendoza@demo.campotech.com',
        licenseNumber: 'B-0678901',
        licenseCategory: 'B1',
        licenseExpiry: '2025-12-01', // Expiring soon!
        specialties: ['GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-7821', category: '1RA' },
        },
    },
    {
        phone: '+543516000008',
        name: 'Patricia Villalba',
        email: 'patricia.villalba@demo.campotech.com',
        licenseNumber: 'B-0789012',
        licenseCategory: 'B1',
        licenseExpiry: '2027-03-18',
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-4521', category: '1RA' },
        },
    },
    {
        phone: '+543516000009',
        name: 'Lucas Fernández',
        email: 'lucas.fernandez@demo.campotech.com',
        licenseNumber: 'B-0890123',
        licenseCategory: 'B1',
        licenseExpiry: '2028-06-25',
        specialties: ['ELECTRICISTA', 'REFRIGERACION'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-7892', category: '1RA' },
            REFRIGERACION: { matricula: 'MR-CABA-6234', category: '2DA' },
        },
    },
    {
        phone: '+543516000010',
        name: 'Nicolás Romero',
        email: 'nicolas.romero@demo.campotech.com',
        licenseNumber: null, // Apprentice
        licenseCategory: null,
        licenseExpiry: null,
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-2345', category: '2DA' },
        },
    },
    {
        phone: '+543516000013',
        name: 'Martín Acosta',
        email: 'martin.acosta@demo.campotech.com',
        licenseNumber: 'B-0123456',
        licenseCategory: 'B2',
        licenseExpiry: '2028-04-05',
        specialties: ['PLOMERO'],
        certifications: {},
    },
    {
        phone: '+543516000014',
        name: 'Federico López',
        email: 'federico.lopez@demo.campotech.com',
        licenseNumber: 'B-1234567',
        licenseCategory: 'C',
        licenseExpiry: '2027-09-30',
        specialties: ['REFRIGERACION', 'ELECTRICISTA', 'PLOMERO'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-8541', category: '1RA' },
            ELECTRICISTA: { matricula: 'ME-ENRE-3214', category: '1RA' },
        },
    },
];

function parseDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    return new Date(dateStr);
}

async function main() {
    console.log('🔧 Updating technician license & certification data...\n');

    // Find the main organization
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

    // Update existing technicians
    console.log('📝 Updating existing technicians...');
    let updatedCount = 0;

    for (const [phone, data] of Object.entries(TECHNICIAN_UPDATES)) {
        try {
            const result = await prisma.user.updateMany({
                where: { phone, organizationId },
                data: {
                    driverLicenseNumber: data.licenseNumber,
                    driverLicenseCategory: data.licenseCategory,
                    driverLicenseExpiry: parseDate(data.licenseExpiry),
                    specialties: data.specialties,
                    certifications: data.certifications,
                },
            });

            if (result.count > 0) {
                const licenseInfo = data.licenseNumber ? `🚗 ${data.licenseCategory}` : '🚶 Sin registro';
                console.log(`   ✅ Updated phone ${phone}: ${licenseInfo}`);
                updatedCount++;
            } else {
                console.log(`   ⏭️  Not found: ${phone}`);
            }
        } catch (e) {
            console.log(`   ⚠️  Error with ${phone}:`, e);
        }
    }
    console.log(`   Updated: ${updatedCount} technicians\n`);

    // Create new technicians
    console.log('➕ Creating new technicians...');
    let createdCount = 0;

    for (const t of NEW_TECHNICIANS) {
        try {
            // Check if exists
            const existing = await prisma.user.findUnique({ where: { phone: t.phone } });
            if (existing) {
                // Update instead
                await prisma.user.update({
                    where: { phone: t.phone },
                    data: {
                        driverLicenseNumber: t.licenseNumber,
                        driverLicenseCategory: t.licenseCategory,
                        driverLicenseExpiry: parseDate(t.licenseExpiry),
                        specialties: t.specialties,
                        certifications: t.certifications,
                    },
                });
                const licenseInfo = t.licenseNumber ? `🚗 ${t.licenseCategory}` : '🚶 Sin registro';
                console.log(`   🔄 Updated: ${t.name} - ${licenseInfo}`);
                continue;
            }

            await prisma.user.create({
                data: {
                    phone: t.phone,
                    name: t.name,
                    email: t.email,
                    role: 'TECHNICIAN',
                    organizationId,
                    isActive: true,
                    canBeAssignedJobs: true,
                    verificationStatus: 'verified',
                    driverLicenseNumber: t.licenseNumber,
                    driverLicenseCategory: t.licenseCategory,
                    driverLicenseExpiry: parseDate(t.licenseExpiry),
                    specialties: t.specialties,
                    certifications: t.certifications,
                },
            });
            const licenseInfo = t.licenseNumber ? `🚗 ${t.licenseCategory}` : '🚶 Sin registro';
            console.log(`   ✅ Created: ${t.name} - ${licenseInfo}`);
            createdCount++;
        } catch (e) {
            console.log(`   ⚠️  Error with ${t.name}:`, e);
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 UPDATE COMPLETE!');
    console.log('═'.repeat(50));

    const techCount = await prisma.user.count({
        where: { organizationId, role: 'TECHNICIAN' }
    });
    const withLicense = await prisma.user.count({
        where: {
            organizationId,
            role: 'TECHNICIAN',
            driverLicenseNumber: { not: null }
        }
    });

    console.log(`\n📊 Final Stats:`);
    console.log(`   Total Technicians: ${techCount}`);
    console.log(`   └─ With license: ${withLicense}`);
    console.log(`   └─ Without license: ${techCount - withLicense}`);

    // List all technicians with license info
    console.log('\n📋 Technician License Summary:');
    const allTechs = await prisma.user.findMany({
        where: { organizationId, role: 'TECHNICIAN' },
        select: {
            name: true,
            driverLicenseNumber: true,
            driverLicenseCategory: true,
            driverLicenseExpiry: true,
            specialties: true,
        },
        orderBy: { name: 'asc' },
    });

    for (const t of allTechs) {
        const license = t.driverLicenseNumber
            ? `${t.driverLicenseCategory} (${t.driverLicenseNumber}) exp: ${t.driverLicenseExpiry?.toISOString().split('T')[0]}`
            : 'Sin registro';
        const specs = t.specialties.length > 0 ? t.specialties.join(', ') : 'General';
        console.log(`   • ${t.name}: ${license} | ${specs}`);
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
