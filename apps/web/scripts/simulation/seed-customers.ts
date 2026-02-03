/**
 * Seed Customers
 * ===============
 * 
 * Creates realistic customers for a field service company in Argentina:
 * 
 * CUSTOMER TYPES:
 * - Residential (casas, departamentos, PHs)
 * - Commercial (oficinas, locales, empresas)
 * - VIP customers
 * 
 * LOCATIONS:
 * - CABA (Palermo, Belgrano, Recoleta, Caballito, etc.)
 * - GBA Norte (Vicente López, San Isidro)
 * - GBA Sur (Avellaneda, Lanús)
 * 
 * Run with: npx tsx scripts/simulation/seed-customers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER DATA
// Realistic Argentine customers with coordinates in the correct format
// ═══════════════════════════════════════════════════════════════════════════════

const CUSTOMERS = [
    // ─────────────────────────────────────────────────────────────────────────────
    // RESIDENCIALES - CABA
    // ─────────────────────────────────────────────────────────────────────────────
    {
        name: 'María García',
        phone: '+541144445555',
        email: 'maria.garcia@gmail.com',
        address: {
            street: 'Av. Córdoba 1234',
            floor: '5',
            apartment: 'B',
            city: 'CABA',
            neighborhood: 'Palermo',
            postalCode: 'C1055AAB',
            coordinates: { lat: -34.5956, lng: -58.4003 },
        },
        notes: 'Departamento en edificio antiguo, timbre no anda. Llamar al llegar.',
        isVip: false,
        customerNumber: 'CLI-001',
    },
    {
        name: 'Carlos Rodríguez',
        phone: '+541155556666',
        email: 'carlos.rodriguez@hotmail.com',
        address: {
            street: 'Av. Cabildo 2890',
            floor: '8',
            apartment: 'C',
            city: 'CABA',
            neighborhood: 'Belgrano',
            postalCode: 'C1428AAH',
            coordinates: { lat: -34.5611, lng: -58.4587 },
        },
        notes: 'Tiene perro grande. Avisar antes de entrar.',
        isVip: false,
        customerNumber: 'CLI-002',
    },
    {
        name: 'Laura Martínez',
        phone: '+541166667777',
        email: 'laura.martinez@gmail.com',
        address: {
            street: 'Juncal 3456',
            floor: '12',
            apartment: 'A',
            city: 'CABA',
            neighborhood: 'Recoleta',
            postalCode: 'C1425ATB',
            coordinates: { lat: -34.5875, lng: -58.3932 },
        },
        notes: 'Cliente frecuente. Siempre ofrece café.',
        isVip: true,
        customerNumber: 'CLI-003',
    },
    {
        name: 'Roberto Fernández',
        phone: '+541177778888',
        email: 'roberto.fernandez@yahoo.com',
        address: {
            street: 'Av. Rivadavia 5678',
            floor: null,
            apartment: null,
            city: 'CABA',
            neighborhood: 'Caballito',
            postalCode: 'C1406GNN',
            coordinates: { lat: -34.6194, lng: -58.4387 },
            propertyType: 'Casa',
        },
        notes: 'Casa con jardín trasero. Acceso por garage.',
        isVip: false,
        customerNumber: 'CLI-004',
    },
    {
        name: 'Ana López',
        phone: '+541188889999',
        email: 'ana.lopez@gmail.com',
        address: {
            street: 'Av. Corrientes 4500',
            floor: '3',
            apartment: 'D',
            city: 'CABA',
            neighborhood: 'Almagro',
            postalCode: 'C1195AAL',
            coordinates: { lat: -34.6037, lng: -58.4252 },
        },
        notes: 'Solo disponible después de las 18hs.',
        isVip: false,
        customerNumber: 'CLI-005',
    },
    {
        name: 'Consorcio Edificio Las Flores',
        phone: '+541199990000',
        email: 'administracion@edificiolasflores.com',
        address: {
            street: 'Av. Santa Fe 3200',
            floor: 'PB',
            apartment: 'Encargado',
            city: 'CABA',
            neighborhood: 'Palermo',
            postalCode: 'C1425BGP',
            coordinates: { lat: -34.5886, lng: -58.4114 },
            propertyType: 'Edificio',
            unitsCount: 48,
        },
        notes: 'Consorcio grande. Contactar al encargado Pedro. Tiene contrato de mantenimiento.',
        isVip: true,
        customerNumber: 'CLI-006',
    },
    {
        name: 'Gustavo Pérez',
        phone: '+541100001111',
        email: 'gustavo.perez@gmail.com',
        address: {
            street: 'Thames 2340',
            floor: '4',
            apartment: 'F',
            city: 'CABA',
            neighborhood: 'Palermo Soho',
            postalCode: 'C1425FID',
            coordinates: { lat: -34.5872, lng: -58.4242 },
        },
        notes: null,
        isVip: false,
        customerNumber: 'CLI-007',
    },
    {
        name: 'Silvia Ramírez',
        phone: '+541111112222',
        email: 'silvia.ramirez@outlook.com',
        address: {
            street: 'Av. Díaz Vélez 4890',
            floor: '6',
            apartment: 'B',
            city: 'CABA',
            neighborhood: 'Caballito',
            postalCode: 'C1405DCP',
            coordinates: { lat: -34.6156, lng: -58.4423 },
        },
        notes: 'Edificio con portería las 24hs.',
        isVip: false,
        customerNumber: 'CLI-008',
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // RESIDENCIALES - GBA NORTE
    // ─────────────────────────────────────────────────────────────────────────────
    {
        name: 'Fernando González',
        phone: '+541122223333',
        email: 'fernando.gonzalez@gmail.com',
        address: {
            street: 'Av. Del Libertador 14500',
            floor: null,
            apartment: null,
            city: 'Vicente López',
            neighborhood: 'La Lucila',
            postalCode: 'B1636',
            coordinates: { lat: -34.4891, lng: -58.4892 },
            propertyType: 'Casa',
        },
        notes: 'Casa grande. Portón eléctrico, dar el nombre al llegar.',
        isVip: true,
        customerNumber: 'CLI-009',
    },
    {
        name: 'Marta Sánchez',
        phone: '+541133334444',
        email: 'marta.sanchez@gmail.com',
        address: {
            street: 'Av. Centenario 890',
            floor: '10',
            apartment: 'A',
            city: 'San Isidro',
            neighborhood: 'Centro',
            postalCode: 'B1642',
            coordinates: { lat: -34.4744, lng: -58.5281 },
        },
        notes: 'Torre nueva con cocheras. Avisar número de patente.',
        isVip: false,
        customerNumber: 'CLI-010',
    },
    {
        name: 'Barrio Privado Los Álamos - Admin',
        phone: '+541144445544',
        email: 'administracion@losalamos.com.ar',
        address: {
            street: 'Acceso Norte km 42',
            floor: null,
            apartment: 'Oficina Administración',
            city: 'Tigre',
            neighborhood: 'Nordelta',
            postalCode: 'B1670',
            coordinates: { lat: -34.4085, lng: -58.6535 },
            propertyType: 'Barrio Privado',
            unitsCount: 280,
        },
        notes: 'Contrato de mantenimiento para 280 casas. Coordinan con seguridad.',
        isVip: true,
        customerNumber: 'CLI-011',
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // RESIDENCIALES - GBA SUR
    // ─────────────────────────────────────────────────────────────────────────────
    {
        name: 'Diego Moreno',
        phone: '+541155554433',
        email: 'diego.moreno@hotmail.com',
        address: {
            street: 'Av. Mitre 734',
            floor: '2',
            apartment: 'C',
            city: 'Avellaneda',
            neighborhood: 'Centro',
            postalCode: 'B1870',
            coordinates: { lat: -34.6627, lng: -58.3656 },
        },
        notes: 'Edificio sobre comercio. Entrada por costado.',
        isVip: false,
        customerNumber: 'CLI-012',
    },
    {
        name: 'Cecilia Torres',
        phone: '+541166665544',
        email: 'cecilia.torres@gmail.com',
        address: {
            street: 'Hipólito Yrigoyen 4120',
            floor: null,
            apartment: null,
            city: 'Lanús',
            neighborhood: 'Lanús Oeste',
            postalCode: 'B1824',
            coordinates: { lat: -34.6948, lng: -58.4008 },
            propertyType: 'PH',
        },
        notes: 'PH contrafrente. Tocar timbre largo.',
        isVip: false,
        customerNumber: 'CLI-013',
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // COMERCIALES
    // ─────────────────────────────────────────────────────────────────────────────
    {
        name: 'Restaurante La Parrilla de Juan',
        phone: '+541177776655',
        email: 'contacto@laparrilladejuan.com.ar',
        address: {
            street: 'Av. Figueroa Alcorta 7890',
            floor: 'PB',
            apartment: 'Local 12',
            city: 'CABA',
            neighborhood: 'Núñez',
            postalCode: 'C1428BIL',
            coordinates: { lat: -34.5452, lng: -58.4549 },
            propertyType: 'Local Comercial',
            businessType: 'Gastronomía',
        },
        notes: 'Restaurante grande. Atender fuera de horario de almuerzo (14-17hs ideal).',
        isVip: true,
        customerNumber: 'CLI-014',
    },
    {
        name: 'Oficinas Tech Solutions',
        phone: '+541188887766',
        email: 'facilities@techsolutions.com.ar',
        address: {
            street: 'Av. Madero 1200',
            floor: '15',
            apartment: 'Piso completo',
            city: 'CABA',
            neighborhood: 'Puerto Madero',
            postalCode: 'C1106BKC',
            coordinates: { lat: -34.6143, lng: -58.3656 },
            propertyType: 'Oficina Comercial',
            businessType: 'Tecnología',
            surfaceM2: 800,
        },
        notes: 'Oficina corporativa. 15 equipos de aire. Coordinar con facilities.',
        isVip: true,
        customerNumber: 'CLI-015',
    },
    {
        name: 'Supermercado El Trébol',
        phone: '+541199998877',
        email: 'mantenimiento@eltrebol.com.ar',
        address: {
            street: 'Av. Juan B. Justo 3400',
            floor: null,
            apartment: null,
            city: 'CABA',
            neighborhood: 'Villa Crespo',
            postalCode: 'C1414DQN',
            coordinates: { lat: -34.5997, lng: -58.4382 },
            propertyType: 'Local Comercial',
            businessType: 'Supermercado',
            surfaceM2: 1200,
        },
        notes: 'Supermercado con heladeras y cámaras frigoríficas. Emergencias 24hs.',
        isVip: true,
        customerNumber: 'CLI-016',
    },
    {
        name: 'Gimnasio PowerFit',
        phone: '+541100009988',
        email: 'info@powerfit.com.ar',
        address: {
            street: 'Av. Scalabrini Ortiz 2890',
            floor: 'PB y Subsuelo',
            apartment: null,
            city: 'CABA',
            neighborhood: 'Palermo',
            postalCode: 'C1425DBP',
            coordinates: { lat: -34.5912, lng: -58.4239 },
            propertyType: 'Local Comercial',
            businessType: 'Gimnasio',
        },
        notes: 'Gimnasio con duchas y climatización. Mejor antes de las 10hs.',
        isVip: false,
        customerNumber: 'CLI-017',
    },
    {
        name: 'Hotel Boutique Recoleta',
        phone: '+541111110099',
        email: 'gerencia@hotelboutiquerecoleta.com',
        address: {
            street: 'Av. Alvear 1890',
            floor: null,
            apartment: null,
            city: 'CABA',
            neighborhood: 'Recoleta',
            postalCode: 'C1129AAQ',
            coordinates: { lat: -34.5881, lng: -58.3913 },
            propertyType: 'Hotel',
            businessType: 'Hotelería',
            roomsCount: 45,
        },
        notes: 'Hotel 4 estrellas. 45 habitaciones con aire. Coordinar por recepción.',
        isVip: true,
        customerNumber: 'CLI-018',
    },
    {
        name: 'Farmacia Central',
        phone: '+541122221100',
        email: 'farmaciacentral@gmail.com',
        address: {
            street: 'Av. Corrientes 1234',
            floor: null,
            apartment: null,
            city: 'CABA',
            neighborhood: 'Centro',
            postalCode: 'C1043AAB',
            coordinates: { lat: -34.6037, lng: -58.3816 },
            propertyType: 'Local Comercial',
            businessType: 'Farmacia',
        },
        notes: 'Farmacia de turno. Heladera para medicamentos crítica.',
        isVip: false,
        customerNumber: 'CLI-019',
    },
    {
        name: 'Clínica San Antonio',
        phone: '+541133332211',
        email: 'mantenimiento@clinicasanantonio.com.ar',
        address: {
            street: 'Av. Pueyrredón 2456',
            floor: null,
            apartment: null,
            city: 'CABA',
            neighborhood: 'Recoleta',
            postalCode: 'C1119ACO',
            coordinates: { lat: -34.5937, lng: -58.3998 },
            propertyType: 'Clínica',
            businessType: 'Salud',
            bedsCount: 120,
        },
        notes: 'Clínica privada. Sistemas críticos. Emergencias prioritarias.',
        isVip: true,
        customerNumber: 'CLI-020',
    },
];

async function main() {
    console.log('🌱 Seeding Customers...\n');

    // Find organization with most technicians
    const orgs = await prisma.organization.findMany({
        include: { users: { where: { role: 'TECHNICIAN' } } },
    });
    orgs.sort((a: typeof orgs[number], b: typeof orgs[number]) => b.users.length - a.users.length);

    const org = orgs[0];
    if (!org) {
        console.log('❌ No organization found');
        return;
    }

    const organizationId = org.id;
    console.log(`✅ Using organization: ${org.name} (${organizationId})\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED CUSTOMERS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('👥 Seeding Customers...');

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const c of CUSTOMERS) {
        try {
            // Check if customer exists by phone
            const existing = await prisma.customer.findFirst({
                where: { organizationId, phone: c.phone },
            });

            if (existing) {
                // Update existing customer
                await prisma.customer.update({
                    where: { id: existing.id },
                    data: {
                        name: c.name,
                        email: c.email,
                        address: c.address,
                        notes: c.notes,
                        isVip: c.isVip,
                        customerNumber: c.customerNumber,
                    },
                });
                updatedCount++;
                const vipBadge = c.isVip ? '⭐' : '';
                console.log(`   🔄 Updated: ${c.name} ${vipBadge}`);
                continue;
            }

            // Create new customer
            await prisma.customer.create({
                data: {
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    address: c.address,
                    notes: c.notes,
                    isVip: c.isVip,
                    customerNumber: c.customerNumber,
                    organizationId,
                },
            });
            createdCount++;
            const vipBadge = c.isVip ? '⭐' : '';
            const neighborhood = (c.address as Record<string, unknown>).neighborhood || (c.address as Record<string, unknown>).city;
            console.log(`   ✅ Created: ${c.name} (${neighborhood}) ${vipBadge}`);
        } catch (e) {
            console.log(`   ⚠️  Error with ${c.name}:`, e);
            skippedCount++;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 CUSTOMERS SEED COMPLETED!');
    console.log('═'.repeat(60));

    const totalCount = await prisma.customer.count({ where: { organizationId } });
    const vipCount = await prisma.customer.count({ where: { organizationId, isVip: true } });

    console.log(`\n📊 Summary:`);
    console.log(`   Total Customers: ${totalCount}`);
    console.log(`   ├─ Created: ${createdCount}`);
    console.log(`   ├─ Updated: ${updatedCount}`);
    console.log(`   ├─ Skipped: ${skippedCount}`);
    console.log(`   └─ VIP Clients: ${vipCount}`);

    // Locations breakdown
    const customersWithAddress = await prisma.customer.findMany({
        where: { organizationId },
        select: { address: true },
    });

    const cityBreakdown: Record<string, number> = {};
    for (const c of customersWithAddress) {
        const addr = c.address as Record<string, unknown>;
        const city = (addr.city as string) || 'Unknown';
        cityBreakdown[city] = (cityBreakdown[city] || 0) + 1;
    }

    console.log(`\n📍 By Location:`);
    for (const [city, count] of Object.entries(cityBreakdown)) {
        console.log(`   ${city}: ${count}`);
    }
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
