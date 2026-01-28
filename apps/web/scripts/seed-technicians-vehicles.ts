/**
 * Seed Technicians & Vehicles with Full Details
 * ================================================
 * 
 * Creates 15 technicians and 6 vehicles with realistic Argentine data:
 * 
 * TECHNICIANS:
 * - Driver's license (some without, various categories)
 * - Specialty matriculas (GASISTA, ELECTRICISTA, etc.)
 * - Multiple specialties support
 * - ART (Aseguradora de Riesgos del Trabajo) data
 * 
 * VEHICLES:
 * - VTV (Verificación Técnica Vehicular) expiry dates
 * - Seguro (Insurance) with policies
 * - Registro (Registration) dates
 * - Mix of company vehicles and personal vehicles
 * - Primary driver assignments
 * 
 * Run with: npx tsx scripts/seed-technicians-vehicles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN DATA (15 technicians with realistic Argentine data)
// ═══════════════════════════════════════════════════════════════════════════════

const TECHNICIANS = [
    // ─────────────────────────────────────────────────────────────────────────────
    // REFRIGERACIÓN specialists
    // ─────────────────────────────────────────────────────────────────────────────
    {
        phone: '+543516000002',
        name: 'Marcelo Conta',
        email: 'marcelo.conta@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-2156', category: '1RA', issueDate: '2019-03-15' },
        },
        hasLicense: true,
        licenseNumber: 'B-0234567',
        licenseCategory: 'B1',
        licenseExpiry: '2027-08-15',
        uocraLevel: 'OFICIAL_ESPECIALIZADO',
        vehicleIndex: 0, // Primary driver of first vehicle
    },
    {
        phone: '+543516000003',
        name: 'Adara Esber',
        email: 'adara.esber@demo.campotech.com',
        specialties: ['REFRIGERACION'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-3892', category: '2DA', issueDate: '2021-06-20' },
        },
        hasLicense: true,
        licenseNumber: 'B-0345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-04-10',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 1,
    },
    {
        phone: '+543516000004',
        name: 'Erik Conta',
        email: 'erik.conta@demo.campotech.com',
        specialties: ['REFRIGERACION', 'GASISTA'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-4521', category: '1RA', issueDate: '2018-09-01' },
            GASISTA: { matricula: 'MG-ENARGAS-9872', category: '1RA', issueDate: '2020-01-15' },
        },
        hasLicense: true,
        licenseNumber: 'B-0456789',
        licenseCategory: 'B2', // Can drive larger vehicles
        licenseExpiry: '2028-11-22',
        uocraLevel: 'OFICIAL_ESPECIALIZADO',
        vehicleIndex: 2,
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // GASISTAS (Gas technicians - need ENARGAS matricula)
    // ─────────────────────────────────────────────────────────────────────────────
    {
        phone: '+543516000005',
        name: 'Alex Conta',
        email: 'alex.conta@demo.campotech.com',
        specialties: ['GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-1234', category: '1RA', issueDate: '2017-05-20' },
        },
        hasLicense: true,
        licenseNumber: 'B-0567890',
        licenseCategory: 'B1',
        licenseExpiry: '2026-07-30',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 3, // Personal vehicle
    },
    {
        phone: '+543516000006',
        name: 'Mathieu PG',
        email: 'mathieu.pg@demo.campotech.com',
        specialties: ['GASISTA', 'PLOMERO'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-5678', category: '2DA', issueDate: '2022-01-10' },
        },
        hasLicense: false, // No license - will ride with others
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'MEDIO_OFICIAL',
        vehicleIndex: null,
    },
    {
        phone: '+543516000007',
        name: 'Javier Mendoza',
        email: 'javier.mendoza@demo.campotech.com',
        specialties: ['GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-7821', category: '1RA', issueDate: '2016-08-15' },
        },
        hasLicense: true,
        licenseNumber: 'B-0678901',
        licenseCategory: 'B1',
        licenseExpiry: '2025-12-01', // Expiring soon!
        uocraLevel: 'OFICIAL_ESPECIALIZADO',
        vehicleIndex: null, // No vehicle assigned
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // ELECTRICISTAS
    // ─────────────────────────────────────────────────────────────────────────────
    {
        phone: '+543516000008',
        name: 'Patricia Villalba',
        email: 'patricia.villalba@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-4521', category: '1RA', issueDate: '2019-11-20' },
        },
        hasLicense: true,
        licenseNumber: 'B-0789012',
        licenseCategory: 'B1',
        licenseExpiry: '2027-03-18',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 4, // Personal vehicle
    },
    {
        phone: '+543516000009',
        name: 'Lucas Fernández',
        email: 'lucas.fernandez@demo.campotech.com',
        specialties: ['ELECTRICISTA', 'REFRIGERACION'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-7892', category: '1RA', issueDate: '2018-04-10' },
            REFRIGERACION: { matricula: 'MR-CABA-6234', category: '2DA', issueDate: '2021-09-05' },
        },
        hasLicense: true,
        licenseNumber: 'B-0890123',
        licenseCategory: 'B1',
        licenseExpiry: '2028-06-25',
        uocraLevel: 'OFICIAL_ESPECIALIZADO',
        vehicleIndex: 5,
    },
    {
        phone: '+543516000010',
        name: 'Nicolás Romero',
        email: 'nicolas.romero@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-2345', category: '2DA', issueDate: '2023-02-01' },
        },
        hasLicense: false, // Apprentice, no license yet
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'AYUDANTE',
        vehicleIndex: null,
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // PLOMEROS
    // ─────────────────────────────────────────────────────────────────────────────
    {
        phone: '+543516000011',
        name: 'Rodrigo Silva',
        email: 'rodrigo.silva@demo.campotech.com',
        specialties: ['PLOMERO'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-0901234',
        licenseCategory: 'B1',
        licenseExpiry: '2026-09-12',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 0, // Secondary driver on company van
    },
    {
        phone: '+543516000012',
        name: 'Camila Torres',
        email: 'camila.torres@demo.campotech.com',
        specialties: ['PLOMERO', 'GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-9123', category: '2DA', issueDate: '2022-07-15' },
        },
        hasLicense: true,
        licenseNumber: 'B-0012345',
        licenseCategory: 'B1',
        licenseExpiry: '2027-01-20',
        uocraLevel: 'MEDIO_OFICIAL',
        vehicleIndex: 1, // Secondary driver
    },
    {
        phone: '+543516000013',
        name: 'Martín Acosta',
        email: 'martin.acosta@demo.campotech.com',
        specialties: ['PLOMERO'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-0123456',
        licenseCategory: 'B2',
        licenseExpiry: '2028-04-05',
        uocraLevel: 'OFICIAL',
        vehicleIndex: null,
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // MULTI-TRADE / GENERAL
    // ─────────────────────────────────────────────────────────────────────────────
    {
        phone: '+543516000014',
        name: 'Federico López',
        email: 'federico.lopez@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA', 'PLOMERO'],
        certifications: {
            REFRIGERACION: { matricula: 'MR-CABA-8541', category: '1RA', issueDate: '2015-10-01' },
            ELECTRICISTA: { matricula: 'ME-ENRE-3214', category: '1RA', issueDate: '2016-03-15' },
        },
        hasLicense: true,
        licenseNumber: 'B-1234567',
        licenseCategory: 'C', // Commercial license
        licenseExpiry: '2027-09-30',
        uocraLevel: 'OFICIAL_ESPECIALIZADO',
        vehicleIndex: 2, // Secondary on larger van
    },
    {
        phone: '+543516000015',
        name: 'Valentina García',
        email: 'valentina.garcia@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {
            ELECTRICISTA: { matricula: 'ME-ENRE-5678', category: '2DA', issueDate: '2023-06-01' },
        },
        hasLicense: false, // New hire, learning
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'AYUDANTE',
        vehicleIndex: null,
    },
    {
        phone: '+543516000016',
        name: 'Diego Morales',
        email: 'diego.morales@demo.campotech.com',
        specialties: ['PLOMERO', 'GASISTA'],
        certifications: {
            GASISTA: { matricula: 'MG-ENARGAS-4567', category: '1RA', issueDate: '2018-12-01' },
        },
        hasLicense: true,
        licenseNumber: 'B-2345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-11-15',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 3, // Secondary on personal vehicle
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE DATA (6 vehicles - mix of company and personal)
// ═══════════════════════════════════════════════════════════════════════════════

const VEHICLES = [
    // COMPANY VEHICLES (owned by organization)
    {
        plateNumber: 'AA 123 BB',
        make: 'Renault',
        model: 'Kangoo',
        year: 2022,
        color: 'Blanco',
        vin: 'VF1FC0JEF63456789',
        fuelType: 'GASOLINE',
        currentMileage: 45230,
        isCompanyOwned: true,
        insuranceCompany: 'La Segunda',
        insurancePolicy: 'POL-2024-001234',
        insuranceExpiry: '2026-08-15',
        vtvExpiry: '2026-06-20',
        registrationExpiry: '2027-01-15',
        notes: 'Vehículo principal de la empresa. Equipado con herramientas básicas.',
    },
    {
        plateNumber: 'AC 456 CD',
        make: 'Ford',
        model: 'Transit Connect',
        year: 2021,
        color: 'Gris',
        vin: 'WF0XXXGC7X1234567',
        fuelType: 'DIESEL',
        currentMileage: 62450,
        isCompanyOwned: true,
        insuranceCompany: 'Federación Patronal',
        insurancePolicy: 'POL-2024-005678',
        insuranceExpiry: '2026-05-01',
        vtvExpiry: '2026-04-10',
        registrationExpiry: '2026-12-20',
        notes: 'Utilitario grande para trabajos de refrigeración comercial.',
    },
    {
        plateNumber: 'AD 789 EF',
        make: 'Fiat',
        model: 'Fiorino',
        year: 2023,
        color: 'Azul',
        vin: '9BD37400LA1234567',
        fuelType: 'GASOLINE',
        currentMileage: 18500,
        isCompanyOwned: true,
        insuranceCompany: 'Sancor Seguros',
        insurancePolicy: 'POL-2024-009012',
        insuranceExpiry: '2026-11-30',
        vtvExpiry: '2027-02-15', // Recently inspected
        registrationExpiry: '2027-06-01',
        notes: 'Vehículo nuevo. Bajo kilometraje.',
    },

    // PERSONAL VEHICLES (owned by technicians, used for work)
    {
        plateNumber: 'AE 111 GH',
        make: 'Volkswagen',
        model: 'Gol Trend',
        year: 2019,
        color: 'Negro',
        vin: '9BWAB45U1ET123456',
        fuelType: 'GASOLINE',
        currentMileage: 78900,
        isCompanyOwned: false, // Personal vehicle
        insuranceCompany: 'Mercantil Andina',
        insurancePolicy: 'POL-PERS-001234',
        insuranceExpiry: '2026-03-20', // Expiring soon!
        vtvExpiry: '2026-02-28', // EXPIRED - needs attention
        registrationExpiry: '2026-08-15',
        notes: 'Vehículo personal de Alex Conta. Uso autorizado para trabajo.',
    },
    {
        plateNumber: 'AF 222 IJ',
        make: 'Chevrolet',
        model: 'Spin',
        year: 2020,
        color: 'Plata',
        vin: '9BG192RXYK1234567',
        fuelType: 'GASOLINE',
        currentMileage: 54300,
        isCompanyOwned: false, // Personal vehicle
        insuranceCompany: 'Zurich',
        insurancePolicy: 'POL-PERS-005678',
        insuranceExpiry: '2026-09-10',
        vtvExpiry: '2026-07-25',
        registrationExpiry: '2027-02-28',
        notes: 'Vehículo personal de Patricia Villalba. 7 plazas para equipo.',
    },
    {
        plateNumber: 'AG 333 KL',
        make: 'Toyota',
        model: 'Hilux',
        year: 2022,
        color: 'Rojo',
        vin: 'MR0FR22G7N1234567',
        fuelType: 'DIESEL',
        currentMileage: 35600,
        isCompanyOwned: true,
        insuranceCompany: 'La Segunda',
        insurancePolicy: 'POL-2024-012345',
        insuranceExpiry: '2026-10-15',
        vtvExpiry: '2026-09-30',
        registrationExpiry: '2027-04-15',
        notes: 'Camioneta para trabajos pesados y zonas de difícil acceso.',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function parseDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    return new Date(dateStr);
}

async function main() {
    console.log('🌱 Seeding Technicians & Vehicles with Full Details...\n');

    // Find organization with most technicians
    const orgs = await prisma.organization.findMany({
        include: { users: { where: { role: 'TECHNICIAN' } } },
    });
    orgs.sort((a, b) => b.users.length - a.users.length);

    const org = orgs[0];
    if (!org) {
        console.log('❌ No organization found');
        return;
    }

    const organizationId = org.id;
    console.log(`✅ Using organization: ${org.name} (${organizationId})\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED VEHICLES FIRST (so we can assign to technicians)
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('🚗 Seeding Vehicles...');

    const vehicleIds: string[] = [];

    for (const v of VEHICLES) {
        try {
            const vehicle = await prisma.vehicle.upsert({
                where: {
                    organizationId_plateNumber: {
                        organizationId,
                        plateNumber: v.plateNumber
                    }
                },
                update: {
                    make: v.make,
                    model: v.model,
                    year: v.year,
                    color: v.color,
                    vin: v.vin,
                    fuelType: v.fuelType as 'GASOLINE' | 'DIESEL' | 'GAS' | 'HYBRID' | 'ELECTRIC',
                    currentMileage: v.currentMileage,
                    insuranceCompany: v.insuranceCompany,
                    insurancePolicyNumber: v.insurancePolicy,
                    insuranceExpiry: parseDate(v.insuranceExpiry),
                    vtvExpiry: parseDate(v.vtvExpiry),
                    registrationExpiry: parseDate(v.registrationExpiry),
                    notes: v.notes,
                    status: 'ACTIVE',
                },
                create: {
                    plateNumber: v.plateNumber,
                    make: v.make,
                    model: v.model,
                    year: v.year,
                    color: v.color,
                    vin: v.vin,
                    fuelType: v.fuelType as 'GASOLINE' | 'DIESEL' | 'GAS' | 'HYBRID' | 'ELECTRIC',
                    currentMileage: v.currentMileage,
                    insuranceCompany: v.insuranceCompany,
                    insurancePolicyNumber: v.insurancePolicy,
                    insuranceExpiry: parseDate(v.insuranceExpiry),
                    vtvExpiry: parseDate(v.vtvExpiry),
                    registrationExpiry: parseDate(v.registrationExpiry),
                    notes: v.notes,
                    status: 'ACTIVE',
                    organizationId,
                },
            });
            vehicleIds.push(vehicle.id);
            const ownership = v.isCompanyOwned ? '🏢 Empresa' : '👤 Personal';
            console.log(`   ✅ ${v.make} ${v.model} (${v.plateNumber}) - ${ownership}`);
        } catch (e) {
            console.log(`   ⚠️  Error with ${v.plateNumber}:`, e);
            vehicleIds.push(''); // Placeholder
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED TECHNICIANS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n👷 Seeding Technicians...');

    const userIds: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const t of TECHNICIANS) {
        try {
            const existingUser = await prisma.user.findUnique({
                where: { phone: t.phone },
            });

            const userData = {
                name: t.name,
                email: t.email,
                role: 'TECHNICIAN' as const,
                specialties: t.specialties,
                certifications: t.certifications,
                isActive: true,
                verificationStatus: 'verified' as const,
                canBeAssignedJobs: true,
                // Driver's license
                driverLicenseNumber: t.licenseNumber,
                driverLicenseCategory: t.licenseCategory,
                driverLicenseExpiry: parseDate(t.licenseExpiry),
                // UOCRA level
                uocraLevel: t.uocraLevel as 'NONE' | 'AYUDANTE' | 'MEDIO_OFICIAL' | 'OFICIAL' | 'OFICIAL_ESPECIALIZADO',
                // ART data (sample)
                artProvider: 'Experta ART',
                artPolicyNumber: `ART-${t.phone.slice(-4)}-2026`,
                artExpiryDate: new Date('2026-12-31'),
                backgroundCheckStatus: 'approved',
                backgroundCheckDate: new Date('2024-06-15'),
            };

            if (existingUser) {
                await prisma.user.update({
                    where: { phone: t.phone },
                    data: userData,
                });
                userIds.push(existingUser.id);
                updatedCount++;
                const licenseStatus = t.hasLicense ? `🚗 ${t.licenseCategory}` : '🚶 Sin registro';
                console.log(`   🔄 Updated: ${t.name} (${t.specialties.join(', ')}) - ${licenseStatus}`);
            } else {
                const user = await prisma.user.create({
                    data: {
                        phone: t.phone,
                        organizationId,
                        ...userData,
                    },
                });
                userIds.push(user.id);
                createdCount++;
                const licenseStatus = t.hasLicense ? `🚗 ${t.licenseCategory}` : '🚶 Sin registro';
                console.log(`   ✅ Created: ${t.name} (${t.specialties.join(', ')}) - ${licenseStatus}`);
            }
        } catch (e) {
            console.log(`   ⚠️  Error with ${t.name}:`, e);
            userIds.push('');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ASSIGN DRIVERS TO VEHICLES
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n🔗 Assigning Drivers to Vehicles...');

    let assignmentCount = 0;

    for (let i = 0; i < TECHNICIANS.length; i++) {
        const t = TECHNICIANS[i];
        if (t.vehicleIndex === null || !t.hasLicense) continue;

        const userId = userIds[i];
        const vehicleId = vehicleIds[t.vehicleIndex];

        if (!userId || !vehicleId) continue;

        try {
            // Check if assignment exists
            const existing = await prisma.vehicleAssignment.findFirst({
                where: { userId, vehicleId },
            });

            if (existing) {
                console.log(`   ⏭️  ${t.name} already assigned to vehicle`);
                continue;
            }

            // Determine if primary driver (first person assigned to this vehicle)
            const existingAssignments = await prisma.vehicleAssignment.count({
                where: { vehicleId },
            });
            const isPrimary = existingAssignments === 0;

            await prisma.vehicleAssignment.create({
                data: {
                    userId,
                    vehicleId,
                    isPrimaryDriver: isPrimary,
                    notes: isPrimary ? 'Conductor principal' : 'Conductor secundario',
                },
            });

            const vehicle = VEHICLES[t.vehicleIndex];
            const role = isPrimary ? '⭐ Principal' : '➕ Secundario';
            console.log(`   ✅ ${t.name} → ${vehicle.make} ${vehicle.model} (${role})`);
            assignmentCount++;
        } catch (e) {
            console.log(`   ⚠️  Error assigning ${t.name}:`, e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 TECHNICIANS & VEHICLES SEED COMPLETED!');
    console.log('═'.repeat(60));

    // Statistics
    const techCount = await prisma.user.count({
        where: { organizationId, role: 'TECHNICIAN' }
    });
    const withLicense = await prisma.user.count({
        where: { organizationId, role: 'TECHNICIAN', driverLicenseNumber: { not: null } }
    });
    const vehicleCount = await prisma.vehicle.count({ where: { organizationId } });
    const assignments = await prisma.vehicleAssignment.count();

    console.log(`\n📊 Summary:`);
    console.log(`   Technicians: ${techCount} (${createdCount} new, ${updatedCount} updated)`);
    console.log(`   └─ With driver's license: ${withLicense}`);
    console.log(`   └─ Without license: ${techCount - withLicense}`);
    console.log(`   Vehicles: ${vehicleCount}`);
    console.log(`   └─ Company owned: ${VEHICLES.filter(v => v.isCompanyOwned).length}`);
    console.log(`   └─ Personal: ${VEHICLES.filter(v => !v.isCompanyOwned).length}`);
    console.log(`   Driver Assignments: ${assignments}`);

    // Warnings
    console.log('\n⚠️  Expiring Soon:');
    const expiringVtv = await prisma.vehicle.findMany({
        where: {
            organizationId,
            vtvExpiry: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        },
        select: { plateNumber: true, vtvExpiry: true },
    });
    for (const v of expiringVtv) {
        const date = v.vtvExpiry?.toISOString().split('T')[0];
        console.log(`   🚗 ${v.plateNumber} - VTV: ${date}`);
    }

    const expiringLicense = await prisma.user.findMany({
        where: {
            organizationId,
            role: 'TECHNICIAN',
            driverLicenseExpiry: { lt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
        },
        select: { name: true, driverLicenseExpiry: true },
    });
    for (const u of expiringLicense) {
        const date = u.driverLicenseExpiry?.toISOString().split('T')[0];
        console.log(`   👤 ${u.name} - Registro: ${date}`);
    }

    console.log('\n📱 Technician Login Info:');
    console.log('   All technicians can login using OTP code: 123456');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
