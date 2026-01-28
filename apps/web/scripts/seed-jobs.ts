/**
 * Seed Jobs Script - Aligned with PRICEBOOK_SCENARIOS.md
 * ========================================================
 * Creates 400 jobs with realistic distribution:
 * - 60% historical (completed)
 * - 25% current (assigned/in-progress)
 * - 15% future (pending)
 * 
 * Includes vehicle assignments with varying drivers.
 * 
 * Run with: npx tsx scripts/seed-jobs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const TOTAL_JOBS = 400;

// Service types with realistic pricing
const SERVICE_TYPES = [
    { type: 'INSTALACION_SPLIT', code: 'HVAC-INST-SPLIT', desc: 'Instalación de split', basePrice: 45000 },
    { type: 'REPARACION_SPLIT', code: 'HVAC-REP-SPLIT', desc: 'Reparación de aire acondicionado', basePrice: 25000 },
    { type: 'MANTENIMIENTO_SPLIT', code: 'HVAC-MANT-SPLIT', desc: 'Mantenimiento preventivo de aire', basePrice: 12000 },
    { type: 'INSTALACION_CALEFACTOR', code: 'HVAC-INST-CAL', desc: 'Instalación de calefactor a gas', basePrice: 35000 },
    { type: 'OTRO', code: 'PLOM-REP-CANIO', desc: 'Reparación de cañería', basePrice: 18000 },
    { type: 'OTRO', code: 'PLOM-INST-SANIT', desc: 'Instalación de sanitarios', basePrice: 28000 },
    { type: 'OTRO', code: 'PLOM-DESTAPE', desc: 'Destape de cañerías', basePrice: 15000 },
    { type: 'OTRO', code: 'PLOM-TERMO', desc: 'Instalación/reparación termotanque', basePrice: 22000 },
    { type: 'OTRO', code: 'ELEC-TABLERO', desc: 'Instalación de tablero eléctrico', basePrice: 45000 },
    { type: 'OTRO', code: 'ELEC-CABLEADO', desc: 'Tendido de cableado', basePrice: 32000 },
    { type: 'OTRO', code: 'GAS-REVISION', desc: 'Revisión de instalación de gas', basePrice: 8000 },
    { type: 'OTRO', code: 'GAS-CALEFON', desc: 'Reparación de calefón', basePrice: 18000 },
    { type: 'OTRO', code: 'REFRI-DIAG', desc: 'Diagnóstico equipo refrigeración', basePrice: 15000 },
    { type: 'OTRO', code: 'REFRI-RECARGA', desc: 'Recarga de gas refrigerante', basePrice: 45000 },
];

const CABA_ADDRESSES = [
    { street: 'Av. Santa Fe', number: '1234', neighborhood: 'Palermo', postalCode: '1425' },
    { street: 'Av. Corrientes', number: '3456', neighborhood: 'Almagro', postalCode: '1194' },
    { street: 'Calle Florida', number: '567', neighborhood: 'Microcentro', postalCode: '1005' },
    { street: 'Av. Cabildo', number: '2100', neighborhood: 'Belgrano', postalCode: '1428' },
    { street: 'Av. Rivadavia', number: '6500', neighborhood: 'Caballito', postalCode: '1406' },
    { street: 'Av. Directorio', number: '3200', neighborhood: 'Flores', postalCode: '1406' },
    { street: 'Av. San Martín', number: '4500', neighborhood: 'Villa Devoto', postalCode: '1419' },
    { street: 'Av. Córdoba', number: '2800', neighborhood: 'Recoleta', postalCode: '1187' },
    { street: 'Av. Belgrano', number: '1500', neighborhood: 'Monserrat', postalCode: '1093' },
    { street: 'Av. Juan B. Justo', number: '3600', neighborhood: 'Villa Crespo', postalCode: '1414' },
];

const CUSTOMER_NAMES = [
    'María García', 'Carlos Rodríguez', 'Ana Martínez', 'Juan Pérez', 'Laura González',
    'Roberto Sánchez', 'Patricia López', 'Diego Fernández', 'Lucía Ramírez', 'Fernando Torres',
    'Valeria Díaz', 'Martín Silva', 'Carolina Ruiz', 'Alejandro Moreno', 'Daniela Castro',
    'Sebastián Romero', 'Florencia Navarro', 'Nicolás Vargas', 'Camila Medina', 'Tomás Acosta',
];

// Helper functions
function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function generateJobNumber(index: number): string {
    return `JOB-2026-${String(index).padStart(5, '0')}`;
}

function generatePhone(): string {
    return `+54911${randomBetween(40000000, 99999999)}`;
}

// Types
interface Customer { id: string; name: string; }
interface User { id: string; name: string | null; }
interface Vehicle { id: string; plateNumber: string; }

async function main() {
    console.log('🌱 Seeding jobs database...');
    console.log(`📊 Target: ${TOTAL_JOBS} jobs\n`);

    // Find organization with the MOST technicians (this is the one with Marcelo, Adara, etc.)
    const orgsWithTechs = await prisma.organization.findMany({
        include: {
            users: {
                where: { role: 'TECHNICIAN' },
            },
            vehicles: true,
        },
    });

    // Sort by number of technicians descending
    orgsWithTechs.sort((a, b) => b.users.length - a.users.length);

    const org = orgsWithTechs[0];
    if (!org || org.users.length === 0) {
        console.log('❌ No organization with technicians found. Run seed-demo-technicians.ts first.');
        return;
    }

    const organizationId = org.id;
    console.log(`✅ Using organization: ${org.name} (${organizationId})`);

    // Get technicians
    const technicians: User[] = org.users;
    console.log(`✅ Found ${technicians.length} technicians: ${technicians.map(t => t.name).join(', ')}`);

    // Get vehicles
    const vehicles: Vehicle[] = org.vehicles;
    console.log(`✅ Found ${vehicles.length} vehicles: ${vehicles.map(v => v.plateNumber).join(', ')}`);

    // Get or create customers
    let customers: Customer[] = await prisma.customer.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        take: 50,
    });

    if (customers.length < 20) {
        console.log('🧑 Creating customers...');
        for (let i = customers.length; i < 30; i++) {
            const name = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
            const suffix = i >= CUSTOMER_NAMES.length ? ` ${Math.floor(i / CUSTOMER_NAMES.length) + 1}` : '';
            const address = randomElement(CABA_ADDRESSES);

            try {
                const customer = await prisma.customer.create({
                    data: {
                        name: `${name}${suffix}`,
                        phone: generatePhone(),
                        email: `${name.toLowerCase().replace(' ', '.')}${i}@email.com`,
                        address: {
                            street: address.street,
                            number: address.number,
                            floor: randomBetween(1, 10).toString(),
                            apartment: String.fromCharCode(65 + randomBetween(0, 5)),
                            neighborhood: address.neighborhood,
                            city: 'Buenos Aires',
                            postalCode: address.postalCode,
                        },
                        organizationId,
                    },
                    select: { id: true, name: true },
                });
                customers.push(customer);
            } catch {
                // ignore duplicates
            }
        }
    }
    console.log(`✅ Have ${customers.length} customers`);

    // Get admin/dispatcher/owner
    const admin = await prisma.user.findFirst({
        where: { organizationId, role: { in: ['DISPATCHER', 'OWNER'] } },
    });
    if (!admin) {
        console.log('❌ No dispatcher/owner found.');
        return;
    }

    // Date ranges
    const now = new Date();
    const sixMonthsAgo = addDays(now, -180);

    // Distribution
    const historicalCount = Math.floor(TOTAL_JOBS * 0.60);
    const currentCount = Math.floor(TOTAL_JOBS * 0.25);
    const futureCount = TOTAL_JOBS - historicalCount - currentCount;

    // Get existing job count to offset
    const existingCount = await prisma.job.count({ where: { organizationId } });
    let jobIndex = existingCount + 1;
    let createdCount = 0;

    // HISTORICAL JOBS (60%)
    console.log('\n📜 Creating historical jobs...');

    for (let i = 0; i < historicalCount; i++) {
        const service = randomElement(SERVICE_TYPES);
        const customer = randomElement(customers);
        const technician = randomElement(technicians);
        const scheduledDate = addDays(sixMonthsAgo, randomBetween(0, 170));
        const completedDate = addDays(scheduledDate, randomBetween(0, 2));

        const isMultiVisit = Math.random() < 0.15;
        const hasVariance = Math.random() < 0.20;
        const isEmergency = Math.random() < 0.08;
        const hasVehicle = vehicles.length > 0 && Math.random() < 0.7; // 70% have vehicle

        const basePrice = service.basePrice * (0.8 + Math.random() * 0.7);
        const estimatedTotal = Math.round(basePrice * 100) / 100;
        let techProposedTotal = null;
        let finalTotal = estimatedTotal;

        if (hasVariance) {
            const varianceDirection = Math.random() < 0.5 ? -1 : 1;
            const variancePercent = randomBetween(10, 40) / 100;
            techProposedTotal = Math.round(estimatedTotal * (1 + varianceDirection * variancePercent) * 100) / 100;
            finalTotal = techProposedTotal;
        }

        // Vehicle assignment with driver snapshot
        const vehicle = hasVehicle ? randomElement(vehicles) : null;
        const driverName = technician.name;

        const jobNumber = generateJobNumber(jobIndex);

        try {
            await prisma.job.create({
                data: {
                    jobNumber,
                    serviceType: service.type as 'INSTALACION_SPLIT' | 'REPARACION_SPLIT' | 'MANTENIMIENTO_SPLIT' | 'INSTALACION_CALEFACTOR' | 'OTRO',
                    serviceTypeCode: service.code,
                    description: `${service.desc}. ${isEmergency ? '⚠️ ATENCIÓN URGENTE.' : ''} Cliente: ${customer.name}`,
                    status: 'COMPLETED',
                    urgency: isEmergency ? 'URGENTE' : 'NORMAL',
                    scheduledDate,
                    scheduledTimeSlot: { start: `${randomBetween(8, 14)}:00`, end: `${randomBetween(15, 18)}:00` },
                    startedAt: scheduledDate,
                    completedAt: completedDate,
                    resolution: `Trabajo completado satisfactoriamente. ${hasVariance ? 'Precio ajustado según diagnóstico en sitio.' : ''}`,
                    estimatedDuration: randomBetween(60, 240),
                    actualDuration: randomBetween(45, 300),
                    durationType: isMultiVisit ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT',
                    visitCount: isMultiVisit ? randomBetween(2, 4) : 1,
                    pricingMode: isMultiVisit ? 'HYBRID' : 'FIXED_TOTAL',
                    estimatedTotal,
                    techProposedTotal,
                    finalTotal,
                    varianceApprovedAt: hasVariance ? completedDate : null,
                    varianceApprovedById: hasVariance ? admin.id : null,
                    // Vehicle & driver assignment
                    vehicleId: vehicle?.id,
                    vehiclePlateAtJob: vehicle?.plateNumber,
                    driverNameAtJob: hasVehicle ? driverName : null,
                    vehicleMileageStart: hasVehicle ? randomBetween(10000, 80000) : null,
                    vehicleMileageEnd: hasVehicle ? randomBetween(10020, 80100) : null,
                    customerId: customer.id,
                    technicianId: technician.id,
                    createdById: admin.id,
                    organizationId,
                },
            });
            createdCount++;
        } catch {
            // Skip duplicates
        }

        jobIndex++;
        if (i % 50 === 0) process.stdout.write('.');
    }
    console.log(` ✅ ${createdCount} historical`);

    const baseCreated = createdCount;

    // CURRENT JOBS (25%)
    console.log('\n🔨 Creating current jobs...');
    const currentStatuses = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] as const;

    for (let i = 0; i < currentCount; i++) {
        const service = randomElement(SERVICE_TYPES);
        const customer = randomElement(customers);
        const technician = randomElement(technicians);
        const scheduledDate = addDays(now, randomBetween(-3, 3));

        const isMultiVisit = Math.random() < 0.20;
        const hasPendingVariance = Math.random() < 0.15;
        const isEmergency = Math.random() < 0.12;
        const hasVehicle = vehicles.length > 0 && Math.random() < 0.8;

        const basePrice = service.basePrice * (0.8 + Math.random() * 0.7);
        const estimatedTotal = Math.round(basePrice * 100) / 100;
        let techProposedTotal = null;

        if (hasPendingVariance) {
            const varianceDirection = Math.random() < 0.5 ? -1 : 1;
            const variancePercent = randomBetween(15, 50) / 100;
            techProposedTotal = Math.round(estimatedTotal * (1 + varianceDirection * variancePercent) * 100) / 100;
        }

        const vehicle = hasVehicle ? randomElement(vehicles) : null;
        const jobNumber = generateJobNumber(jobIndex);
        const status = randomElement(currentStatuses);

        try {
            await prisma.job.create({
                data: {
                    jobNumber,
                    serviceType: service.type as 'INSTALACION_SPLIT' | 'REPARACION_SPLIT' | 'MANTENIMIENTO_SPLIT' | 'INSTALACION_CALEFACTOR' | 'OTRO',
                    serviceTypeCode: service.code,
                    description: `${service.desc}. ${isEmergency ? '🚨 EMERGENCIA.' : ''} Cliente: ${customer.name}`,
                    status,
                    urgency: isEmergency ? 'URGENTE' : (Math.random() < 0.3 ? 'ALTA' : 'NORMAL'),
                    scheduledDate,
                    scheduledTimeSlot: { start: `${randomBetween(8, 14)}:00`, end: `${randomBetween(15, 18)}:00` },
                    startedAt: status === 'IN_PROGRESS' ? now : null,
                    estimatedDuration: randomBetween(60, 240),
                    durationType: isMultiVisit ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT',
                    visitCount: isMultiVisit ? randomBetween(2, 4) : 1,
                    pricingMode: isMultiVisit ? 'PER_VISIT' : 'FIXED_TOTAL',
                    estimatedTotal,
                    techProposedTotal,
                    // Vehicle assignment (mileage not recorded yet for in-progress)
                    vehicleId: vehicle?.id,
                    vehiclePlateAtJob: vehicle?.plateNumber,
                    driverNameAtJob: hasVehicle ? technician.name : null,
                    vehicleMileageStart: hasVehicle && status === 'IN_PROGRESS' ? randomBetween(10000, 80000) : null,
                    customerId: customer.id,
                    technicianId: technician.id,
                    createdById: admin.id,
                    organizationId,
                },
            });
            createdCount++;
        } catch {
            // Skip
        }

        jobIndex++;
        if (i % 25 === 0) process.stdout.write('.');
    }
    console.log(` ✅ ${createdCount - baseCreated} current`);

    const preCurrentCreated = createdCount;

    // FUTURE JOBS (15%)
    console.log('\n📅 Creating future jobs...');

    for (let i = 0; i < futureCount; i++) {
        const service = randomElement(SERVICE_TYPES);
        const customer = randomElement(customers);
        const scheduledDate = addDays(now, randomBetween(1, 30));

        const isMultiVisit = Math.random() < 0.25;
        const isAssigned = Math.random() < 0.4;
        const technician = isAssigned ? randomElement(technicians) : null;

        const basePrice = service.basePrice * (0.8 + Math.random() * 0.7);
        const estimatedTotal = Math.round(basePrice * 100) / 100;

        const hasDeposit = isMultiVisit && Math.random() < 0.5;
        const depositAmount = hasDeposit ? Math.round(estimatedTotal * 0.3 * 100) / 100 : null;

        const jobNumber = generateJobNumber(jobIndex);

        try {
            await prisma.job.create({
                data: {
                    jobNumber,
                    serviceType: service.type as 'INSTALACION_SPLIT' | 'REPARACION_SPLIT' | 'MANTENIMIENTO_SPLIT' | 'INSTALACION_CALEFACTOR' | 'OTRO',
                    serviceTypeCode: service.code,
                    description: `${service.desc}. ${isMultiVisit ? 'Proyecto multi-visita.' : ''} Cliente: ${customer.name}`,
                    status: isAssigned ? 'ASSIGNED' : 'PENDING',
                    urgency: 'NORMAL',
                    scheduledDate,
                    scheduledTimeSlot: { start: `${randomBetween(8, 14)}:00`, end: `${randomBetween(15, 18)}:00` },
                    estimatedDuration: randomBetween(60, 480),
                    durationType: isMultiVisit ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT',
                    visitCount: isMultiVisit ? randomBetween(2, 5) : 1,
                    durationDays: isMultiVisit ? randomBetween(3, 14) : null,
                    pricingMode: isMultiVisit ? 'HYBRID' : 'FIXED_TOTAL',
                    estimatedTotal,
                    depositAmount,
                    depositPaidAt: hasDeposit ? addDays(now, -randomBetween(1, 7)) : null,
                    depositPaymentMethod: hasDeposit ? randomElement(['TRANSFER', 'CASH', 'MERCADOPAGO']) : null,
                    customerId: customer.id,
                    technicianId: technician?.id,
                    createdById: admin.id,
                    organizationId,
                },
            });
            createdCount++;
        } catch {
            // Skip
        }

        jobIndex++;
        if (i % 15 === 0) process.stdout.write('.');
    }
    console.log(` ✅ ${createdCount - preCurrentCreated} future`);

    // SUMMARY
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 SEED COMPLETED!');
    console.log('═'.repeat(50));
    console.log(`📊 Total jobs created: ${createdCount}`);

    // Stats
    const stats = await prisma.job.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
    });
    console.log('\n📈 Jobs by status:');
    stats.forEach((s: { status: string; _count: number }) => console.log(`   ${s.status}: ${s._count}`));

    const varianceCount = await prisma.job.count({
        where: {
            organizationId,
            techProposedTotal: { not: null },
            varianceApprovedAt: null,
            varianceRejectedAt: null,
        },
    });
    console.log(`\n⚠️  Pending variance approvals: ${varianceCount}`);

    const vehicleJobs = await prisma.job.count({
        where: { organizationId, vehicleId: { not: null } },
    });
    console.log(`🚗 Jobs with vehicle assigned: ${vehicleJobs}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
