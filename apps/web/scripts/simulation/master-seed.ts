/**
 * Master Seed Script - Unified Business Simulation
 * ==================================================
 * 
 * This is the main orchestrator for creating a realistic business simulation.
 * It runs all phases in order and passes context between them.
 * 
 * USAGE:
 *   npx tsx scripts/simulation/master-seed.ts
 * 
 * OPTIONS:
 *   --clean     Clean existing data before seeding
 * 
 * PHASES:
 *   1. Team           - Create technicians and vehicles
 *   2. Customers      - Create customer records
 *   3. Service Types  - Create service type configurations
 *   4. Pricebook      - Create price items (services and products)
 *   5. Inventory      - Create inventory items and warehouse stock
 *   6. Jobs           - Create jobs with proper relationships
 */

import { PrismaClient } from '@prisma/client';
import { getConfig, getSizeConfig, type CompanyConfig } from './data/company-profile';
import { TECHNICIANS } from './data/technicians';
import { VEHICLES } from './data/vehicles';
import { CUSTOMERS, generateAdditionalCustomers } from './data/customers';
import { getRandomServiceForTechnician, applyPriceVariation } from './data/job-templates';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SimulationContext {
    config: CompanyConfig;
    organizationId: string;
    technicians: Array<{ id: string; name: string; specialties: string[] }>;
    vehicles: Array<{ id: string; plateNumber: string }>;
    customers: Array<{ id: string; name: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: TEAM (Technicians + Vehicles)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedTeam(ctx: SimulationContext): Promise<void> {
    console.log('\n📋 Phase 1: Creating Team...');
    const sizeConfig = getSizeConfig(ctx.config.size);

    // Take only the number of technicians/vehicles needed for company size
    const techsToCreate = TECHNICIANS.slice(0, sizeConfig.technicians);
    const vehiclesToCreate = VEHICLES.slice(0, sizeConfig.vehicles);

    // Create vehicles first
    console.log(`   Creating ${vehiclesToCreate.length} vehicles...`);
    for (const vehicleData of vehiclesToCreate) {
        const vehicle = await prisma.vehicle.upsert({
            where: {
                organizationId_plateNumber: {
                    organizationId: ctx.organizationId,
                    plateNumber: vehicleData.plateNumber,
                }
            },
            update: {},
            create: {
                organizationId: ctx.organizationId,
                plateNumber: vehicleData.plateNumber,
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                color: vehicleData.color,
                vin: vehicleData.vin,
                fuelType: vehicleData.fuelType,
                currentMileage: vehicleData.currentMileage,
                status: 'ACTIVE',
                insuranceCompany: vehicleData.insuranceCompany,
                insurancePolicyNumber: vehicleData.insurancePolicy,
                insuranceExpiry: new Date(vehicleData.insuranceExpiry),
                vtvExpiry: new Date(vehicleData.vtvExpiry),
                registrationExpiry: new Date(vehicleData.registrationExpiry),
                notes: vehicleData.notes,
            },
        });
        ctx.vehicles.push({ id: vehicle.id, plateNumber: vehicle.plateNumber });
    }
    console.log(`   ✓ Created ${ctx.vehicles.length} vehicles`);

    // Create technicians (as Users with role TECHNICIAN)
    console.log(`   Creating ${techsToCreate.length} technicians...`);
    for (const techData of techsToCreate) {
        // Create user with technician data directly on User model
        const user = await prisma.user.upsert({
            where: { phone: techData.phone },
            update: {
                name: techData.name,
                email: techData.email,
                specialties: techData.specialties,
                uocraLevel: techData.uocraLevel as 'NONE' | 'AYUDANTE' | 'MEDIO_OFICIAL' | 'OFICIAL',
                driverLicenseNumber: techData.licenseNumber,
                driverLicenseCategory: techData.licenseCategory,
                driverLicenseExpiry: techData.licenseExpiry ? new Date(techData.licenseExpiry) : null,
                certifications: techData.certifications.enargasMatricula ? {
                    GASISTA: {
                        matricula: techData.certifications.enargasMatricula,
                        category: techData.certifications.enargasCategory,
                        expiry: techData.certifications.enargasExpiry,
                    }
                } : null,
                canBeAssignedJobs: true,
            },
            create: {
                organizationId: ctx.organizationId,
                phone: techData.phone,
                name: techData.name,
                email: techData.email,
                role: 'TECHNICIAN',
                specialties: techData.specialties,
                uocraLevel: techData.uocraLevel as 'NONE' | 'AYUDANTE' | 'MEDIO_OFICIAL' | 'OFICIAL',
                driverLicenseNumber: techData.licenseNumber,
                driverLicenseCategory: techData.licenseCategory,
                driverLicenseExpiry: techData.licenseExpiry ? new Date(techData.licenseExpiry) : null,
                certifications: techData.certifications.enargasMatricula ? {
                    GASISTA: {
                        matricula: techData.certifications.enargasMatricula,
                        category: techData.certifications.enargasCategory,
                        expiry: techData.certifications.enargasExpiry,
                    }
                } : null,
                canBeAssignedJobs: true,
            },
        });

        // Create vehicle assignment if specified
        if (techData.vehicleIndex !== null && ctx.vehicles[techData.vehicleIndex]) {
            const vehicleId = ctx.vehicles[techData.vehicleIndex].id;

            // Check if assignment already exists
            const existingAssignment = await prisma.vehicleAssignment.findFirst({
                where: { vehicleId, userId: user.id }
            });

            if (!existingAssignment) {
                await prisma.vehicleAssignment.create({
                    data: {
                        vehicleId,
                        userId: user.id,
                        isPrimaryDriver: true,
                        assignedFrom: new Date(),
                    },
                });
            }
        }

        ctx.technicians.push({
            id: user.id,
            name: techData.name,
            specialties: techData.specialties
        });
    }
    console.log(`   ✓ Created ${ctx.technicians.length} technicians`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

async function seedCustomers(ctx: SimulationContext): Promise<void> {
    console.log('\n👥 Phase 2: Creating Customers...');
    const sizeConfig = getSizeConfig(ctx.config.size);

    // Combine static + generated customers
    const additionalCount = Math.max(0, sizeConfig.customers - CUSTOMERS.length);
    const allCustomers = [...CUSTOMERS, ...generateAdditionalCustomers(additionalCount)];
    const customersToCreate = allCustomers.slice(0, sizeConfig.customers);

    let created = 0;
    for (const custData of customersToCreate) {
        // Check if customer exists first (no unique constraint on org+phone)
        const existing = await prisma.customer.findFirst({
            where: {
                organizationId: ctx.organizationId,
                phone: custData.phone,
            }
        });

        let customer;
        if (existing) {
            customer = existing;
        } else {
            customer = await prisma.customer.create({
                data: {
                    organizationId: ctx.organizationId,
                    name: custData.name,
                    phone: custData.phone,
                    email: custData.email,
                    // Address is stored as JSON in the schema
                    address: {
                        street: custData.address.street,
                        floor: custData.address.floor,
                        apartment: custData.address.apartment,
                        city: custData.address.city,
                        province: custData.address.province,
                        neighborhood: custData.address.neighborhood,
                        postalCode: custData.address.postalCode,
                        latitude: custData.address.coordinates.lat,
                        longitude: custData.address.coordinates.lng,
                        propertyType: custData.propertyType,
                        businessType: custData.businessType,
                    },
                    notes: custData.notes,
                    isVip: custData.isVip,
                    customerNumber: `CLI-${String(created + 1).padStart(4, '0')}`,
                },
            });
        }
        ctx.customers.push({ id: customer.id, name: customer.name });
        created++;

        // Progress indicator
        if (created % 20 === 0) {
            process.stdout.write(`\r   Creating customers... ${created}/${sizeConfig.customers}`);
        }
    }
    console.log(`\n   ✓ Created ${ctx.customers.length} customers`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: SERVICE TYPES (Tipos de Servicio)
// ═══════════════════════════════════════════════════════════════════════════════

const SERVICE_TYPES_DATA = [
    { code: 'INSTALACION_SPLIT', name: 'Instalación de Split', description: 'Instalación completa de equipo split', color: '#2196F3', icon: 'SnowflakeIcon', sortOrder: 1 },
    { code: 'REPARACION_SPLIT', name: 'Reparación de Split', description: 'Reparación de aires acondicionados split', color: '#F44336', icon: 'WrenchIcon', sortOrder: 2 },
    { code: 'MANTENIMIENTO_SPLIT', name: 'Mantenimiento de Split', description: 'Mantenimiento preventivo de split', color: '#4CAF50', icon: 'SettingsIcon', sortOrder: 3 },
    { code: 'INSTALACION_CALEFACTOR', name: 'Instalación de Calefactor', description: 'Instalación de calefactores a gas', color: '#FF9800', icon: 'FlameIcon', sortOrder: 4 },
    { code: 'REPARACION_CALEFACTOR', name: 'Reparación de Calefactor', description: 'Reparación de calefactores', color: '#E91E63', icon: 'WrenchIcon', sortOrder: 5 },
    { code: 'MANTENIMIENTO_CALEFACTOR', name: 'Mantenimiento de Calefactor', description: 'Mantenimiento de calefactores a gas', color: '#9C27B0', icon: 'SettingsIcon', sortOrder: 6 },
    { code: 'INSTALACION_PLOMERIA', name: 'Instalación Plomería', description: 'Instalaciones de plomería', color: '#00BCD4', icon: 'DropletIcon', sortOrder: 7 },
    { code: 'REPARACION_PLOMERIA', name: 'Reparación Plomería', description: 'Reparación de instalaciones de agua', color: '#3F51B5', icon: 'WrenchIcon', sortOrder: 8 },
    { code: 'INSTALACION_ELECTRICA', name: 'Instalación Eléctrica', description: 'Instalaciones eléctricas', color: '#FFC107', icon: 'BoltIcon', sortOrder: 9 },
    { code: 'REPARACION_ELECTRICA', name: 'Reparación Eléctrica', description: 'Reparación de instalaciones eléctricas', color: '#795548', icon: 'WrenchIcon', sortOrder: 10 },
    { code: 'INSPECCION_GAS', name: 'Inspección de Gas', description: 'Inspección y certificación de instalaciones de gas', color: '#607D8B', icon: 'ClipboardCheckIcon', sortOrder: 11 },
    { code: 'OTRO', name: 'Otro', description: 'Otros servicios', color: '#9E9E9E', icon: 'HelpCircleIcon', sortOrder: 99 },
];

async function seedServiceTypes(ctx: SimulationContext): Promise<void> {
    console.log('\n🔧 Phase 3: Creating Service Types...');

    let created = 0;
    let skipped = 0;

    for (const serviceType of SERVICE_TYPES_DATA) {
        try {
            const existing = await prisma.serviceTypeConfig.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    code: serviceType.code,
                },
            });

            if (existing) {
                skipped++;
                continue;
            }

            await prisma.serviceTypeConfig.create({
                data: {
                    ...serviceType,
                    organizationId: ctx.organizationId,
                    isActive: true,
                },
            });
            created++;
        } catch {
            // Ignore errors (e.g., table doesn't exist)
            skipped++;
        }
    }

    console.log(`   ✓ Created ${created} service types${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: PRICEBOOK (Lista de Precios)
// ═══════════════════════════════════════════════════════════════════════════════

const PRICEBOOK_DATA = [
    // Services - HVAC
    { name: 'Instalación Split 3000 frigorías', type: 'SERVICE', specialty: 'REFRIGERACION', price: 85000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación Split 4500 frigorías', type: 'SERVICE', specialty: 'REFRIGERACION', price: 105000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación Split 6000 frigorías', type: 'SERVICE', specialty: 'REFRIGERACION', price: 125000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Mantenimiento preventivo Split', type: 'SERVICE', specialty: 'REFRIGERACION', price: 18000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Carga de gas R410A', type: 'SERVICE', specialty: 'REFRIGERACION', price: 45000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Reparación compresor', type: 'SERVICE', specialty: 'REFRIGERACION', price: 65000, unit: 'servicio', taxRate: 21, pricingModel: 'QUOTE' },
    { name: 'Diagnóstico aire acondicionado', type: 'SERVICE', specialty: 'REFRIGERACION', price: 12000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },

    // Services - Gas
    { name: 'Instalación calefón', type: 'SERVICE', specialty: 'GASISTA', price: 35000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación calefactor tiro balanceado', type: 'SERVICE', specialty: 'GASISTA', price: 42000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Mantenimiento calefón', type: 'SERVICE', specialty: 'GASISTA', price: 15000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Cambio termocupla', type: 'SERVICE', specialty: 'GASISTA', price: 8500, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Inspección de gas domiciliario', type: 'SERVICE', specialty: 'GASISTA', price: 25000, unit: 'certificación', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Detección de fuga de gas', type: 'SERVICE', specialty: 'GASISTA', price: 12000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },

    // Services - Plumbing
    { name: 'Destape de cañerías', type: 'SERVICE', specialty: 'PLOMERO', price: 18000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Reparación de pérdida', type: 'SERVICE', specialty: 'PLOMERO', price: 15000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación grifería', type: 'SERVICE', specialty: 'PLOMERO', price: 12000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Cambio de flotante', type: 'SERVICE', specialty: 'PLOMERO', price: 8000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación sanitarios', type: 'SERVICE', specialty: 'PLOMERO', price: 28000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },

    // Services - Electrical
    { name: 'Instalación tablero eléctrico', type: 'SERVICE', specialty: 'ELECTRICISTA', price: 45000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Cambio de térmicas', type: 'SERVICE', specialty: 'ELECTRICISTA', price: 8500, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },
    { name: 'Instalación tomacorrientes', type: 'SERVICE', specialty: 'ELECTRICISTA', price: 6500, unit: 'punto', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Diagnóstico eléctrico', type: 'SERVICE', specialty: 'ELECTRICISTA', price: 10000, unit: 'servicio', taxRate: 21, pricingModel: 'FIXED' },

    // Hourly rates
    { name: 'Mano de obra refrigeración', type: 'SERVICE', specialty: 'REFRIGERACION', price: 8500, unit: 'hora', taxRate: 21, pricingModel: 'HOURLY' },
    { name: 'Mano de obra plomería', type: 'SERVICE', specialty: 'PLOMERO', price: 7500, unit: 'hora', taxRate: 21, pricingModel: 'HOURLY' },
    { name: 'Mano de obra electricidad', type: 'SERVICE', specialty: 'ELECTRICISTA', price: 7500, unit: 'hora', taxRate: 21, pricingModel: 'HOURLY' },
    { name: 'Mano de obra gasista', type: 'SERVICE', specialty: 'GASISTA', price: 8000, unit: 'hora', taxRate: 21, pricingModel: 'HOURLY' },

    // Products (common parts)
    { name: 'Capacitor 35µF', type: 'PRODUCT', specialty: 'REFRIGERACION', price: 2500, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Gas R410A (por kg)', type: 'PRODUCT', specialty: 'REFRIGERACION', price: 8500, unit: 'kg', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Control remoto universal', type: 'PRODUCT', specialty: 'REFRIGERACION', price: 4500, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Termocupla universal 900mm', type: 'PRODUCT', specialty: 'GASISTA', price: 3500, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Flexible gas 1m', type: 'PRODUCT', specialty: 'GASISTA', price: 3500, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Llave esférica 1/2"', type: 'PRODUCT', specialty: 'PLOMERO', price: 2800, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Termomagnética 1x20A', type: 'PRODUCT', specialty: 'ELECTRICISTA', price: 3100, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
    { name: 'Diferencial 2x25A 30mA', type: 'PRODUCT', specialty: 'ELECTRICISTA', price: 12500, unit: 'unidad', taxRate: 21, pricingModel: 'PER_UNIT' },
];

async function seedPricebook(ctx: SimulationContext): Promise<void> {
    console.log('\n💰 Phase 4: Creating Pricebook Items...');

    let created = 0;
    let skipped = 0;

    for (const item of PRICEBOOK_DATA) {
        try {
            // Check if item with same name exists
            const existing = await prisma.priceItem.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    name: item.name,
                },
            });

            if (existing) {
                skipped++;
                continue;
            }

            await prisma.priceItem.create({
                data: {
                    organizationId: ctx.organizationId,
                    name: item.name,
                    type: item.type as 'SERVICE' | 'PRODUCT',
                    specialty: item.specialty,
                    price: item.price,
                    priceCurrency: 'ARS',
                    unit: item.unit,
                    taxRate: item.taxRate,
                    pricingModel: item.pricingModel as 'FIXED' | 'HOURLY' | 'PER_UNIT' | 'PER_M2' | 'PER_DAY' | 'QUOTE',
                    isActive: true,
                },
            });
            created++;
        } catch {
            // Ignore errors (e.g., table doesn't exist)
            skipped++;
        }
    }

    console.log(`   ✓ Created ${created} pricebook items${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

const INVENTORY_ITEMS = [
    // Refrigeration
    { sku: 'REF-001', name: 'Capacitor 35µF', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2500, minStock: 10 },
    { sku: 'REF-002', name: 'Capacitor 45µF', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3200, minStock: 8 },
    { sku: 'REF-003', name: 'Gas R410A (balón 11kg)', category: 'CONSUMABLES', unit: 'unidad', costPrice: 75000, salePrice: 95000, minStock: 3 },
    { sku: 'REF-010', name: 'Termostato digital universal', category: 'PARTS', unit: 'unidad', costPrice: 5500, salePrice: 8000, minStock: 8 },
    { sku: 'REF-014', name: 'Control remoto universal', category: 'PARTS', unit: 'unidad', costPrice: 2500, salePrice: 4500, minStock: 20 },

    // Plumbing
    { sku: 'PLO-001', name: 'Caño PPF 1/2" x 4m', category: 'PARTS', unit: 'unidad', costPrice: 850, salePrice: 1200, minStock: 50 },
    { sku: 'PLO-008', name: 'Llave esférica 1/2"', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2800, minStock: 30 },
    { sku: 'PLO-013', name: 'Cinta teflón (rollo)', category: 'CONSUMABLES', unit: 'unidad', costPrice: 150, salePrice: 300, minStock: 100 },

    // Gas
    { sku: 'GAS-001', name: 'Termocupla universal 900mm', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3500, minStock: 20 },
    { sku: 'GAS-006', name: 'Flexible gas 1/2" x 1m', category: 'PARTS', unit: 'unidad', costPrice: 2200, salePrice: 3500, minStock: 25 },
    { sku: 'GAS-010', name: 'Spray detector fugas 400ml', category: 'CONSUMABLES', unit: 'unidad', costPrice: 1200, salePrice: 1900, minStock: 20 },

    // Electrical
    { sku: 'ELE-001', name: 'Termomagnética 1x16A', category: 'PARTS', unit: 'unidad', costPrice: 1800, salePrice: 2800, minStock: 25 },
    { sku: 'ELE-002', name: 'Termomagnética 1x20A', category: 'PARTS', unit: 'unidad', costPrice: 2000, salePrice: 3100, minStock: 25 },
    { sku: 'ELE-004', name: 'Diferencial 2x25A 30mA', category: 'PARTS', unit: 'unidad', costPrice: 8500, salePrice: 12500, minStock: 8 },
    { sku: 'ELE-010', name: 'Tomacorriente 10A', category: 'PARTS', unit: 'unidad', costPrice: 450, salePrice: 750, minStock: 50 },

    // Consumables
    { sku: 'CON-001', name: 'Precintos 200mm (x100)', category: 'CONSUMABLES', unit: 'bolsa', costPrice: 350, salePrice: 600, minStock: 50 },
    { sku: 'CON-003', name: 'Cinta aisladora 20m', category: 'CONSUMABLES', unit: 'rollo', costPrice: 250, salePrice: 450, minStock: 100 },
    { sku: 'CON-004', name: 'Silicona 280ml', category: 'CONSUMABLES', unit: 'cartucho', costPrice: 1200, salePrice: 1900, minStock: 30 },
];

const INVENTORY_LOCATIONS = [
    { name: 'Depósito Central', type: 'WAREHOUSE', address: 'Av. Corrientes 1234, CABA' },
];

async function seedInventory(ctx: SimulationContext): Promise<void> {
    console.log('\n📦 Phase 5: Creating Inventory...');

    // Find owner for transactions
    const owner = await prisma.user.findFirst({
        where: { organizationId: ctx.organizationId, role: 'OWNER' },
    });

    if (!owner) {
        console.log('   ⚠️ No owner found, skipping inventory');
        return;
    }

    // Create main warehouse location
    let warehouseId: string | null = null;

    for (const loc of INVENTORY_LOCATIONS) {
        try {
            const existing = await prisma.inventoryLocation.findFirst({
                where: { organizationId: ctx.organizationId, name: loc.name },
            });

            if (existing) {
                warehouseId = existing.id;
            } else {
                const created = await prisma.inventoryLocation.create({
                    data: {
                        name: loc.name,
                        locationType: loc.type as 'WAREHOUSE' | 'HUB' | 'VEHICLE',
                        address: loc.address,
                        isActive: true,
                        organizationId: ctx.organizationId,
                    },
                });
                warehouseId = created.id;
            }
        } catch {
            // Ignore
        }
    }

    // Create inventory items with stock
    let created = 0;
    let skipped = 0;

    for (const item of INVENTORY_ITEMS) {
        try {
            const existing = await prisma.inventoryItem.findFirst({
                where: { organizationId: ctx.organizationId, sku: item.sku },
            });

            if (existing) {
                skipped++;
                continue;
            }

            const inventoryItem = await prisma.inventoryItem.create({
                data: {
                    sku: item.sku,
                    name: item.name,
                    category: item.category as 'PARTS' | 'TOOLS' | 'CONSUMABLES' | 'EQUIPMENT' | 'SAFETY' | 'OTHER',
                    unit: item.unit,
                    minStockLevel: item.minStock,
                    costPrice: item.costPrice,
                    salePrice: item.salePrice,
                    isActive: true,
                    organizationId: ctx.organizationId,
                },
            });

            // Create initial stock if warehouse exists
            if (warehouseId) {
                const initialQty = Math.floor(Math.random() * (item.minStock * 3)) + item.minStock;

                await prisma.inventoryStock.create({
                    data: {
                        itemId: inventoryItem.id,
                        locationId: warehouseId,
                        quantity: initialQty,
                        lastCountedAt: new Date(),
                    },
                });

                await prisma.inventoryTransaction.create({
                    data: {
                        itemId: inventoryItem.id,
                        toLocationId: warehouseId,
                        quantity: initialQty,
                        transactionType: 'INITIAL_STOCK',
                        notes: 'Stock inicial del sistema',
                        performedById: owner.id,
                        organizationId: ctx.organizationId,
                    },
                });
            }

            created++;
        } catch {
            skipped++;
        }
    }

    console.log(`   ✓ Created ${created} inventory items${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
    if (warehouseId) {
        console.log(`   ✓ Created warehouse with initial stock`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: JOBS
// ═══════════════════════════════════════════════════════════════════════════════

async function seedJobs(ctx: SimulationContext): Promise<void> {
    console.log('\n🔧 Phase 6: Creating Jobs...');
    const sizeConfig = getSizeConfig(ctx.config.size);
    const totalJobs = sizeConfig.historicalJobs + sizeConfig.pendingJobs;

    // Get owner/creator for jobs
    const owner = await prisma.user.findFirst({
        where: { organizationId: ctx.organizationId, role: 'OWNER' }
    });

    if (!owner) {
        console.log('   ⚠ No owner found, skipping jobs');
        return;
    }

    // Calculate date range (6 months of history)
    const startDate = ctx.config.historyStartDate;
    const endDate = ctx.config.historyEndDate;
    const dateRange = endDate.getTime() - startDate.getTime();

    let created = 0;
    const statusWeights = [
        { status: 'COMPLETED' as const, weight: 0.60 },
        { status: 'IN_PROGRESS' as const, weight: 0.15 },
        { status: 'ASSIGNED' as const, weight: 0.10 },
        { status: 'EN_ROUTE' as const, weight: 0.05 },
        { status: 'PENDING' as const, weight: 0.08 },
        { status: 'CANCELLED' as const, weight: 0.02 },
    ];

    for (let i = 0; i < totalJobs; i++) {
        // Pick random customer and technician
        const customer = ctx.customers[Math.floor(Math.random() * ctx.customers.length)];
        const tech = ctx.technicians[Math.floor(Math.random() * ctx.technicians.length)];

        // Get service type matching technician's skills
        const service = getRandomServiceForTechnician(tech.specialties);

        // Determine status based on distribution
        let status: 'COMPLETED' | 'IN_PROGRESS' | 'ASSIGNED' | 'EN_ROUTE' | 'PENDING' | 'CANCELLED' = 'COMPLETED';
        const roll = Math.random();
        let cumulative = 0;
        for (const sw of statusWeights) {
            cumulative += sw.weight;
            if (roll < cumulative) {
                status = sw.status;
                break;
            }
        }

        // Generate dates based on status
        let scheduledDate: Date;
        let completedDate: Date | null = null;

        if (status === 'PENDING' || status === 'ASSIGNED') {
            // Future jobs
            scheduledDate = new Date(endDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
        } else {
            // Historical jobs
            scheduledDate = new Date(startDate.getTime() + Math.random() * dateRange);
            if (status === 'COMPLETED') {
                completedDate = new Date(scheduledDate.getTime() + service.estimatedHours * 60 * 60 * 1000);
            }
        }

        const price = applyPriceVariation(service.basePrice);
        const jobNumber = `JOB-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`;

        try {
            await prisma.job.create({
                data: {
                    organizationId: ctx.organizationId,
                    jobNumber,
                    customerId: customer.id,
                    createdById: owner.id,  // Required field
                    technicianId: ['PENDING'].includes(status) ? null : tech.id,
                    serviceType: service.enumValue,  // Use the Prisma enum value
                    serviceTypeCode: service.enumValue === 'OTRO' ? service.code : null,
                    description: service.description,
                    status,
                    urgency: Math.random() > 0.85 ? 'URGENTE' : 'NORMAL',
                    scheduledDate,
                    completedAt: completedDate,
                    estimatedTotal: price,
                    finalTotal: completedDate ? price : null,
                },
            });
            created++;

            // Progress indicator every 50 jobs
            if (created % 50 === 0) {
                process.stdout.write(`\r   Creating jobs... ${created}/${totalJobs}`);
            }
        } catch (e) {
            // Log first error only
            if (created === 0) {
                console.error('\n   First error:', e);
            }
        }
    }
    console.log(`\n   ✓ Created ${created} jobs`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAN EXISTING DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function cleanExistingData(organizationId: string): Promise<void> {
    console.log('\n🧹 Cleaning existing simulation data...');

    // Get owner ID to preserve
    const owner = await prisma.user.findFirst({
        where: { organizationId, role: 'OWNER' }
    });
    const ownerId = owner?.id;

    // Delete in order to respect foreign keys
    await prisma.job.deleteMany({ where: { organizationId } });
    console.log('   ✓ Deleted jobs');

    await prisma.customer.deleteMany({ where: { organizationId } });
    console.log('   ✓ Deleted customers');

    // Get all vehicle IDs for this org
    const vehicles = await prisma.vehicle.findMany({
        where: { organizationId },
        select: { id: true }
    });
    const vehicleIds = vehicles.map((v: { id: string }) => v.id);

    // Delete vehicle assignments
    if (vehicleIds.length > 0) {
        await prisma.vehicleAssignment.deleteMany({
            where: { vehicleId: { in: vehicleIds } }
        });
    }
    console.log('   ✓ Deleted vehicle assignments');

    // Delete technicians (users with role=TECHNICIAN, but not owner)
    if (ownerId) {
        await prisma.user.deleteMany({
            where: {
                organizationId,
                role: 'TECHNICIAN',
                id: { not: ownerId }
            }
        });
    } else {
        await prisma.user.deleteMany({
            where: {
                organizationId,
                role: 'TECHNICIAN'
            }
        });
    }
    console.log('   ✓ Deleted technicians');

    await prisma.vehicle.deleteMany({ where: { organizationId } });
    console.log('   ✓ Deleted vehicles');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║       CampoTech - Master Business Simulation Seed             ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    const config = getConfig();
    const sizeConfig = getSizeConfig(config.size);

    console.log(`\n📊 Configuration:`);
    console.log(`   Organization: ${config.companyName} (${config.organizationId})`);
    console.log(`   Size: ${config.size}`);
    console.log(`   Technicians: ${sizeConfig.technicians}`);
    console.log(`   Vehicles: ${sizeConfig.vehicles}`);
    console.log(`   Customers: ${sizeConfig.customers}`);
    console.log(`   Jobs: ${sizeConfig.historicalJobs + sizeConfig.pendingJobs}`);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
        where: { id: config.organizationId }
    });

    if (!org) {
        console.error(`\n❌ Organization not found: ${config.organizationId}`);
        console.error('   Please update data/company-profile.ts with a valid organization ID.');
        process.exit(1);
    }

    console.log(`   ✓ Organization verified: ${org.name}`);

    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');
    if (shouldClean) {
        await cleanExistingData(config.organizationId);
    }

    // Initialize context
    const ctx: SimulationContext = {
        config,
        organizationId: config.organizationId,
        technicians: [],
        vehicles: [],
        customers: [],
    };

    // Run phases
    const startTime = Date.now();

    await seedTeam(ctx);
    await seedCustomers(ctx);
    await seedServiceTypes(ctx);
    await seedPricebook(ctx);
    await seedInventory(ctx);
    await seedJobs(ctx);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ Simulation Complete!                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\n📈 Summary:`);
    console.log(`   Technicians: ${ctx.technicians.length}`);
    console.log(`   Vehicles: ${ctx.vehicles.length}`);
    console.log(`   Customers: ${ctx.customers.length}`);
    console.log(`   Time: ${elapsed}s`);
    console.log('\n💡 Tip: Run with --clean to reset data before seeding.');
}

main()
    .catch((e) => {
        console.error('\n❌ Simulation error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
