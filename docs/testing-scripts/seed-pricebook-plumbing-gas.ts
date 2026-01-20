/**
 * Seed script for plumbing and gas work price items
 * 
 * This script creates a comprehensive pricebook for a plumbing and gas company,
 * including various services and products with different pricing models.
 * 
 * Organization ID: cmkjw6ibj0000a00ix05zn1ed
 * 
 * Run with: npx tsx docs/testing-scripts/seed-pricebook-plumbing-gas.ts
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const ORGANIZATION_ID = 'cmkjw6ibj0000a00ix05zn1ed';

// ═══════════════════════════════════════════════════════════════════════════════
// PLUMBING SERVICES (PLOMERO)
// ═══════════════════════════════════════════════════════════════════════════════
const plumbingServices = [
    // Fixed Price Services
    {
        name: 'Destapación de cañería simple',
        description: 'Destapación de cañería de cocina o baño con sonda manual',
        type: 'SERVICE' as const,
        price: 15000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Destapación de cañería con máquina',
        description: 'Destapación de cañería principal con máquina destapadora profesional',
        type: 'SERVICE' as const,
        price: 35000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Reparación de pérdida de agua simple',
        description: 'Reparación de pérdida de agua menor en canilla, conexión o caño accesible',
        type: 'SERVICE' as const,
        price: 12000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de canilla monocomando',
        description: 'Instalación de canilla monocomando completa (incluye conexiones)',
        type: 'SERVICE' as const,
        price: 18000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Cambio de flotante de inodoro',
        description: 'Reemplazo de mecanismo de flotante y válvula de descarga',
        type: 'SERVICE' as const,
        price: 8500,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de inodoro completo',
        description: 'Instalación de inodoro nuevo incluyendo conexiones de agua y desagüe',
        type: 'SERVICE' as const,
        price: 25000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de bidet',
        description: 'Instalación de bidet con conexiones de agua fría y caliente',
        type: 'SERVICE' as const,
        price: 22000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de termotanque eléctrico',
        description: 'Instalación de termotanque eléctrico hasta 80 lts, incluye conexiones',
        type: 'SERVICE' as const,
        price: 28000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Reparación de termotanque',
        description: 'Diagnóstico y reparación de termotanque (ánodo, termostato, válvula)',
        type: 'SERVICE' as const,
        price: 20000,
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },

    // Hourly Services
    {
        name: 'Mano de obra plomería - hora',
        description: 'Trabajo de plomería por hora (trabajos varios, reparaciones complejas)',
        type: 'SERVICE' as const,
        price: 8000,
        unit: 'hora',
        specialty: 'PLOMERO',
        pricingModel: 'HOURLY' as const,
        taxRate: 21,
    },
    {
        name: 'Búsqueda de pérdida oculta',
        description: 'Trabajo de detección de pérdidas ocultas en cañerías empotradas',
        type: 'SERVICE' as const,
        price: 12000,
        unit: 'hora',
        specialty: 'PLOMERO',
        pricingModel: 'HOURLY' as const,
        taxRate: 21,
    },

    // Per Unit Services
    {
        name: 'Instalación de punto de agua',
        description: 'Instalación de punto de agua nuevo (caño, conexiones, canilla)',
        type: 'SERVICE' as const,
        price: 18000,
        unit: 'punto',
        specialty: 'PLOMERO',
        pricingModel: 'PER_UNIT' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de bajada de agua',
        description: 'Instalación de caño de bajada para desagüe',
        type: 'SERVICE' as const,
        price: 25000,
        unit: 'punto',
        specialty: 'PLOMERO',
        pricingModel: 'PER_UNIT' as const,
        taxRate: 21,
    },

    // Quote-based Services
    {
        name: 'Renovación de baño completo',
        description: 'Plomería completa para renovación de baño (presupuesto a medida)',
        type: 'SERVICE' as const,
        price: 0,
        specialty: 'PLOMERO',
        pricingModel: 'QUOTE' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de cañería nueva',
        description: 'Instalación de cañería nueva para construcción o renovación',
        type: 'SERVICE' as const,
        price: 0,
        specialty: 'PLOMERO',
        pricingModel: 'QUOTE' as const,
        taxRate: 21,
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GAS SERVICES (GASISTA)
// ═══════════════════════════════════════════════════════════════════════════════
const gasServices = [
    // Fixed Price Services
    {
        name: 'Revisión y habilitación de gas',
        description: 'Inspección completa de instalación de gas y emisión de certificado de habilitación',
        type: 'SERVICE' as const,
        price: 45000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Conexión de cocina a gas',
        description: 'Conexión de cocina al suministro de gas existente, incluye flexible y prueba',
        type: 'SERVICE' as const,
        price: 12000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Conexión de horno a gas',
        description: 'Conexión de horno separado al suministro de gas',
        type: 'SERVICE' as const,
        price: 15000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de calefón a gas',
        description: 'Instalación de calefón a gas incluyendo conexión de gas, agua y ventilación',
        type: 'SERVICE' as const,
        price: 38000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Cambio de termocupla',
        description: 'Reemplazo de termocupla en cocina, horno o calefón',
        type: 'SERVICE' as const,
        price: 8000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Limpieza de quemadores de cocina',
        description: 'Limpieza y ajuste de quemadores de cocina (4-6 hornallas)',
        type: 'SERVICE' as const,
        price: 15000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Service de calefón',
        description: 'Mantenimiento completo de calefón (limpieza, ajuste, prueba de seguridad)',
        type: 'SERVICE' as const,
        price: 22000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Service de caldera',
        description: 'Mantenimiento anual de caldera (limpieza, purga, ajuste)',
        type: 'SERVICE' as const,
        price: 35000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Reparación de pérdida de gas',
        description: 'Detección y reparación de fuga de gas en instalación existente',
        type: 'SERVICE' as const,
        price: 25000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de detector de gas',
        description: 'Instalación de detector de monóxido de carbono y gas natural',
        type: 'SERVICE' as const,
        price: 12000,
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },

    // Hourly Services
    {
        name: 'Mano de obra gasista - hora',
        description: 'Trabajo de instalación de gas por hora (trabajos varios)',
        type: 'SERVICE' as const,
        price: 10000,
        unit: 'hora',
        specialty: 'GASISTA',
        pricingModel: 'HOURLY' as const,
        taxRate: 21,
    },

    // Per Unit Services
    {
        name: 'Extensión de cañería de gas',
        description: 'Extensión de cañería de gas por metro lineal (incluye materiales básicos)',
        type: 'SERVICE' as const,
        price: 8000,
        unit: 'metro',
        specialty: 'GASISTA',
        pricingModel: 'PER_UNIT' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de punto de gas',
        description: 'Instalación de boca de gas nueva (conexión para artefacto)',
        type: 'SERVICE' as const,
        price: 22000,
        unit: 'punto',
        specialty: 'GASISTA',
        pricingModel: 'PER_UNIT' as const,
        taxRate: 21,
    },
    {
        name: 'Colocación de radiador',
        description: 'Instalación de radiador de calefacción central',
        type: 'SERVICE' as const,
        price: 18000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'PER_UNIT' as const,
        taxRate: 21,
    },

    // Per Day Services
    {
        name: 'Jornal gasista matriculado',
        description: 'Jornada completa de trabajo de gasista matriculado (8 horas)',
        type: 'SERVICE' as const,
        price: 65000,
        unit: 'jornal',
        specialty: 'GASISTA',
        pricingModel: 'PER_DAY' as const,
        taxRate: 21,
    },

    // Quote-based Services
    {
        name: 'Instalación de gas natural nueva',
        description: 'Instalación completa de gas natural para vivienda (presupuesto a medida)',
        type: 'SERVICE' as const,
        price: 0,
        specialty: 'GASISTA',
        pricingModel: 'QUOTE' as const,
        taxRate: 21,
    },
    {
        name: 'Conversión de gas envasado a natural',
        description: 'Conversión de instalación de gas envasado a gas natural',
        type: 'SERVICE' as const,
        price: 0,
        specialty: 'GASISTA',
        pricingModel: 'QUOTE' as const,
        taxRate: 21,
    },
    {
        name: 'Instalación de calefacción central',
        description: 'Sistema completo de calefacción central con caldera y radiadores',
        type: 'SERVICE' as const,
        price: 0,
        specialty: 'GASISTA',
        pricingModel: 'QUOTE' as const,
        taxRate: 21,
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PLUMBING PRODUCTS (PLOMERO)
// ═══════════════════════════════════════════════════════════════════════════════
const plumbingProducts = [
    // Standard IVA (21%)
    {
        name: 'Canilla monocomando cocina',
        description: 'Canilla monocomando para cocina, marca standard',
        type: 'PRODUCT' as const,
        price: 35000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Canilla monocomando baño',
        description: 'Canilla monocomando para lavatorio de baño',
        type: 'PRODUCT' as const,
        price: 28000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Grifería para ducha',
        description: 'Grifería monocomando para ducha con duchador',
        type: 'PRODUCT' as const,
        price: 42000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Flexible de acero inoxidable 40cm',
        description: 'Flexible de acero inoxidable para canilla, 40cm',
        type: 'PRODUCT' as const,
        price: 3500,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Caño PPR 20mm (6m)',
        description: 'Caño de polipropileno 20mm x 6 metros para agua caliente/fría',
        type: 'PRODUCT' as const,
        price: 8500,
        unit: 'barra',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Caño PPR 25mm (6m)',
        description: 'Caño de polipropileno 25mm x 6 metros para agua caliente/fría',
        type: 'PRODUCT' as const,
        price: 12000,
        unit: 'barra',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Mecanismo de flotante completo',
        description: 'Mecanismo de flotante universal para mochila de inodoro',
        type: 'PRODUCT' as const,
        price: 8000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Sifón de PVC para pileta',
        description: 'Sifón de PVC con tapa registrable para pileta de cocina/lavadero',
        type: 'PRODUCT' as const,
        price: 3200,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Termotanque eléctrico 50L',
        description: 'Termotanque eléctrico 50 litros, marca estándar',
        type: 'PRODUCT' as const,
        price: 150000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Termotanque eléctrico 80L',
        description: 'Termotanque eléctrico 80 litros, marca estándar',
        type: 'PRODUCT' as const,
        price: 185000,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },

    // Reduced IVA (10.5%) - some basic items
    {
        name: 'Cinta teflón profesional',
        description: 'Cinta teflón de alta densidad para roscas',
        type: 'PRODUCT' as const,
        price: 800,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 10.5,
    },
    {
        name: 'Pasta para soldar',
        description: 'Pasta decapante para soldadura de estaño en cañerías',
        type: 'PRODUCT' as const,
        price: 1200,
        unit: 'unidad',
        specialty: 'PLOMERO',
        pricingModel: 'FIXED' as const,
        taxRate: 10.5,
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GAS PRODUCTS (GASISTA)
// ═══════════════════════════════════════════════════════════════════════════════
const gasProducts = [
    {
        name: 'Flexible para gas 1/2" x 1.5m',
        description: 'Flexible de acero inoxidable para gas, homologado, 1/2" x 1.5 metros',
        type: 'PRODUCT' as const,
        price: 12000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Válvula de paso para gas 1/2"',
        description: 'Válvula de paso esférica para gas, bronce, 1/2"',
        type: 'PRODUCT' as const,
        price: 5500,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Termocupla universal',
        description: 'Termocupla universal para artefactos a gas, 60cm',
        type: 'PRODUCT' as const,
        price: 4500,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Piloto completo para calefón',
        description: 'Kit de piloto completo para calefón (piloto + termocupla + electrodo)',
        type: 'PRODUCT' as const,
        price: 18000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Caño de gas negro 1/2" (6m)',
        description: 'Caño de hierro negro para instalación de gas, 1/2" x 6 metros',
        type: 'PRODUCT' as const,
        price: 22000,
        unit: 'barra',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Caño de gas negro 3/4" (6m)',
        description: 'Caño de hierro negro para instalación de gas, 3/4" x 6 metros',
        type: 'PRODUCT' as const,
        price: 28000,
        unit: 'barra',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Detector de monóxido de carbono',
        description: 'Detector de CO con alarma sonora, homologado',
        type: 'PRODUCT' as const,
        price: 15000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Regulador de presión para gas natural',
        description: 'Regulador de presión para instalación de gas natural doméstico',
        type: 'PRODUCT' as const,
        price: 8500,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Calefón a gas 14L',
        description: 'Calefón a gas natural/envasado, 14 litros, tiro balanceado',
        type: 'PRODUCT' as const,
        price: 280000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Estufa tiro balanceado 3000 kcal',
        description: 'Estufa a gas tiro balanceado 3000 kcal/h',
        type: 'PRODUCT' as const,
        price: 180000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Estufa tiro balanceado 5000 kcal',
        description: 'Estufa a gas tiro balanceado 5000 kcal/h',
        type: 'PRODUCT' as const,
        price: 220000,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },

    // Exempt (0% IVA) - safety items
    {
        name: 'Kit de seguridad para gas',
        description: 'Kit de detección de fugas de gas (spray detector)',
        type: 'PRODUCT' as const,
        price: 2500,
        unit: 'unidad',
        specialty: 'GASISTA',
        pricingModel: 'FIXED' as const,
        taxRate: 0,
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// VIAJES Y VISITAS (Visit/Travel charges - no specialty)
// ═══════════════════════════════════════════════════════════════════════════════
const generalServices = [
    {
        name: 'Viático / Visita técnica',
        description: 'Cargo por visita y diagnóstico inicial (se descuenta si se realiza el trabajo)',
        type: 'SERVICE' as const,
        price: 8000,
        specialty: null,
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Viático zona alejada',
        description: 'Cargo adicional por visita fuera del radio habitual de servicio',
        type: 'SERVICE' as const,
        price: 15000,
        specialty: null,
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Urgencia fuera de horario',
        description: 'Recargo por atención de emergencia fuera de horario laboral',
        type: 'SERVICE' as const,
        price: 12000,
        specialty: null,
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
    {
        name: 'Urgencia fin de semana/feriado',
        description: 'Recargo por atención de emergencia en fin de semana o feriado',
        type: 'SERVICE' as const,
        price: 18000,
        specialty: null,
        pricingModel: 'FIXED' as const,
        taxRate: 21,
    },
];

async function main() {
    console.log('🔧 Seeding pricebook for plumbing and gas company...\n');

    // First, verify the organization exists
    const org = await prisma.organization.findUnique({
        where: { id: ORGANIZATION_ID },
        select: { id: true, name: true },
    });

    if (!org) {
        console.error(`❌ Organization not found: ${ORGANIZATION_ID}`);
        console.log('Please verify the organization ID exists in the database.');
        process.exit(1);
    }

    console.log(`✅ Found organization: ${org.name} (${org.id})\n`);

    // Clear existing price items for this organization (optional)
    const deleted = await prisma.priceItem.deleteMany({
        where: { organizationId: ORGANIZATION_ID },
    });
    console.log(`🗑️  Deleted ${deleted.count} existing price items\n`);

    // Combine all items
    const allItems = [
        ...plumbingServices,
        ...gasServices,
        ...plumbingProducts,
        ...gasProducts,
        ...generalServices,
    ];

    // Create all price items
    let created = 0;
    const errors: string[] = [];

    for (const item of allItems) {
        try {
            await prisma.priceItem.create({
                data: {
                    organizationId: ORGANIZATION_ID,
                    name: item.name,
                    description: item.description,
                    type: item.type,
                    price: new Decimal(item.price),
                    unit: item.unit || null,
                    taxRate: new Decimal(item.taxRate),
                    isActive: true,
                    specialty: item.specialty || null,
                    pricingModel: item.pricingModel || null,
                },
            });
            created++;
            console.log(`  ✓ Created: ${item.name} (${item.type}, ${item.specialty || 'General'}, ${item.pricingModel})`);
        } catch (error) {
            const err = error instanceof Error ? error.message : String(error);
            errors.push(`${item.name}: ${err}`);
            console.error(`  ✗ Failed: ${item.name} - ${err}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Created: ${created} items`);
    console.log(`❌ Errors: ${errors.length} items`);
    console.log(`📦 Total attempted: ${allItems.length} items`);
    console.log('');
    console.log('By specialty:');
    console.log(`  🔧 PLOMERO (Plumbing): ${plumbingServices.length} services, ${plumbingProducts.length} products`);
    console.log(`  🔥 GASISTA (Gas): ${gasServices.length} services, ${gasProducts.length} products`);
    console.log(`  📋 General: ${generalServices.length} items`);
    console.log('');
    console.log('By pricing model:');
    const byModel = allItems.reduce((acc, item) => {
        const model = item.pricingModel || 'NONE';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    Object.entries(byModel).forEach(([model, count]) => {
        console.log(`  ${model}: ${count} items`);
    });
    console.log('');
    console.log('By tax rate:');
    const byTax = allItems.reduce((acc, item) => {
        const rate = `${item.taxRate}%`;
        acc[rate] = (acc[rate] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    Object.entries(byTax).forEach(([rate, count]) => {
        console.log(`  IVA ${rate}: ${count} items`);
    });
    console.log('');

    if (errors.length > 0) {
        console.log('❌ Errors encountered:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
}

main()
    .catch((e) => {
        console.error('Fatal error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
