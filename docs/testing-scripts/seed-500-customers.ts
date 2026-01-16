/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SEED 500 REALISTIC BUENOS AIRES CUSTOMERS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This script generates 500 realistic customers located around Buenos Aires.
 * Features:
 * - Real Buenos Aires streets, neighborhoods, and postal codes
 * - Multiple customers per building (different apartments)
 * - Proper Argentine phone numbers
 * - Coordinates for map display
 * - Mix of individual and business customers
 *
 * USAGE: npx tsx ../../docs/testing-scripts/seed-500-customers.ts test-org-001
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// REALISTIC ARGENTINE DATA
// ═══════════════════════════════════════════════════════════════════════════════

const FIRST_NAMES = [
    'María', 'Juan', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Martín', 'Lucía',
    'Diego', 'Valentina', 'Pablo', 'Camila', 'Nicolás', 'Florencia', 'Matías',
    'Agustina', 'Sebastián', 'Carolina', 'Federico', 'Paula', 'Gonzalo', 'Daniela',
    'Tomás', 'Victoria', 'Alejandro', 'Julieta', 'Fernando', 'Milagros', 'Rodrigo',
    'Rocío', 'Facundo', 'Antonella', 'Emiliano', 'Candela', 'Ignacio', 'Abril',
    'Santiago', 'Micaela', 'Maximiliano', 'Delfina', 'Leandro', 'Martina', 'Ezequiel',
    'Catalina', 'Joaquín', 'Lara', 'Lucas', 'Pilar', 'Ramiro', 'Josefina',
    'Manuel', 'Renata', 'Bruno', 'Clara', 'Iván', 'Jazmín', 'Gastón', 'Mora',
    'Andrés', 'Sol', 'Javier', 'Luna', 'Gabriel', 'Bianca', 'Leonardo', 'Emma'
];

const LAST_NAMES = [
    'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez',
    'Romero', 'Díaz', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta',
    'Benítez', 'Medina', 'Suárez', 'Fernández', 'Castro', 'Ríos', 'Rojas',
    'Molina', 'Ortiz', 'Silva', 'Gutiérrez', 'Vargas', 'Moreno', 'Aguirre',
    'Cabrera', 'Núñez', 'Méndez', 'Cardozo', 'Giménez', 'Herrera', 'Peralta',
    'Figueroa', 'Miranda', 'Paz', 'Vega', 'Campos', 'Carrizo', 'Mansilla',
    'Coronel', 'Ojeda', 'Ledesma', 'Escobar', 'Bravo', 'Pereyra', 'Villalba'
];

const BUSINESS_TYPES = [
    'Construcciones', 'Inmobiliaria', 'Administración', 'Consorcio', 'Estudio',
    'Servicios', 'Comercial', 'Industrial', 'Propiedades', 'Desarrollo'
];

const BUSINESS_SUFFIXES = ['S.A.', 'S.R.L.', 'S.A.S.', 'y Asociados', 'Hnos.', 'e Hijos'];

