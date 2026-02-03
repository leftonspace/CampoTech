/**
 * Seed Inventory Items, Locations, and Stock
 * ============================================
 * 
 * Creates realistic inventory for a field service company in Argentina:
 * 
 * INVENTORY ITEMS:
 * - Parts (repuestos) for HVAC, plumbing, gas, electrical
 * - Tools (herramientas) 
 * - Consumables (consumibles)
 * - Safety equipment (EPP)
 * 
 * LOCATIONS:
 * - Main warehouse (Depósito central)
 * - Hub locations (Sucursales)
 * - Vehicle stock (Stock móvil)
 * 
 * STOCK:
 * - Initial quantities per location
 * - Min stock levels for alerts
 * 
 * Run with: npx tsx scripts/seed-inventory.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ITEMS DATA
// Realistic Argentine field service inventory
// ═══════════════════════════════════════════════════════════════════════════════

const INVENTORY_ITEMS = [
    // ─────────────────────────────────────────────────────────────────────────────
    // REFRIGERACIÓN - Repuestos
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'REF-001', name: 'Capacitor 35µF', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2500, minStock: 10, description: 'Capacitor de arranque para compresor' },
    { sku: 'REF-002', name: 'Capacitor 45µF', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3200, minStock: 8, description: 'Capacitor de arranque para compresor grande' },
    { sku: 'REF-003', name: 'Gas R410A (balón 11kg)', category: 'CONSUMABLES', unit: 'unidad', costPrice: 75000, salePrice: 95000, minStock: 3, description: 'Gas refrigerante ecológico' },
    { sku: 'REF-004', name: 'Gas R22 (balón 13kg)', category: 'CONSUMABLES', unit: 'unidad', costPrice: 45000, salePrice: 60000, minStock: 2, description: 'Gas refrigerante legacy' },
    { sku: 'REF-005', name: 'Caño cobre 1/4" x 15m', category: 'PARTS', unit: 'rollo', costPrice: 28000, salePrice: 38000, minStock: 5, description: 'Caño de cobre para línea de líquido' },
    { sku: 'REF-006', name: 'Caño cobre 3/8" x 15m', category: 'PARTS', unit: 'rollo', costPrice: 35000, salePrice: 48000, minStock: 5, description: 'Caño de cobre para línea de succión' },
    { sku: 'REF-007', name: 'Caño cobre 1/2" x 15m', category: 'PARTS', unit: 'rollo', costPrice: 45000, salePrice: 62000, minStock: 3, description: 'Caño de cobre para equipos grandes' },
    { sku: 'REF-008', name: 'Filtro secador 1/4"', category: 'PARTS', unit: 'unidad', costPrice: 3500, salePrice: 5200, minStock: 15, description: 'Filtro secador para línea de líquido' },
    { sku: 'REF-009', name: 'Filtro secador 3/8"', category: 'PARTS', unit: 'unidad', costPrice: 4200, salePrice: 6500, minStock: 10, description: 'Filtro secador para equipos medianos' },
    { sku: 'REF-010', name: 'Termostato digital universal', category: 'PARTS', unit: 'unidad', costPrice: 5500, salePrice: 8000, minStock: 8, description: 'Termostato con display LCD' },
    { sku: 'REF-011', name: 'Motor ventilador evaporador', category: 'PARTS', unit: 'unidad', costPrice: 12000, salePrice: 18000, minStock: 5, description: 'Motor para unidad interior' },
    { sku: 'REF-012', name: 'Motor ventilador condensador', category: 'PARTS', unit: 'unidad', costPrice: 15000, salePrice: 22000, minStock: 4, description: 'Motor para unidad exterior' },
    { sku: 'REF-013', name: 'Placa control universal split', category: 'PARTS', unit: 'unidad', costPrice: 18000, salePrice: 28000, minStock: 3, description: 'Placa electrónica de control' },
    { sku: 'REF-014', name: 'Control remoto universal', category: 'PARTS', unit: 'unidad', costPrice: 2500, salePrice: 4500, minStock: 20, description: 'Control remoto programable' },
    { sku: 'REF-015', name: 'Soporte exterior reforzado', category: 'PARTS', unit: 'unidad', costPrice: 8000, salePrice: 12000, minStock: 10, description: 'Ménsula para unidad exterior' },

    // ─────────────────────────────────────────────────────────────────────────────
    // PLOMERÍA - Repuestos
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'PLO-001', name: 'Caño PPF 1/2" x 4m', category: 'PARTS', unit: 'unidad', costPrice: 850, salePrice: 1200, minStock: 50, description: 'Caño termofusión agua fría/caliente' },
    { sku: 'PLO-002', name: 'Caño PPF 3/4" x 4m', category: 'PARTS', unit: 'unidad', costPrice: 1100, salePrice: 1600, minStock: 40, description: 'Caño termofusión agua fría/caliente' },
    { sku: 'PLO-003', name: 'Codo PPF 1/2" 90°', category: 'PARTS', unit: 'unidad', costPrice: 180, salePrice: 280, minStock: 100, description: 'Accesorio termofusión' },
    { sku: 'PLO-004', name: 'Codo PPF 3/4" 90°', category: 'PARTS', unit: 'unidad', costPrice: 250, salePrice: 380, minStock: 80, description: 'Accesorio termofusión' },
    { sku: 'PLO-005', name: 'Cupla PPF 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 120, salePrice: 200, minStock: 80, description: 'Accesorio termofusión' },
    { sku: 'PLO-006', name: 'Cupla PPF 3/4"', category: 'PARTS', unit: 'unidad', costPrice: 160, salePrice: 260, minStock: 60, description: 'Accesorio termofusión' },
    { sku: 'PLO-007', name: 'Tee PPF 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 220, salePrice: 340, minStock: 60, description: 'Accesorio termofusión' },
    { sku: 'PLO-008', name: 'Llave esférica 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2800, minStock: 30, description: 'Llave de paso esférica' },
    { sku: 'PLO-009', name: 'Llave esférica 3/4"', category: 'PARTS', unit: 'unidad', costPrice: 2400, salePrice: 3600, minStock: 25, description: 'Llave de paso esférica' },
    { sku: 'PLO-010', name: 'Sifón PVC 40mm', category: 'PARTS', unit: 'unidad', costPrice: 850, salePrice: 1500, minStock: 30, description: 'Sifón para pileta' },
    { sku: 'PLO-011', name: 'Sifón PVC 50mm', category: 'PARTS', unit: 'unidad', costPrice: 950, salePrice: 1700, minStock: 25, description: 'Sifón para pileta cocina' },
    { sku: 'PLO-012', name: 'Flexible inoxidable 40cm', category: 'PARTS', unit: 'unidad', costPrice: 1200, salePrice: 1900, minStock: 40, description: 'Manguera conexión grifería' },
    { sku: 'PLO-013', name: 'Cinta teflón (rollo)', category: 'CONSUMABLES', unit: 'unidad', costPrice: 150, salePrice: 300, minStock: 100, description: 'Cinta selladora de roscas' },
    { sku: 'PLO-014', name: 'Pasta selladora 250g', category: 'CONSUMABLES', unit: 'pote', costPrice: 1200, salePrice: 1900, minStock: 15, description: 'Sellador para roscas' },
    { sku: 'PLO-015', name: 'Kit reparación depósito', category: 'PARTS', unit: 'kit', costPrice: 2500, salePrice: 4200, minStock: 10, description: 'Flotante, válvula y accesorios' },

    // ─────────────────────────────────────────────────────────────────────────────
    // GAS - Repuestos
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'GAS-001', name: 'Termocupla universal 900mm', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3500, minStock: 20, description: 'Sensor de llama' },
    { sku: 'GAS-002', name: 'Termocupla universal 600mm', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2900, minStock: 20, description: 'Sensor de llama corto' },
    { sku: 'GAS-003', name: 'Válvula de gas Orbis', category: 'PARTS', unit: 'unidad', costPrice: 12000, salePrice: 18000, minStock: 5, description: 'Válvula principal calefón' },
    { sku: 'GAS-004', name: 'Piloto completo calefón', category: 'PARTS', unit: 'unidad', costPrice: 3500, salePrice: 5500, minStock: 10, description: 'Conjunto piloto con termocupla' },
    { sku: 'GAS-005', name: 'Membrana calefón 14L', category: 'PARTS', unit: 'unidad', costPrice: 1500, salePrice: 2500, minStock: 15, description: 'Membrana de goma' },
    { sku: 'GAS-006', name: 'Flexible gas 1/2" x 1m', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3500, minStock: 25, description: 'Manguera homologada gas' },
    { sku: 'GAS-007', name: 'Flexible gas 1/2" x 1.5m', category: 'PARTS', unit: 'unidad', costPrice: 2800, salePrice: 4200, minStock: 20, description: 'Manguera homologada gas' },
    { sku: 'GAS-008', name: 'Llave gas esférica 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 2800, salePrice: 4500, minStock: 15, description: 'Llave de paso para gas' },
    { sku: 'GAS-009', name: 'Detector fuga gas portátil', category: 'EQUIPMENT', unit: 'unidad', costPrice: 8500, salePrice: 12000, minStock: 3, description: 'Detector electrónico' },
    { sku: 'GAS-010', name: 'Spray detector fugas 400ml', category: 'CONSUMABLES', unit: 'unidad', costPrice: 1200, salePrice: 1900, minStock: 20, description: 'Aerosol para detectar fugas' },

    // ─────────────────────────────────────────────────────────────────────────────
    // ELECTRICIDAD - Repuestos
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'ELE-001', name: 'Termomagnética 1x16A', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2800, minStock: 25, description: 'Interruptor termomagnético' },
    { sku: 'ELE-002', name: 'Termomagnética 1x20A', category: 'PARTS', unit: 'unidad', costPrice: 2000, salePrice: 3100, minStock: 25, description: 'Interruptor termomagnético' },
    { sku: 'ELE-003', name: 'Termomagnética 1x32A', category: 'PARTS', unit: 'unidad', costPrice: 2400, salePrice: 3600, minStock: 15, description: 'Interruptor termomagnético' },
    { sku: 'ELE-004', name: 'Diferencial 2x25A 30mA', category: 'PARTS', unit: 'unidad', costPrice: 8500, salePrice: 12500, minStock: 8, description: 'Disyuntor diferencial' },
    { sku: 'ELE-005', name: 'Diferencial 2x40A 30mA', category: 'PARTS', unit: 'unidad', costPrice: 11000, salePrice: 16000, minStock: 6, description: 'Disyuntor diferencial' },
    { sku: 'ELE-006', name: 'Cable 2.5mm² azul (x100m)', category: 'PARTS', unit: 'rollo', costPrice: 15000, salePrice: 22000, minStock: 5, description: 'Cable unipolar flexible' },
    { sku: 'ELE-007', name: 'Cable 2.5mm² marrón (x100m)', category: 'PARTS', unit: 'rollo', costPrice: 15000, salePrice: 22000, minStock: 5, description: 'Cable unipolar flexible' },
    { sku: 'ELE-008', name: 'Cable 4mm² (x100m)', category: 'PARTS', unit: 'rollo', costPrice: 25000, salePrice: 35000, minStock: 3, description: 'Cable unipolar flexible' },
    { sku: 'ELE-009', name: 'Caja tablero 12 módulos', category: 'PARTS', unit: 'unidad', costPrice: 6500, salePrice: 9500, minStock: 8, description: 'Gabinete para tablero' },
    { sku: 'ELE-010', name: 'Tomacorriente 10A', category: 'PARTS', unit: 'unidad', costPrice: 450, salePrice: 750, minStock: 50, description: 'Tomacorriente standard' },
    { sku: 'ELE-011', name: 'Tomacorriente 20A', category: 'PARTS', unit: 'unidad', costPrice: 650, salePrice: 1100, minStock: 30, description: 'Tomacorriente para electrodomésticos' },
    { sku: 'ELE-012', name: 'Interruptor simple', category: 'PARTS', unit: 'unidad', costPrice: 350, salePrice: 600, minStock: 40, description: 'Llave de luz' },
    { sku: 'ELE-013', name: 'Interruptor doble', category: 'PARTS', unit: 'unidad', costPrice: 550, salePrice: 900, minStock: 25, description: 'Llave de luz doble' },

    // ─────────────────────────────────────────────────────────────────────────────
    // HERRAMIENTAS
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'HER-001', name: 'Manómetro R410A/R32', category: 'TOOLS', unit: 'unidad', costPrice: 45000, salePrice: 65000, minStock: 2, description: 'Juego de manómetros digitales' },
    { sku: 'HER-002', name: 'Bomba de vacío 1/3HP', category: 'TOOLS', unit: 'unidad', costPrice: 85000, salePrice: 120000, minStock: 1, description: 'Bomba de vacío para refrigeración' },
    { sku: 'HER-003', name: 'Balanza para gas 50kg', category: 'TOOLS', unit: 'unidad', costPrice: 25000, salePrice: 38000, minStock: 2, description: 'Balanza electrónica para carga de gas' },
    { sku: 'HER-004', name: 'Termofusora PPF', category: 'TOOLS', unit: 'unidad', costPrice: 35000, salePrice: 52000, minStock: 2, description: 'Soldadora para caños PPF' },
    { sku: 'HER-005', name: 'Destapacaños eléctrico', category: 'TOOLS', unit: 'unidad', costPrice: 85000, salePrice: 120000, minStock: 1, description: 'Máquina destapadora profesional' },
    { sku: 'HER-006', name: 'Multímetro digital', category: 'TOOLS', unit: 'unidad', costPrice: 12000, salePrice: 18000, minStock: 4, description: 'Tester multifunción' },
    { sku: 'HER-007', name: 'Pinza amperimétrica', category: 'TOOLS', unit: 'unidad', costPrice: 18000, salePrice: 28000, minStock: 3, description: 'Medidor de corriente sin contacto' },
    { sku: 'HER-008', name: 'Juego llaves Allen', category: 'TOOLS', unit: 'set', costPrice: 3500, salePrice: 5500, minStock: 5, description: 'Set llaves hexagonales' },
    { sku: 'HER-009', name: 'Juego llaves combinadas', category: 'TOOLS', unit: 'set', costPrice: 8500, salePrice: 13000, minStock: 4, description: 'Set llaves 8-19mm' },
    { sku: 'HER-010', name: 'Taladro percutor 13mm', category: 'TOOLS', unit: 'unidad', costPrice: 45000, salePrice: 68000, minStock: 2, description: 'Taladro profesional' },

    // ─────────────────────────────────────────────────────────────────────────────
    // CONSUMIBLES
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'CON-001', name: 'Precintos 200mm (x100)', category: 'CONSUMABLES', unit: 'bolsa', costPrice: 350, salePrice: 600, minStock: 50, description: 'Precintos plásticos' },
    { sku: 'CON-002', name: 'Precintos 300mm (x100)', category: 'CONSUMABLES', unit: 'bolsa', costPrice: 450, salePrice: 750, minStock: 40, description: 'Precintos plásticos largos' },
    { sku: 'CON-003', name: 'Cinta aisladora 20m', category: 'CONSUMABLES', unit: 'rollo', costPrice: 250, salePrice: 450, minStock: 100, description: 'Cinta aislante eléctrica' },
    { sku: 'CON-004', name: 'Silicona 280ml', category: 'CONSUMABLES', unit: 'cartucho', costPrice: 1200, salePrice: 1900, minStock: 30, description: 'Sellador de silicona' },
    { sku: 'CON-005', name: 'Espuma expansiva 750ml', category: 'CONSUMABLES', unit: 'lata', costPrice: 2500, salePrice: 3800, minStock: 20, description: 'Espuma de poliuretano' },
    { sku: 'CON-006', name: 'Tuerca de bronce 3/8"', category: 'PARTS', unit: 'unidad', costPrice: 150, salePrice: 280, minStock: 100, description: 'Tuerca flare para cobre' },
    { sku: 'CON-007', name: 'Tuerca de bronce 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 180, salePrice: 320, minStock: 80, description: 'Tuerca flare para cobre' },
    { sku: 'CON-008', name: 'Aislación 1/4" x 2m', category: 'CONSUMABLES', unit: 'tira', costPrice: 350, salePrice: 580, minStock: 80, description: 'Aislación térmica para caños' },
    { sku: 'CON-009', name: 'Aislación 3/8" x 2m', category: 'CONSUMABLES', unit: 'tira', costPrice: 420, salePrice: 680, minStock: 60, description: 'Aislación térmica para caños' },

    // ─────────────────────────────────────────────────────────────────────────────
    // EPP (Equipos de Protección Personal)
    // ─────────────────────────────────────────────────────────────────────────────
    { sku: 'EPP-001', name: 'Guantes de trabajo talle M', category: 'SAFETY', unit: 'par', costPrice: 1200, salePrice: 1900, minStock: 20, description: 'Guantes de cuero reforzado' },
    { sku: 'EPP-002', name: 'Guantes de trabajo talle L', category: 'SAFETY', unit: 'par', costPrice: 1200, salePrice: 1900, minStock: 20, description: 'Guantes de cuero reforzado' },
    { sku: 'EPP-003', name: 'Gafas de seguridad', category: 'SAFETY', unit: 'unidad', costPrice: 850, salePrice: 1400, minStock: 15, description: 'Lentes protectores' },
    { sku: 'EPP-004', name: 'Casco de seguridad', category: 'SAFETY', unit: 'unidad', costPrice: 2500, salePrice: 3800, minStock: 8, description: 'Casco con arnés' },
    { sku: 'EPP-005', name: 'Botines de seguridad talle 42', category: 'SAFETY', unit: 'par', costPrice: 18000, salePrice: 26000, minStock: 5, description: 'Botín con puntera de acero' },
    { sku: 'EPP-006', name: 'Botines de seguridad talle 44', category: 'SAFETY', unit: 'par', costPrice: 18000, salePrice: 26000, minStock: 5, description: 'Botín con puntera de acero' },
    { sku: 'EPP-007', name: 'Chaleco reflectivo', category: 'SAFETY', unit: 'unidad', costPrice: 1500, salePrice: 2500, minStock: 10, description: 'Chaleco alta visibilidad' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const LOCATIONS = [
    { name: 'Depósito Central', type: 'WAREHOUSE', address: 'Av. Corrientes 1234, CABA' },
    { name: 'Hub Norte', type: 'HUB', address: 'Av. Cabildo 4500, CABA' },
    { name: 'Hub Sur', type: 'HUB', address: 'Av. Rivadavia 8500, CABA' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    console.log('🌱 Seeding Inventory Items, Locations, and Stock...\n');

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

    // Find owner for performedBy in transactions
    const owner = await prisma.user.findFirst({
        where: { organizationId, role: 'OWNER' },
    });
    if (!owner) {
        console.log('❌ No owner found in organization');
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED INVENTORY LOCATIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('📍 Seeding Inventory Locations...');

    const locationIds: Record<string, string> = {};

    for (const loc of LOCATIONS) {
        try {
            // Check if location exists
            const existing = await prisma.inventoryLocation.findFirst({
                where: { organizationId, name: loc.name },
            });

            if (existing) {
                locationIds[loc.name] = existing.id;
                console.log(`   ⏭️  ${loc.name} already exists`);
                continue;
            }

            const created = await prisma.inventoryLocation.create({
                data: {
                    name: loc.name,
                    locationType: loc.type as 'HUB' | 'VEHICLE' | 'WAREHOUSE',
                    address: loc.address,
                    isActive: true,
                    organizationId,
                },
            });
            locationIds[loc.name] = created.id;
            console.log(`   ✅ Created: ${loc.name} (${loc.type})`);
        } catch (e) {
            console.log(`   ⚠️  Error creating ${loc.name}:`, e);
        }
    }

    // Also create vehicle locations for existing vehicles
    console.log('\n🚗 Creating Vehicle Inventory Locations...');

    const vehicles = await prisma.vehicle.findMany({
        where: { organizationId, status: 'ACTIVE' },
        select: { id: true, plateNumber: true, make: true, model: true },
    });

    for (const vehicle of vehicles) {
        const locName = `Vehículo ${vehicle.plateNumber}`;
        try {
            const existing = await prisma.inventoryLocation.findFirst({
                where: { organizationId, vehicleId: vehicle.id },
            });

            if (existing) {
                locationIds[locName] = existing.id;
                console.log(`   ⏭️  ${locName} already exists`);
                continue;
            }

            const created = await prisma.inventoryLocation.create({
                data: {
                    name: `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`,
                    locationType: 'VEHICLE',
                    vehicleId: vehicle.id,
                    isActive: true,
                    organizationId,
                },
            });
            locationIds[locName] = created.id;
            console.log(`   ✅ Created: ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`);
        } catch (e) {
            console.log(`   ⚠️  Error creating vehicle location:`, e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED INVENTORY ITEMS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n📦 Seeding Inventory Items...');

    let createdItems = 0;
    let skippedItems = 0;
    const itemIds: Record<string, string> = {};

    for (const item of INVENTORY_ITEMS) {
        try {
            const existingItem = await prisma.inventoryItem.findFirst({
                where: { organizationId, sku: item.sku },
            });

            if (existingItem) {
                itemIds[item.sku] = existingItem.id;
                skippedItems++;
                continue;
            }

            const created = await prisma.inventoryItem.create({
                data: {
                    sku: item.sku,
                    name: item.name,
                    description: item.description,
                    category: item.category as 'PARTS' | 'TOOLS' | 'CONSUMABLES' | 'EQUIPMENT' | 'SAFETY' | 'OTHER',
                    unit: item.unit,
                    minStockLevel: item.minStock,
                    costPrice: item.costPrice,
                    salePrice: item.salePrice,
                    isActive: true,
                    organizationId,
                },
            });
            itemIds[item.sku] = created.id;
            createdItems++;
        } catch (e) {
            console.log(`   ⚠️  Error creating ${item.sku}:`, e);
            skippedItems++;
        }
    }
    console.log(`   ✅ ${createdItems} items created`);
    if (skippedItems > 0) console.log(`   ⏭️  ${skippedItems} already existed`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED INITIAL STOCK
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n📊 Setting Initial Stock Levels...');

    const warehouseId = locationIds['Depósito Central'];
    let stockCreated = 0;
    let transactionsCreated = 0;

    if (!warehouseId) {
        console.log('   ⚠️  No warehouse location found, skipping stock');
    } else {
        for (const item of INVENTORY_ITEMS) {
            const itemId = itemIds[item.sku];
            if (!itemId) continue;

            try {
                // Check if stock exists
                const existingStock = await prisma.inventoryStock.findFirst({
                    where: { itemId, locationId: warehouseId },
                });

                if (existingStock) {
                    continue;
                }

                // Random initial quantity (2-5x minimum stock)
                const initialQty = randomBetween(item.minStock * 2, item.minStock * 5);

                // Create stock record
                await prisma.inventoryStock.create({
                    data: {
                        itemId,
                        locationId: warehouseId,
                        quantity: initialQty,
                        lastCountedAt: new Date(),
                    },
                });
                stockCreated++;

                // Create initial stock transaction
                await prisma.inventoryTransaction.create({
                    data: {
                        itemId,
                        toLocationId: warehouseId,
                        quantity: initialQty,
                        transactionType: 'INITIAL_STOCK',
                        notes: 'Stock inicial del sistema',
                        performedById: owner.id,
                        organizationId,
                    },
                });
                transactionsCreated++;
            } catch (e) {
                // Ignore duplicates
            }
        }
        console.log(`   ✅ ${stockCreated} stock records created`);
        console.log(`   ✅ ${transactionsCreated} initial stock transactions`);
    }

    // Distribute some stock to hubs
    console.log('\n🚚 Distributing Stock to Hubs...');

    const hubNorth = locationIds['Hub Norte'];
    const hubSouth = locationIds['Hub Sur'];
    let transfersCreated = 0;

    // Items to distribute to hubs (common items)
    const hubItems = INVENTORY_ITEMS.filter(i =>
        i.category === 'PARTS' || i.category === 'CONSUMABLES'
    ).slice(0, 20);

    for (const hub of [hubNorth, hubSouth]) {
        if (!hub || !warehouseId) continue;

        for (const item of hubItems) {
            const itemId = itemIds[item.sku];
            if (!itemId) continue;

            try {
                const existingStock = await prisma.inventoryStock.findFirst({
                    where: { itemId, locationId: hub },
                });

                if (existingStock) continue;

                const qty = randomBetween(5, 15);

                // Create stock at hub
                await prisma.inventoryStock.create({
                    data: {
                        itemId,
                        locationId: hub,
                        quantity: qty,
                        lastCountedAt: new Date(),
                    },
                });

                // Create transfer transaction
                await prisma.inventoryTransaction.create({
                    data: {
                        itemId,
                        fromLocationId: warehouseId,
                        toLocationId: hub,
                        quantity: qty,
                        transactionType: 'TRANSFER',
                        notes: 'Distribución inicial a hub',
                        performedById: owner.id,
                        organizationId,
                    },
                });
                transfersCreated++;
            } catch {
                // Ignore
            }
        }
    }
    console.log(`   ✅ ${transfersCreated} transfers to hubs created`);

    // Distribute some stock to vehicles
    console.log('\n🚗 Stocking Vehicles with Basic Items...');

    let vehicleStockCreated = 0;
    const vehicleItems = INVENTORY_ITEMS.filter(i =>
        ['CON-001', 'CON-002', 'CON-003', 'CON-004', 'PLO-013', 'EPP-003'].includes(i.sku)
    );

    for (const vehicle of vehicles) {
        const vehicleLocId = locationIds[`Vehículo ${vehicle.plateNumber}`];
        if (!vehicleLocId || !warehouseId) continue;

        for (const item of vehicleItems) {
            const itemId = itemIds[item.sku];
            if (!itemId) continue;

            try {
                const existingStock = await prisma.inventoryStock.findFirst({
                    where: { itemId, locationId: vehicleLocId },
                });

                if (existingStock) continue;

                const qty = randomBetween(2, 8);

                await prisma.inventoryStock.create({
                    data: {
                        itemId,
                        locationId: vehicleLocId,
                        quantity: qty,
                        lastCountedAt: new Date(),
                    },
                });

                await prisma.inventoryTransaction.create({
                    data: {
                        itemId,
                        fromLocationId: warehouseId,
                        toLocationId: vehicleLocId,
                        quantity: qty,
                        transactionType: 'TRANSFER',
                        notes: `Carga inicial vehículo ${vehicle.plateNumber}`,
                        performedById: owner.id,
                        organizationId,
                    },
                });
                vehicleStockCreated++;
            } catch {
                // Ignore
            }
        }
    }
    console.log(`   ✅ ${vehicleStockCreated} vehicle stock items created`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 INVENTORY SEED COMPLETED!');
    console.log('═'.repeat(60));

    const itemCount = await prisma.inventoryItem.count({ where: { organizationId } });
    const locationCount = await prisma.inventoryLocation.count({ where: { organizationId } });
    const stockCount = await prisma.inventoryStock.count({
        where: { item: { organizationId } }
    });
    const transactionCount = await prisma.inventoryTransaction.count({ where: { organizationId } });

    const categoryBreakdown = await prisma.inventoryItem.groupBy({
        by: ['category'],
        where: { organizationId },
        _count: true,
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Items: ${itemCount}`);
    for (const cat of categoryBreakdown) {
        console.log(`     └─ ${cat.category}: ${cat._count}`);
    }
    console.log(`   Locations: ${locationCount}`);
    console.log(`   Stock Records: ${stockCount}`);
    console.log(`   Transactions: ${transactionCount}`);

    // Low stock warnings
    console.log('\n⚠️  Low Stock Alerts (below minimum):');
    const lowStock = await prisma.inventoryStock.findMany({
        where: {
            item: { organizationId },
            quantity: { lt: 5 }, // Using fixed threshold for demo
        },
        include: { item: true, location: true },
        take: 10,
    });

    if (lowStock.length === 0) {
        console.log('   ✅ All items have sufficient stock');
    } else {
        for (const s of lowStock) {
            console.log(`   📦 ${s.item.name} @ ${s.location.name}: ${s.quantity} units`);
        }
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
