/**
 * Seed Service Types and Pricebook Items
 * ========================================
 * 
 * Creates comprehensive service types and pricebook items
 * aligned with PRICEBOOK_SCENARIOS.md scenarios.
 * 
 * Includes:
 * - Service types for all specialties (Refrigeración, Plomería, Electricidad, Gas)
 * - Price items (services and products/materials)
 * - Related item relationships for smart suggestions
 * 
 * Run with: npx tsx scripts/seed-pricebook.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE TYPES (Tipos de Servicio)
// Based on PRICEBOOK_SCENARIOS scenarios
// ═══════════════════════════════════════════════════════════════════════════════

const SERVICE_TYPES = [
    // Refrigeración / HVAC
    { code: 'INST-SPLIT-3000', name: 'Instalación Split hasta 3000 frigorías', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'snowflake' },
    { code: 'INST-SPLIT-4500', name: 'Instalación Split hasta 4500 frigorías', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'snowflake' },
    { code: 'INST-SPLIT-6000', name: 'Instalación Split hasta 6000 frigorías', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'snowflake' },
    { code: 'REP-SPLIT', name: 'Reparación de aire acondicionado', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'wrench' },
    { code: 'MANT-SPLIT', name: 'Mantenimiento preventivo de aire', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'check-circle' },
    { code: 'DIAG-SPLIT', name: 'Diagnóstico aire acondicionado', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'search' },
    { code: 'RECARGA-GAS', name: 'Recarga de gas refrigerante', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'droplet' },
    { code: 'REFRI-COMERCIAL', name: 'Refrigeración comercial', specialty: 'REFRIGERACION', color: '#0EA5E9', icon: 'box' },

    // Plomería
    { code: 'PLOM-DESTAPE', name: 'Destape de cañerías', specialty: 'PLOMERO', color: '#3B82F6', icon: 'droplet' },
    { code: 'PLOM-REP-CANIO', name: 'Reparación de cañería', specialty: 'PLOMERO', color: '#3B82F6', icon: 'wrench' },
    { code: 'PLOM-INST-SANIT', name: 'Instalación de sanitarios', specialty: 'PLOMERO', color: '#3B82F6', icon: 'home' },
    { code: 'PLOM-TERMO', name: 'Instalación/reparación termotanque', specialty: 'PLOMERO', color: '#3B82F6', icon: 'flame' },
    { code: 'PLOM-PPF', name: 'Instalación cañería PPF', specialty: 'PLOMERO', color: '#3B82F6', icon: 'pipe' },
    { code: 'PLOM-BAÑO-COMPLETO', name: 'Remodelación baño completo', specialty: 'PLOMERO', color: '#3B82F6', icon: 'bath' },

    // Electricidad
    { code: 'ELEC-TABLERO', name: 'Instalación tablero eléctrico', specialty: 'ELECTRICISTA', color: '#EAB308', icon: 'zap' },
    { code: 'ELEC-CABLEADO', name: 'Tendido de cableado', specialty: 'ELECTRICISTA', color: '#EAB308', icon: 'plug' },
    { code: 'ELEC-TOMAS', name: 'Instalación tomas y llaves', specialty: 'ELECTRICISTA', color: '#EAB308', icon: 'power' },
    { code: 'ELEC-ILUMINACION', name: 'Instalación de iluminación', specialty: 'ELECTRICISTA', color: '#EAB308', icon: 'lightbulb' },
    { code: 'ELEC-MEDIDOR', name: 'Cambio de medidor', specialty: 'ELECTRICISTA', color: '#EAB308', icon: 'gauge' },

    // Gas
    { code: 'GAS-REVISION', name: 'Revisión instalación de gas', specialty: 'GASISTA', color: '#F97316', icon: 'flame' },
    { code: 'GAS-CALEFON', name: 'Reparación de calefón', specialty: 'GASISTA', color: '#F97316', icon: 'flame' },
    { code: 'GAS-CALEFACTOR', name: 'Instalación calefactor a gas', specialty: 'GASISTA', color: '#F97316', icon: 'heater' },
    { code: 'GAS-COCINA', name: 'Instalación/reparación cocina a gas', specialty: 'GASISTA', color: '#F97316', icon: 'utensils' },
    { code: 'GAS-OBLEA', name: 'Trámite de oblea de gas', specialty: 'GASISTA', color: '#F97316', icon: 'file-check' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ITEMS (Lista de Precios)
// Services and Products/Materials from PRICEBOOK_SCENARIOS.md
// ═══════════════════════════════════════════════════════════════════════════════

const PRICE_ITEMS = [
    // ─────────────────────────────────────────────────────────────────────────────
    // REFRIGERACIÓN - Servicios
    // ─────────────────────────────────────────────────────────────────────────────
    { name: 'Instalación Split hasta 3000 frigorías', type: 'SERVICE', price: 35000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-001' },
    { name: 'Instalación Split hasta 4500 frigorías', type: 'SERVICE', price: 45000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-002' },
    { name: 'Instalación Split hasta 6000 frigorías', type: 'SERVICE', price: 55000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-003' },
    { name: 'Diagnóstico aire acondicionado', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-004' },
    { name: 'Recarga de gas R410A', type: 'SERVICE', price: 24000, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-SERV-005' },
    { name: 'Recarga de gas R22', type: 'SERVICE', price: 18000, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-SERV-006' },
    { name: 'Recarga de gas R404A (comercial)', type: 'SERVICE', price: 45000, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-SERV-007' },
    { name: 'Recarga de gas R134A', type: 'SERVICE', price: 28000, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-SERV-008' },
    { name: 'Limpieza de filtros y serpentina', type: 'SERVICE', price: 8000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-009' },
    { name: 'Limpieza condensador industrial', type: 'SERVICE', price: 22000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-010' },
    { name: 'Reparación compresor comercial', type: 'SERVICE', price: 65000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-011' },
    { name: 'Diagnóstico equipo refrigeración', type: 'SERVICE', price: 15000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-012' },
    { name: 'Mantenimiento preventivo split', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-SERV-013' },
    { name: 'Servicio de emergencia nocturno', type: 'SERVICE', price: 25000, unit: 'unidad', specialty: null, code: 'EMER-SERV-001' },
    { name: 'Diagnóstico urgente', type: 'SERVICE', price: 10000, unit: 'unidad', specialty: null, code: 'EMER-SERV-002' },

    // REFRIGERACIÓN - Materiales
    { name: 'Caño de cobre 1/4" x 3m', type: 'PRODUCT', price: 8500, unit: 'rollo', specialty: 'REFRIGERACION', code: 'REFRI-MAT-001' },
    { name: 'Caño de cobre 3/8" x 3m', type: 'PRODUCT', price: 9200, unit: 'rollo', specialty: 'REFRIGERACION', code: 'REFRI-MAT-002' },
    { name: 'Caño de cobre 1/2" x 3m', type: 'PRODUCT', price: 11500, unit: 'rollo', specialty: 'REFRIGERACION', code: 'REFRI-MAT-003' },
    { name: 'Soporte exterior reforzado', type: 'PRODUCT', price: 12000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-004' },
    { name: 'Soporte exterior standard', type: 'PRODUCT', price: 8000, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-005' },
    { name: 'Cableado eléctrico instalación (hasta 10m)', type: 'PRODUCT', price: 6800, unit: 'instalación', specialty: 'REFRIGERACION', code: 'REFRI-MAT-006' },
    { name: 'Cableado eléctrico instalación (hasta 20m)', type: 'PRODUCT', price: 12000, unit: 'instalación', specialty: 'REFRIGERACION', code: 'REFRI-MAT-007' },
    { name: 'Gas refrigerante R410A x 1kg', type: 'PRODUCT', price: 12000, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-MAT-008' },
    { name: 'Gas refrigerante R404A x 1kg', type: 'PRODUCT', price: 18500, unit: 'kg', specialty: 'REFRIGERACION', code: 'REFRI-MAT-009' },
    { name: 'Filtro secador R404A 3/8"', type: 'PRODUCT', price: 8200, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-010' },
    { name: 'Capacitor 35 µF', type: 'PRODUCT', price: 2500, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-011' },
    { name: 'Capacitor 45 µF', type: 'PRODUCT', price: 3200, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-012' },
    { name: 'Control remoto universal', type: 'PRODUCT', price: 4500, unit: 'unidad', specialty: 'REFRIGERACION', code: 'REFRI-MAT-013' },

    // ─────────────────────────────────────────────────────────────────────────────
    // GAS - Servicios
    // ─────────────────────────────────────────────────────────────────────────────
    { name: 'Diagnóstico y revisión equipo a gas', type: 'SERVICE', price: 8000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-001' },
    { name: 'Instalación calefactor a gas', type: 'SERVICE', price: 35000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-002' },
    { name: 'Reparación calefón', type: 'SERVICE', price: 18000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-003' },
    { name: 'Instalación cocina a gas', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-004' },
    { name: 'Revisión instalación de gas completa', type: 'SERVICE', price: 15000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-005' },
    { name: 'Trámite oblea de gas', type: 'SERVICE', price: 25000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-SERV-006' },

    // GAS - Materiales
    { name: 'Válvula de gas VG200', type: 'PRODUCT', price: 15000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-MAT-001' },
    { name: 'Intercambiador de calor Orbis', type: 'PRODUCT', price: 25000, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-MAT-002' },
    { name: 'Termocupla universal', type: 'PRODUCT', price: 3500, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-MAT-003' },
    { name: 'Piloto calefón', type: 'PRODUCT', price: 4200, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-MAT-004' },
    { name: 'Flexible gas 1/2" x 1m', type: 'PRODUCT', price: 2800, unit: 'unidad', specialty: 'GASISTA', code: 'GAS-MAT-005' },

    // ─────────────────────────────────────────────────────────────────────────────
    // PLOMERÍA - Servicios
    // ─────────────────────────────────────────────────────────────────────────────
    { name: 'Destape cañería simple', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-001' },
    { name: 'Destape cañería con máquina', type: 'SERVICE', price: 18000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-002' },
    { name: 'Reparación cañería', type: 'SERVICE', price: 15000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-003' },
    { name: 'Instalación inodoro', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-004' },
    { name: 'Instalación bidet', type: 'SERVICE', price: 10000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-005' },
    { name: 'Instalación vanitory', type: 'SERVICE', price: 15000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-006' },
    { name: 'Instalación grifería ducha', type: 'SERVICE', price: 14000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-007' },
    { name: 'Instalación grifería lavatorio', type: 'SERVICE', price: 8000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-008' },
    { name: 'Instalación termotanque eléctrico', type: 'SERVICE', price: 28000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-009' },
    { name: 'Desinstalación termotanque existente', type: 'SERVICE', price: 12000, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-SERV-010' },
    { name: 'Instalación cañería PPF completa', type: 'SERVICE', price: 45000, unit: 'baño', specialty: 'PLOMERO', code: 'PLOM-SERV-011' },
    { name: 'Instalación desagües PVC', type: 'SERVICE', price: 22000, unit: 'baño', specialty: 'PLOMERO', code: 'PLOM-SERV-012' },
    { name: 'Demolición de baño completo', type: 'SERVICE', price: 35000, unit: 'baño', specialty: 'PLOMERO', code: 'PLOM-SERV-013' },
    { name: 'Retiro de sanitarios existentes', type: 'SERVICE', price: 12000, unit: 'baño', specialty: 'PLOMERO', code: 'PLOM-SERV-014' },
    { name: 'Retiro de escombros (volquete incluido)', type: 'SERVICE', price: 18000, unit: 'volquete', specialty: 'PLOMERO', code: 'PLOM-SERV-015' },

    // PLOMERÍA - Materiales
    { name: 'Caño PPF 1/2" (x1 unidad)', type: 'PRODUCT', price: 1200, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-MAT-001' },
    { name: 'Caño PPF 3/4" (x1 unidad)', type: 'PRODUCT', price: 1800, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-MAT-002' },
    { name: 'Conexiones y accesorios PPF', type: 'PRODUCT', price: 8500, unit: 'kit', specialty: 'PLOMERO', code: 'PLOM-MAT-003' },
    { name: 'Mangueras conexión termotanque (x2)', type: 'PRODUCT', price: 4500, unit: 'par', specialty: 'PLOMERO', code: 'PLOM-MAT-004' },
    { name: 'Sifón PVC', type: 'PRODUCT', price: 1500, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-MAT-005' },
    { name: 'Canilla esférica 1/2"', type: 'PRODUCT', price: 2800, unit: 'unidad', specialty: 'PLOMERO', code: 'PLOM-MAT-006' },

    // ─────────────────────────────────────────────────────────────────────────────
    // ELECTRICIDAD - Servicios
    // ─────────────────────────────────────────────────────────────────────────────
    { name: 'Instalación tablero eléctrico monofásico', type: 'SERVICE', price: 45000, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-001' },
    { name: 'Instalación tablero eléctrico trifásico', type: 'SERVICE', price: 85000, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-002' },
    { name: 'Cableado industrial (por metro)', type: 'SERVICE', price: 640, unit: 'm', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-003' },
    { name: 'Instalación punto de luz', type: 'SERVICE', price: 6000, unit: 'punto', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-004' },
    { name: 'Instalación tomacorriente', type: 'SERVICE', price: 5000, unit: 'punto', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-005' },
    { name: 'Mano de obra instalación (por hora)', type: 'SERVICE', price: 6000, unit: 'hora', specialty: 'ELECTRICISTA', code: 'ELEC-SERV-006' },
    { name: 'Mano de obra reparación (por hora)', type: 'SERVICE', price: 8000, unit: 'hora', specialty: null, code: 'GEN-SERV-001' },

    // ELECTRICIDAD - Materiales
    { name: 'Termomagnética 16A', type: 'PRODUCT', price: 2500, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-001' },
    { name: 'Termomagnética 20A', type: 'PRODUCT', price: 2800, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-002' },
    { name: 'Termomagnética 32A', type: 'PRODUCT', price: 3000, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-003' },
    { name: 'Disyuntor diferencial 25A', type: 'PRODUCT', price: 9500, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-004' },
    { name: 'Disyuntor diferencial 40A', type: 'PRODUCT', price: 12500, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-005' },
    { name: 'Cable 2.5mm² x 100m', type: 'PRODUCT', price: 18000, unit: 'rollo', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-006' },
    { name: 'Cable 4mm² x 100m', type: 'PRODUCT', price: 28000, unit: 'rollo', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-007' },
    { name: 'Caja tablero 12 módulos', type: 'PRODUCT', price: 8500, unit: 'unidad', specialty: 'ELECTRICISTA', code: 'ELEC-MAT-008' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RELATED ITEMS (for suggestions)
// ═══════════════════════════════════════════════════════════════════════════════

const RELATED_ITEMS: Array<{ source: string; related: string; weight: number }> = [
    // Split installation + accessories
    { source: 'REFRI-SERV-002', related: 'REFRI-MAT-001', weight: 10 }, // Install + Caño 1/4"
    { source: 'REFRI-SERV-002', related: 'REFRI-MAT-002', weight: 10 }, // Install + Caño 3/8"
    { source: 'REFRI-SERV-002', related: 'REFRI-MAT-004', weight: 8 },  // Install + Soporte
    { source: 'REFRI-SERV-002', related: 'REFRI-MAT-006', weight: 9 },  // Install + Cableado

    // Recarga gas + gas
    { source: 'REFRI-SERV-005', related: 'REFRI-MAT-008', weight: 10 }, // Recarga R410A + gas
    { source: 'REFRI-SERV-007', related: 'REFRI-MAT-009', weight: 10 }, // Recarga R404A + gas
    { source: 'REFRI-SERV-007', related: 'REFRI-MAT-010', weight: 7 },  // Recarga R404A + filtro

    // Calefón reparación + repuestos
    { source: 'GAS-SERV-003', related: 'GAS-MAT-001', weight: 8 },      // Reparación + válvula
    { source: 'GAS-SERV-003', related: 'GAS-MAT-002', weight: 7 },      // Reparación + intercambiador
    { source: 'GAS-SERV-003', related: 'GAS-MAT-003', weight: 9 },      // Reparación + termocupla

    // Termotanque installation
    { source: 'PLOM-SERV-009', related: 'PLOM-SERV-010', weight: 10 },  // Instalación + desinstalación
    { source: 'PLOM-SERV-009', related: 'PLOM-MAT-004', weight: 9 },    // Instalación + mangueras

    // Baño completo
    { source: 'PLOM-SERV-004', related: 'PLOM-SERV-005', weight: 8 },   // Inodoro + bidet
    { source: 'PLOM-SERV-004', related: 'PLOM-SERV-006', weight: 7 },   // Inodoro + vanitory
    { source: 'PLOM-SERV-007', related: 'PLOM-SERV-008', weight: 8 },   // Grifería ducha + lavatorio

    // Electricidad tablero
    { source: 'ELEC-SERV-002', related: 'ELEC-MAT-003', weight: 10 },   // Tablero trif + termo 32A
    { source: 'ELEC-SERV-002', related: 'ELEC-MAT-005', weight: 10 },   // Tablero trif + disyuntor
    { source: 'ELEC-SERV-001', related: 'ELEC-MAT-001', weight: 9 },    // Tablero mono + termo 16A
    { source: 'ELEC-SERV-001', related: 'ELEC-MAT-004', weight: 9 },    // Tablero mono + disyuntor
];

async function main() {
    console.log('🌱 Seeding Service Types and Pricebook...\n');

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
    // SEED SERVICE TYPES
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('📋 Seeding Service Types (Tipos de Servicio)...');

    let createdTypes = 0;
    let skippedTypes = 0;

    for (let i = 0; i < SERVICE_TYPES.length; i++) {
        const st = SERVICE_TYPES[i];
        try {
            await prisma.serviceTypeConfig.upsert({
                where: { organizationId_code: { organizationId, code: st.code } },
                update: {
                    name: st.name,
                    specialty: st.specialty,
                    color: st.color,
                    icon: st.icon,
                    isActive: true,
                    sortOrder: i,
                },
                create: {
                    code: st.code,
                    name: st.name,
                    specialty: st.specialty,
                    color: st.color,
                    icon: st.icon,
                    isActive: true,
                    sortOrder: i,
                    organizationId,
                },
            });
            createdTypes++;
        } catch {
            skippedTypes++;
        }
    }
    console.log(`   ✅ ${createdTypes} service types created/updated`);
    if (skippedTypes > 0) console.log(`   ⏭️  ${skippedTypes} skipped`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED PRICE ITEMS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n💰 Seeding Price Items (Lista de Precios)...');

    let createdItems = 0;
    let skippedItems = 0;
    const itemCodeToId: Record<string, string> = {};

    for (const item of PRICE_ITEMS) {
        try {
            // Check if item exists by name + organizationId
            const existing = await prisma.priceItem.findFirst({
                where: { organizationId, name: item.name },
            });

            if (existing) {
                itemCodeToId[item.code] = existing.id;
                skippedItems++;
                continue;
            }

            const created = await prisma.priceItem.create({
                data: {
                    name: item.name,
                    description: `${item.name} - ${item.specialty || 'General'}`,
                    type: item.type as 'SERVICE' | 'PRODUCT',
                    price: item.price,
                    unit: item.unit,
                    taxRate: 21.0,
                    specialty: item.specialty,
                    pricingModel: 'FIXED',
                    isActive: true,
                    organizationId,
                },
            });
            itemCodeToId[item.code] = created.id;
            createdItems++;
        } catch (e) {
            console.log(`   ⚠️  Error creating ${item.name}:`, e);
            skippedItems++;
        }
    }
    console.log(`   ✅ ${createdItems} price items created`);
    if (skippedItems > 0) console.log(`   ⏭️  ${skippedItems} already existed`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED RELATED ITEMS
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n🔗 Seeding Related Item Suggestions...');

    let createdRelations = 0;
    let skippedRelations = 0;

    for (const rel of RELATED_ITEMS) {
        const sourceId = itemCodeToId[rel.source];
        const relatedId = itemCodeToId[rel.related];

        if (!sourceId || !relatedId) {
            skippedRelations++;
            continue;
        }

        try {
            await prisma.priceItemRelation.upsert({
                where: { sourceItemId_relatedItemId: { sourceItemId: sourceId, relatedItemId: relatedId } },
                update: { weight: rel.weight },
                create: {
                    sourceItemId: sourceId,
                    relatedItemId: relatedId,
                    weight: rel.weight,
                },
            });
            createdRelations++;
        } catch {
            skippedRelations++;
        }
    }
    console.log(`   ✅ ${createdRelations} item relationships created`);
    if (skippedRelations > 0) console.log(`   ⏭️  ${skippedRelations} skipped`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 PRICEBOOK SEED COMPLETED!');
    console.log('═'.repeat(50));

    const typeCount = await prisma.serviceTypeConfig.count({ where: { organizationId } });
    const itemCount = await prisma.priceItem.count({ where: { organizationId } });
    const serviceCount = await prisma.priceItem.count({ where: { organizationId, type: 'SERVICE' } });
    const productCount = await prisma.priceItem.count({ where: { organizationId, type: 'PRODUCT' } });
    const relationCount = await prisma.priceItemRelation.count();

    console.log(`\n📊 Summary:`);
    console.log(`   Service Types: ${typeCount}`);
    console.log(`   Price Items: ${itemCount} (${serviceCount} services, ${productCount} products)`);
    console.log(`   Related Items: ${relationCount} relationships`);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