// Real Buenos Aires streets with typical building numbers and coordinates
const STREETS = [
    { street: 'Av. Santa Fe', min: 800, max: 5500, neighborhood: 'Palermo', cp: '1414', lat: -34.5955, lng: -58.4055 },
    { street: 'Av. Corrientes', min: 500, max: 6500, neighborhood: 'San Nicolás', cp: '1043', lat: -34.6037, lng: -58.3816 },
    { street: 'Av. Callao', min: 100, max: 2000, neighborhood: 'Recoleta', cp: '1023', lat: -34.6045, lng: -58.3925 },
    { street: 'Av. Rivadavia', min: 1000, max: 12000, neighborhood: 'Caballito', cp: '1406', lat: -34.6207, lng: -58.4358 },
    { street: 'Av. Cabildo', min: 500, max: 4500, neighborhood: 'Belgrano', cp: '1426', lat: -34.5615, lng: -58.4555 },
    { street: 'Av. Las Heras', min: 1500, max: 3800, neighborhood: 'Palermo', cp: '1425', lat: -34.5871, lng: -58.4020 },
    { street: 'Av. Pueyrredón', min: 100, max: 2500, neighborhood: 'Recoleta', cp: '1032', lat: -34.5995, lng: -58.4025 },
    { street: 'Av. Córdoba', min: 800, max: 6000, neighborhood: 'Villa Crespo', cp: '1414', lat: -34.5985, lng: -58.4185 },
    { street: 'Av. Scalabrini Ortiz', min: 100, max: 3500, neighborhood: 'Palermo', cp: '1414', lat: -34.5900, lng: -58.4225 },
    { street: 'Av. del Libertador', min: 500, max: 8000, neighborhood: 'Palermo', cp: '1425', lat: -34.5785, lng: -58.4325 },
    { street: 'Av. Juan B. Justo', min: 1000, max: 5000, neighborhood: 'Villa Crespo', cp: '1414', lat: -34.5955, lng: -58.4385 },
    { street: 'Av. Belgrano', min: 300, max: 3500, neighborhood: 'Monserrat', cp: '1092', lat: -34.6125, lng: -58.3855 },
    { street: 'Av. Independencia', min: 500, max: 4000, neighborhood: 'San Telmo', cp: '1099', lat: -34.6185, lng: -58.3825 },
    { street: 'Av. San Juan', min: 500, max: 3800, neighborhood: 'San Cristóbal', cp: '1147', lat: -34.6225, lng: -58.3985 },
    { street: 'Calle Florida', min: 1, max: 1200, neighborhood: 'Microcentro', cp: '1005', lat: -34.6035, lng: -58.3745 },
    { street: 'Calle Lavalle', min: 500, max: 2000, neighborhood: 'Microcentro', cp: '1047', lat: -34.6025, lng: -58.3775 },
    { street: 'Thames', min: 100, max: 2800, neighborhood: 'Palermo', cp: '1414', lat: -34.5885, lng: -58.4275 },
    { street: 'Gurruchaga', min: 100, max: 2500, neighborhood: 'Palermo', cp: '1414', lat: -34.5900, lng: -58.4300 },
    { street: 'Armenia', min: 1000, max: 2500, neighborhood: 'Palermo Hollywood', cp: '1414', lat: -34.5865, lng: -58.4355 },
    { street: 'Honduras', min: 3500, max: 6000, neighborhood: 'Palermo Soho', cp: '1414', lat: -34.5875, lng: -58.4295 },
    { street: 'El Salvador', min: 4000, max: 6000, neighborhood: 'Palermo Soho', cp: '1414', lat: -34.5855, lng: -58.4285 },
    { street: 'Costa Rica', min: 4000, max: 6200, neighborhood: 'Palermo Hollywood', cp: '1414', lat: -34.5845, lng: -58.4345 },
    { street: 'Niceto Vega', min: 4500, max: 6000, neighborhood: 'Palermo Hollywood', cp: '1414', lat: -34.5835, lng: -58.4375 },
    { street: 'Cabrera', min: 3500, max: 6000, neighborhood: 'Palermo', cp: '1414', lat: -34.5905, lng: -58.4265 },
    { street: 'Guatemala', min: 4000, max: 6000, neighborhood: 'Palermo Soho', cp: '1425', lat: -34.5865, lng: -58.4255 },
    { street: 'Paraguay', min: 800, max: 6000, neighborhood: 'Retiro', cp: '1057', lat: -34.5955, lng: -58.3855 },
    { street: 'Tucumán', min: 500, max: 2500, neighborhood: 'San Nicolás', cp: '1049', lat: -34.6015, lng: -58.3795 },
    { street: 'Viamonte', min: 500, max: 2500, neighborhood: 'San Nicolás', cp: '1053', lat: -34.5995, lng: -58.3785 },
    { street: 'Sarmiento', min: 500, max: 3500, neighborhood: 'Balvanera', cp: '1041', lat: -34.6045, lng: -58.3915 },
    { street: 'Perón', min: 500, max: 3500, neighborhood: 'San Nicolás', cp: '1038', lat: -34.6065, lng: -58.3845 },
    { street: 'Bartolomé Mitre', min: 500, max: 3000, neighborhood: 'San Nicolás', cp: '1036', lat: -34.6075, lng: -58.3835 },
    { street: 'Arenales', min: 800, max: 3500, neighborhood: 'Recoleta', cp: '1061', lat: -34.5935, lng: -58.3945 },
    { street: 'Juncal', min: 800, max: 3500, neighborhood: 'Recoleta', cp: '1062', lat: -34.5915, lng: -58.3935 },
    { street: 'Beruti', min: 2500, max: 4500, neighborhood: 'Palermo', cp: '1425', lat: -34.5885, lng: -58.4125 },
    { street: 'Charcas', min: 2500, max: 5000, neighborhood: 'Palermo', cp: '1425', lat: -34.5895, lng: -58.4095 },
    { street: 'Güemes', min: 3500, max: 5000, neighborhood: 'Palermo', cp: '1425', lat: -34.5885, lng: -58.4155 },
    { street: 'Bulnes', min: 500, max: 3000, neighborhood: 'Almagro', cp: '1176', lat: -34.6045, lng: -58.4185 },
    { street: 'Gallo', min: 500, max: 2000, neighborhood: 'Almagro', cp: '1172', lat: -34.6055, lng: -58.4135 },
    { street: 'Salguero', min: 500, max: 3500, neighborhood: 'Palermo', cp: '1177', lat: -34.5985, lng: -58.4155 },
    { street: 'Uriarte', min: 1000, max: 2500, neighborhood: 'Palermo', cp: '1414', lat: -34.5885, lng: -58.4315 },
    { street: 'Malabia', min: 500, max: 2800, neighborhood: 'Palermo', cp: '1414', lat: -34.5895, lng: -58.4285 },
    { street: 'Serrano', min: 1000, max: 2000, neighborhood: 'Palermo', cp: '1414', lat: -34.5905, lng: -58.4325 },
    { street: 'Borges', min: 1500, max: 2500, neighborhood: 'Palermo', cp: '1425', lat: -34.5875, lng: -58.4275 },
    // GBA (Gran Buenos Aires) locations
    { street: 'Av. Maipú', min: 100, max: 3500, neighborhood: 'Vicente López', cp: '1638', lat: -34.5265, lng: -58.4755 },
    { street: 'Av. del Libertador', min: 13000, max: 18000, neighborhood: 'Martínez', cp: '1640', lat: -34.4985, lng: -58.5055 },
    { street: 'Av. Santa Fe', min: 1000, max: 3500, neighborhood: 'Martínez', cp: '1640', lat: -34.4925, lng: -58.5125 },
    { street: 'Av. Centenario', min: 100, max: 2500, neighborhood: 'San Isidro', cp: '1642', lat: -34.4735, lng: -58.5285 },
    { street: 'Av. Rivadavia', min: 13000, max: 17000, neighborhood: 'Ramos Mejía', cp: '1704', lat: -34.6455, lng: -58.5625 },
    { street: 'Av. San Martín', min: 1000, max: 5000, neighborhood: 'Caseros', cp: '1678', lat: -34.6125, lng: -58.5625 },
    { street: 'Av. Hipólito Yrigoyen', min: 7000, max: 12000, neighborhood: 'Lomas de Zamora', cp: '1832', lat: -34.7585, lng: -58.4095 },
];

const NOTES_OPTIONS = [
    'Portero eléctrico código: {code}',
    'Llamar antes de ir. Horario preferido: mañana',
    'Dejar con el portero si no está',
    'Entrada por cochera. Timbre blanco.',
    'Edificio antiguo. Ascensor hasta el 4to piso únicamente.',
    'Cliente frecuente. Prefiere pago en efectivo.',
    'Mascotas en el hogar. Avisar antes de entrar.',
    'Departamento al fondo del pasillo',
    'Timbre funciona intermitente. Golpear la puerta.',
    'Entrada por la calle lateral',
    'Horario preferido: tarde (después de las 14hs)',
    'No molestar antes de las 10hs',
];

const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com.ar', 'outlook.com', 'fibertel.com.ar', 'live.com.ar'];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function randomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateIndividualName(): string {
    return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function generateBusinessName(): string {
    return `${randomItem(LAST_NAMES)} ${randomItem(BUSINESS_TYPES)} ${randomItem(BUSINESS_SUFFIXES)}`;
}

function generateEmail(name: string): string | null {
    // 70% have email
    if (Math.random() > 0.70) return null;

    const cleanName = name
        .replace(/ (S\.A\.|S\.R\.L\.|S\.A\.S\.|y Asociados|Hnos\.|e Hijos)/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '.');

    return `${cleanName}@${randomItem(EMAIL_DOMAINS)}`;
}

function generatePhone(index: number): string {
    // Use +54 9 11 format with predictable suffix for test data
    const suffix = 50000000 + index;
    const part1 = String(suffix).slice(0, 4);
    const part2 = String(suffix).slice(4, 8);
    return `+54 9 11 ${part1}-${part2}`;
}

function generateNotes(): string | null {
    // 30% have notes
    if (Math.random() > 0.30) return null;

    let note = randomItem(NOTES_OPTIONS);
    if (note.includes('{code}')) {
        note = note.replace('{code}', String(randomInt(1000, 9999)));
    }
    return note;
}

function generateApartment(floor: number): string {
    const options = ['A', 'B', 'C', 'D', '1', '2', String(floor * 2 - 1), String(floor * 2)];
    return randomItem(options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function seedCustomers(organizationId: string, count: number = 500) {
    console.log(`🌱 Starting to seed ${count} customers for organization: ${organizationId}`);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
        where: { id: organizationId }
    });

    if (!org) {
        throw new Error(`Organization ${organizationId} not found`);
    }

    const customers: Parameters<typeof prisma.customer.create>[0]['data'][] = [];
    let buildingCount = 0;
    let customerIndex = 0;

    // Generate ~175 buildings with 2-5 apartments each
    while (customerIndex < count && buildingCount < 200) {
        const streetInfo = randomItem(STREETS);
        const streetNumber = randomInt(streetInfo.min, streetInfo.max);

        // How many apartments in this building (2-5)
        const apartmentsInBuilding = randomInt(2, 5);

        for (let j = 0; j < apartmentsInBuilding && customerIndex < count; j++) {
            // Random floor (weighted towards lower floors)
            const floor = Math.random() < 0.6
                ? randomInt(1, 5)  // 60% in floors 1-5
                : randomInt(6, 12); // 40% in floors 6-12

            const apartment = generateApartment(floor);

            // 15% chance of being a business
            const isBusiness = Math.random() < 0.15;
            const name = isBusiness ? generateBusinessName() : generateIndividualName();

            const email = generateEmail(name);
            const phone = generatePhone(customerIndex);
            const notes = generateNotes();
            const isVip = Math.random() < 0.05; // 5% VIP

            // Small coordinate offset for each apartment in building
            const latOffset = (Math.random() - 0.5) * 0.0005;
            const lngOffset = (Math.random() - 0.5) * 0.0005;

            const address = {
                street: streetInfo.street,
                number: String(streetNumber),
                floor: String(floor),
                apartment: apartment,
                neighborhood: streetInfo.neighborhood,
                city: 'Buenos Aires',
                province: 'CABA',
                postalCode: streetInfo.cp,
                coordinates: {
                    lat: streetInfo.lat + latOffset,
                    lng: streetInfo.lng + lngOffset
                }
            };

            customers.push({
                id: `cust-seed-${String(customerIndex + 1).padStart(5, '0')}`,
                name,
                phone,
                email,
                address,
                notes,
                organizationId,
                isVip,
                createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Random in last 6 months
            });

            customerIndex++;
        }

        buildingCount++;

        // Progress indicator
        if (buildingCount % 25 === 0) {
            console.log(`  Created customers for ${buildingCount} buildings (${customerIndex} customers)...`);
        }
    }

    console.log(`📦 Inserting ${customers.length} customers into database...`);

    // Batch insert with upsert
    let created = 0;
    let updated = 0;

    for (const customer of customers) {
        try {
            const result = await prisma.customer.upsert({
                where: { id: customer.id as string },
                update: {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                    address: customer.address,
                    notes: customer.notes,
                    isVip: customer.isVip,
                    updatedAt: new Date(),
                },
                create: customer,
            });

            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                created++;
            } else {
                updated++;
            }
        } catch (error) {
            console.error(`Failed to insert customer ${customer.id}:`, error);
        }

        // Progress for large batches
        if ((created + updated) % 100 === 0) {
            console.log(`  Processed ${created + updated}/${customers.length}...`);
        }
    }

    console.log('');
    console.log('✅ Seeding complete!');
    console.log(`   - Total customers: ${created + updated}`);
    console.log(`   - Buildings: ${buildingCount}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);

    // Summary stats
    const stats = await prisma.customer.groupBy({
        by: ['isVip'],
        where: {
            id: { startsWith: 'cust-seed-' },
            organizationId
        },
        _count: true
    });

    console.log('');
    console.log('📊 Customer breakdown:');
    stats.forEach(s => {
        console.log(`   - ${s.isVip ? 'VIP' : 'Regular'}: ${s._count}`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    // Get organization ID from command line or use default
    const orgId = process.argv[2] || 'org-demo-001';
    const count = parseInt(process.argv[3] || '500', 10);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  SEED 500 REALISTIC BUENOS AIRES CUSTOMERS');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    try {
        await seedCustomers(orgId, count);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
