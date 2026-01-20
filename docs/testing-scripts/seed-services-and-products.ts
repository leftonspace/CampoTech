/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SEED SERVICES & PRODUCTS FOR MULTI-TRADE COMPANY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This script seeds realistic services and products for a company offering:
 * - PLOMERÍA (Plumbing)
 * - ELECTRICIDAD (Electrical)
 * - GAS (Gas installations)
 * - REFRIGERACIÓN (HVAC/Refrigeration)
 *
 * Creates:
 * 1. ServiceTypeConfig entries (organization-specific service types)
 * 2. PriceItem entries (services and products with pricing)
 *
 * USAGE: npx tsx docs/testing-scripts/seed-services-and-products.ts <org-id>
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, PricingModel, PriceItemType } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE SPECIALTIES (Maps to User.specialties / User.specialty)
// ═══════════════════════════════════════════════════════════════════════════════

type Specialty = 'PLOMERO' | 'ELECTRICISTA' | 'GASISTA' | 'REFRIGERACION';

const SPECIALTIES: Record<Specialty, { color: string; icon: string }> = {
    PLOMERO: { color: '#3B82F6', icon: '🔧' },         // Blue
    ELECTRICISTA: { color: '#F59E0B', icon: '⚡' },    // Yellow/Orange
    GASISTA: { color: '#EF4444', icon: '🔥' },         // Red
    REFRIGERACION: { color: '#06B6D4', icon: '❄️' },   // Cyan
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE TYPE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceTypeData {
    code: string;
    name: string;
    description: string;
    specialty: Specialty;
    color: string;
    icon: string;
    sortOrder: number;
}

const SERVICE_TYPES: ServiceTypeData[] = [
    // ─── PLOMERÍA ───────────────────────────────────────────────────────────────
    { code: 'PLOM_DESTAPE', name: 'Destape de cañería', description: 'Destape de cañerías con máquina desatascadora o químicos', specialty: 'PLOMERO', color: '#3B82F6', icon: '🚿', sortOrder: 1 },
    { code: 'PLOM_PERDIDA', name: 'Reparación de pérdida', description: 'Identificación y reparación de pérdidas de agua', specialty: 'PLOMERO', color: '#3B82F6', icon: '💧', sortOrder: 2 },
    { code: 'PLOM_CANERIA', name: 'Instalación de cañería', description: 'Instalación nueva o reemplazo de cañerías', specialty: 'PLOMERO', color: '#3B82F6', icon: '🔧', sortOrder: 3 },
    { code: 'PLOM_SANITARIO', name: 'Instalación sanitarios', description: 'Instalación de inodoros, bidets, lavatorios', specialty: 'PLOMERO', color: '#3B82F6', icon: '🚽', sortOrder: 4 },
    { code: 'PLOM_CALEFON', name: 'Instalación calefón', description: 'Instalación y conexión de calefón eléctrico o gas', specialty: 'PLOMERO', color: '#3B82F6', icon: '🌡️', sortOrder: 5 },
    { code: 'PLOM_TERMOTANQUE', name: 'Instalación termotanque', description: 'Instalación de termotanque eléctrico o gas', specialty: 'PLOMERO', color: '#3B82F6', icon: '♨️', sortOrder: 6 },
    { code: 'PLOM_GRIFERIA', name: 'Cambio de grifería', description: 'Reemplazo de canillas, duchas, mezcladores', specialty: 'PLOMERO', color: '#3B82F6', icon: '🚰', sortOrder: 7 },

    // ─── ELECTRICIDAD ───────────────────────────────────────────────────────────
    { code: 'ELEC_TOMA', name: 'Instalación toma/enchufe', description: 'Instalación de tomacorriente nuevo o reemplazo', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '🔌', sortOrder: 10 },
    { code: 'ELEC_LLAVE', name: 'Instalación llave de luz', description: 'Colocación de interruptor, dimer o automático', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '💡', sortOrder: 11 },
    { code: 'ELEC_TABLERO', name: 'Instalación tablero', description: 'Montaje de tablero eléctrico con disyuntores', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '⚡', sortOrder: 12 },
    { code: 'ELEC_TENDIDO', name: 'Tendido de cables', description: 'Cableado nuevo o reemplazo (por metro)', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '🔋', sortOrder: 13 },
    { code: 'ELEC_LUMINARIA', name: 'Instalación luminaria', description: 'Colocación de luces, apliques, plafones', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '✨', sortOrder: 14 },
    { code: 'ELEC_PUESTA_TIERRA', name: 'Puesta a tierra', description: 'Instalación de jabalina y conexión a tierra', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '🌍', sortOrder: 15 },
    { code: 'ELEC_REVISION', name: 'Revisión instalación', description: 'Diagnóstico completo de la instalación eléctrica', specialty: 'ELECTRICISTA', color: '#F59E0B', icon: '📋', sortOrder: 16 },

    // ─── GAS ────────────────────────────────────────────────────────────────────
    { code: 'GAS_PERDIDA', name: 'Detección pérdida gas', description: 'Búsqueda y reparación de pérdidas de gas', specialty: 'GASISTA', color: '#EF4444', icon: '🔥', sortOrder: 20 },
    { code: 'GAS_CALEFACTOR', name: 'Instalación calefactor', description: 'Colocación de calefactor a gas con tiraje', specialty: 'GASISTA', color: '#EF4444', icon: '🌡️', sortOrder: 21 },
    { code: 'GAS_COCINA', name: 'Conexión cocina/anafe', description: 'Instalación de artefacto de cocina a gas', specialty: 'GASISTA', color: '#EF4444', icon: '🍳', sortOrder: 22 },
    { code: 'GAS_MEDIDOR', name: 'Instalación medidor', description: 'Colocación de medidor y gabinete reglamentario', specialty: 'GASISTA', color: '#EF4444', icon: '📊', sortOrder: 23 },
    { code: 'GAS_CANERIA', name: 'Tendido cañería gas', description: 'Instalación de cañería de gas (por metro)', specialty: 'GASISTA', color: '#EF4444', icon: '🔧', sortOrder: 24 },
    { code: 'GAS_REVISION', name: 'Revisión periódica', description: 'Control reglamentario de instalación de gas', specialty: 'GASISTA', color: '#EF4444', icon: '✅', sortOrder: 25 },
    { code: 'GAS_OBLEA', name: 'Trámite oblea', description: 'Gestión de oblea ante ente regulador (Gasnor/Enargas)', specialty: 'GASISTA', color: '#EF4444', icon: '📝', sortOrder: 26 },

    // ─── REFRIGERACIÓN ──────────────────────────────────────────────────────────
    { code: 'REF_SPLIT_INST', name: 'Instalación split', description: 'Instalación completa de aire acondicionado split', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '❄️', sortOrder: 30 },
    { code: 'REF_SPLIT_MANT', name: 'Mantenimiento split', description: 'Limpieza y service de aire acondicionado', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '🧹', sortOrder: 31 },
    { code: 'REF_SPLIT_REP', name: 'Reparación split', description: 'Diagnóstico y reparación de aire acondicionado', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '🔧', sortOrder: 32 },
    { code: 'REF_CARGA_GAS', name: 'Carga de gas', description: 'Recarga de refrigerante R410A, R22 o ecológico', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '💨', sortOrder: 33 },
    { code: 'REF_VENTANA', name: 'Instalación A/C ventana', description: 'Instalación de aire acondicionado de ventana', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '🪟', sortOrder: 34 },
    { code: 'REF_HELADERA', name: 'Reparación heladera', description: 'Servicio técnico de heladeras y freezers', specialty: 'REFRIGERACION', color: '#06B6D4', icon: '🧊', sortOrder: 35 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ITEMS (SERVICES)
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceData {
    name: string;
    description: string;
    specialty: Specialty;
    pricingModel: PricingModel;
    price: number;
    unit: string;
    taxRate?: number;
}

const SERVICES: ServiceData[] = [
    // ─── PLOMERÍA SERVICES ──────────────────────────────────────────────────────
    { name: 'Destape simple', description: 'Destape de cañería sin rotura', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 15000, unit: 'servicio' },
    { name: 'Destape con máquina', description: 'Destape profesional con equipo motorizado', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 35000, unit: 'servicio' },
    { name: 'Destape cámara séptica', description: 'Limpieza de cámara con camión atmosférico', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 55000, unit: 'servicio' },
    { name: 'Mano de obra plomería', description: 'Hora de trabajo de plomero', specialty: 'PLOMERO', pricingModel: 'HOURLY', price: 8500, unit: 'hora' },
    { name: 'Instalación cañería PVC', description: 'Por metro lineal con materiales básicos', specialty: 'PLOMERO', pricingModel: 'PER_UNIT', price: 12000, unit: 'metro' },
    { name: 'Instalación cañería PPR', description: 'Termofusión por metro con materiales', specialty: 'PLOMERO', pricingModel: 'PER_UNIT', price: 18000, unit: 'metro' },
    { name: 'Colocación inodoro', description: 'Instalación de inodoro (sin incluir artefacto)', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 22000, unit: 'unidad' },
    { name: 'Colocación bidet', description: 'Instalación de bidet (sin incluir artefacto)', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 18000, unit: 'unidad' },
    { name: 'Colocación lavatorio', description: 'Instalación de lavamanos con grifería', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 16000, unit: 'unidad' },
    { name: 'Cambio grifería simple', description: 'Reemplazo de canilla o grifería monocomando', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 8000, unit: 'unidad' },
    { name: 'Instalación calefón', description: 'Colocación de calefón con conexiones', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 25000, unit: 'unidad' },
    { name: 'Instalación termotanque', description: 'Colocación de termotanque eléctrico o gas', specialty: 'PLOMERO', pricingModel: 'FIXED', price: 28000, unit: 'unidad' },

    // ─── ELECTRICIDAD SERVICES ──────────────────────────────────────────────────
    { name: 'Mano de obra electricista', description: 'Hora de trabajo de electricista matriculado', specialty: 'ELECTRICISTA', pricingModel: 'HOURLY', price: 9500, unit: 'hora' },
    { name: 'Instalación toma simple', description: 'Nuevo tomacorriente con cableado corto', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 8500, unit: 'punto' },
    { name: 'Instalación toma doble', description: 'Tomacorriente doble con cableado', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 12000, unit: 'punto' },
    { name: 'Instalación llave simple', description: 'Interruptor de un punto', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 7500, unit: 'punto' },
    { name: 'Instalación llave combinada', description: 'Interruptor combinado o punto cruz', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 14000, unit: 'punto' },
    { name: 'Tendido cable', description: 'Cableado nuevo por metro lineal', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 5500, unit: 'metro' },
    { name: 'Tablero monofásico', description: 'Armado tablero hasta 6 bocas', specialty: 'ELECTRICISTA', pricingModel: 'FIXED', price: 45000, unit: 'tablero' },
    { name: 'Tablero trifásico', description: 'Armado tablero industrial', specialty: 'ELECTRICISTA', pricingModel: 'FIXED', price: 85000, unit: 'tablero' },
    { name: 'Puesta a tierra', description: 'Instalación jabalina y medición', specialty: 'ELECTRICISTA', pricingModel: 'FIXED', price: 35000, unit: 'servicio' },
    { name: 'Colocación luminaria', description: 'Instalación de luz, plafón o aplique', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 6500, unit: 'unidad' },
    { name: 'Instalación ventilador techo', description: 'Colocación de ventilador con luz', specialty: 'ELECTRICISTA', pricingModel: 'PER_UNIT', price: 18000, unit: 'unidad' },
    { name: 'Revisión instalación', description: 'Diagnóstico completo con informe', specialty: 'ELECTRICISTA', pricingModel: 'FIXED', price: 28000, unit: 'visita' },

    // ─── GAS SERVICES ───────────────────────────────────────────────────────────
    { name: 'Mano de obra gasista', description: 'Hora de trabajo de gasista matriculado', specialty: 'GASISTA', pricingModel: 'HOURLY', price: 11000, unit: 'hora' },
    { name: 'Revisión pérdida gas', description: 'Detección con equipo electrónico', specialty: 'GASISTA', pricingModel: 'FIXED', price: 18000, unit: 'visita' },
    { name: 'Reparación pérdida gas', description: 'Sellado o cambio de conexión', specialty: 'GASISTA', pricingModel: 'FIXED', price: 25000, unit: 'servicio' },
    { name: 'Instalación calefactor TBU', description: 'Calefactor tiro balanceado universal con cañería', specialty: 'GASISTA', pricingModel: 'FIXED', price: 45000, unit: 'unidad' },
    { name: 'Instalación calefactor TN', description: 'Calefactor tiro natural con salida', specialty: 'GASISTA', pricingModel: 'FIXED', price: 35000, unit: 'unidad' },
    { name: 'Conexión cocina/anafe', description: 'Instalación de artefacto de cocina', specialty: 'GASISTA', pricingModel: 'FIXED', price: 15000, unit: 'unidad' },
    { name: 'Tendido cañería gas', description: 'Cañería de gas por metro con materiales', specialty: 'GASISTA', pricingModel: 'PER_UNIT', price: 22000, unit: 'metro' },
    { name: 'Gabinete medidor', description: 'Colocación de gabinete reglamentario', specialty: 'GASISTA', pricingModel: 'FIXED', price: 55000, unit: 'unidad' },
    { name: 'Oblea gas', description: 'Gestión oblea Gasnor/Enargas con revisión completa', specialty: 'GASISTA', pricingModel: 'FIXED', price: 85000, unit: 'trámite' },
    { name: 'Conversión gas natural', description: 'Cambio de artefactos de garrafa a gas natural', specialty: 'GASISTA', pricingModel: 'PER_UNIT', price: 15000, unit: 'artefacto' },

    // ─── REFRIGERACIÓN SERVICES ─────────────────────────────────────────────────
    { name: 'Mano de obra refrigeración', description: 'Hora de trabajo de técnico en refrigeración', specialty: 'REFRIGERACION', pricingModel: 'HOURLY', price: 10500, unit: 'hora' },
    { name: 'Instalación split hasta 3000 fg', description: 'Split hasta 3000 frigorías incluye materiales 3m', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 55000, unit: 'unidad' },
    { name: 'Instalación split 3000-4500 fg', description: 'Split mediano incluye materiales 3m', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 65000, unit: 'unidad' },
    { name: 'Instalación split 4500+ fg', description: 'Split grande incluye materiales 3m', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 75000, unit: 'unidad' },
    { name: 'Metro extra cañería cobre', description: 'Caño de cobre adicional con aislación', specialty: 'REFRIGERACION', pricingModel: 'PER_UNIT', price: 18000, unit: 'metro' },
    { name: 'Service split completo', description: 'Limpieza evaporador, condensador y filtros', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 25000, unit: 'equipo' },
    { name: 'Carga gas R410A', description: 'Recarga refrigerante ecológico R410A', specialty: 'REFRIGERACION', pricingModel: 'PER_UNIT', price: 35000, unit: 'carga' },
    { name: 'Carga gas R22', description: 'Recarga refrigerante R22 (equipos antiguos)', specialty: 'REFRIGERACION', pricingModel: 'PER_UNIT', price: 28000, unit: 'carga' },
    { name: 'Desinstalación split', description: 'Retiro de equipo con recuperación de gas', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 25000, unit: 'equipo' },
    { name: 'Reparación heladera', description: 'Diagnóstico y reparación (sin repuestos)', specialty: 'REFRIGERACION', pricingModel: 'FIXED', price: 35000, unit: 'equipo' },
    { name: 'Cambio motor heladera', description: 'Cambio de compresor incluye mano de obra', specialty: 'REFRIGERACION', pricingModel: 'QUOTE', price: 0, unit: 'presupuesto' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductData {
    name: string;
    description: string;
    specialty: Specialty;
    price: number;
    unit: string;
    taxRate?: number;
}

const PRODUCTS: ProductData[] = [
    // ─── PLOMERÍA PRODUCTS ──────────────────────────────────────────────────────
    { name: 'Caño PVC 110mm', description: 'Caño cloacal PVC 110mm x 4m', specialty: 'PLOMERO', price: 8500, unit: 'unidad' },
    { name: 'Caño PVC 63mm', description: 'Caño PVC 63mm x 4m', specialty: 'PLOMERO', price: 5500, unit: 'unidad' },
    { name: 'Caño PPR 25mm', description: 'Caño termofusión 25mm x 4m', specialty: 'PLOMERO', price: 7200, unit: 'unidad' },
    { name: 'Caño PPR 20mm', description: 'Caño termofusión 20mm x 4m', specialty: 'PLOMERO', price: 5800, unit: 'unidad' },
    { name: 'Válvula esférica 1/2', description: 'Válvula esférica bronce 1/2"', specialty: 'PLOMERO', price: 4500, unit: 'unidad' },
    { name: 'Sifón PVC cromado', description: 'Sifón PVC con tapa cromada', specialty: 'PLOMERO', price: 2800, unit: 'unidad' },
    { name: 'Flexibles conexión', description: 'Par de flexibles acero inoxidable 40cm', specialty: 'PLOMERO', price: 4200, unit: 'par' },
    { name: 'Cinta teflón', description: 'Cinta teflón 3/4" x 20m', specialty: 'PLOMERO', price: 450, unit: 'unidad' },
    { name: 'Sellador rosca', description: 'Hilo sellador rosca Ceramtec', specialty: 'PLOMERO', price: 1200, unit: 'unidad' },
    { name: 'Canilla giro', description: 'Canilla de paso 1/2" cromada', specialty: 'PLOMERO', price: 3500, unit: 'unidad' },

    // ─── ELECTRICIDAD PRODUCTS ──────────────────────────────────────────────────
    { name: 'Cable 2.5mm (100m)', description: 'Cable unipolar 2.5mm IRAM (rollos 100m)', specialty: 'ELECTRICISTA', price: 45000, unit: 'rollo' },
    { name: 'Cable 4mm (100m)', description: 'Cable unipolar 4mm IRAM (rollos 100m)', specialty: 'ELECTRICISTA', price: 68000, unit: 'rollo' },
    { name: 'Llave térmica 10A', description: 'Termomagnética bipolar 10A Siemens', specialty: 'ELECTRICISTA', price: 8500, unit: 'unidad' },
    { name: 'Llave térmica 16A', description: 'Termomagnética bipolar 16A Siemens', specialty: 'ELECTRICISTA', price: 9200, unit: 'unidad' },
    { name: 'Disyuntor diferencial', description: 'ID 2x25A 30mA Siemens', specialty: 'ELECTRICISTA', price: 28000, unit: 'unidad' },
    { name: 'Tablero empotrar 6', description: 'Tablero empotrar 6 bocas con puerta', specialty: 'ELECTRICISTA', price: 12000, unit: 'unidad' },
    { name: 'Tablero empotrar 12', description: 'Tablero empotrar 12 bocas con puerta', specialty: 'ELECTRICISTA', price: 18500, unit: 'unidad' },
    { name: 'Tomacorriente doble', description: 'Tomacorriente doble 10A línea Siglo XXI', specialty: 'ELECTRICISTA', price: 2800, unit: 'unidad' },
    { name: 'Interruptor simple', description: 'Interruptor 10A línea Siglo XXI', specialty: 'ELECTRICISTA', price: 2200, unit: 'unidad' },
    { name: 'Jabalina cobre 1.5m', description: 'Jabalina puesta a tierra cobre 3/8 x 1.5m', specialty: 'ELECTRICISTA', price: 8500, unit: 'unidad' },

    // ─── GAS PRODUCTS ───────────────────────────────────────────────────────────
    { name: 'Caño galvanizado 3/4', description: 'Caño galvanizado 3/4" x 6.4m gas', specialty: 'GASISTA', price: 25000, unit: 'barra' },
    { name: 'Caño galvanizado 1/2', description: 'Caño galvanizado 1/2" x 6.4m gas', specialty: 'GASISTA', price: 18000, unit: 'barra' },
    { name: 'Flexible gas 1/2', description: 'Flexible gas 1/2" x 40cm certificado', specialty: 'GASISTA', price: 6500, unit: 'unidad' },
    { name: 'Llave de paso gas', description: 'Llave de paso bronce 1/2" para gas', specialty: 'GASISTA', price: 5500, unit: 'unidad' },
    { name: 'Conector campana', description: 'Conector de campana para calefactor', specialty: 'GASISTA', price: 3800, unit: 'unidad' },
    { name: 'Caño ventilación 100mm', description: 'Caño de ventilación aluminio 100mm x 1m', specialty: 'GASISTA', price: 4500, unit: 'metro' },
    { name: 'Sombrerete ventilación', description: 'Sombrerete aluminio 100mm', specialty: 'GASISTA', price: 5500, unit: 'unidad' },
    { name: 'Sellador roscas gas', description: 'Sellador anaeróbico roscas gas 50ml', specialty: 'GASISTA', price: 4800, unit: 'unidad' },

    // ─── REFRIGERACIÓN PRODUCTS ─────────────────────────────────────────────────
    { name: 'Cañería cobre 1/4" (15m)', description: 'Rollo caño cobre 1/4" x 15m para A/C', specialty: 'REFRIGERACION', price: 85000, unit: 'rollo' },
    { name: 'Cañería cobre 3/8" (15m)', description: 'Rollo caño cobre 3/8" x 15m para A/C', specialty: 'REFRIGERACION', price: 110000, unit: 'rollo' },
    { name: 'Aislación térmica 1/4"', description: 'Aislación espuma 1/4" x 2m', specialty: 'REFRIGERACION', price: 2500, unit: 'unidad' },
    { name: 'Aislación térmica 3/8"', description: 'Aislación espuma 3/8" x 2m', specialty: 'REFRIGERACION', price: 3200, unit: 'unidad' },
    { name: 'Gas R410A (11.3kg)', description: 'Garrafa de refrigerante R410A 11.3kg', specialty: 'REFRIGERACION', price: 95000, unit: 'garrafa' },
    { name: 'Gas R22 (13.6kg)', description: 'Garrafa de refrigerante R22 13.6kg', specialty: 'REFRIGERACION', price: 68000, unit: 'garrafa' },
    { name: 'Soporte split exterior', description: 'Ménsula metálica para condensadora', specialty: 'REFRIGERACION', price: 12500, unit: 'par' },
    { name: 'Canaleta decorativa 2m', description: 'Canaleta plástica decorativa 2m', specialty: 'REFRIGERACION', price: 8500, unit: 'unidad' },
    { name: 'Cable control 5 hilos', description: 'Cable control split 5 hilos x 10m', specialty: 'REFRIGERACION', price: 5500, unit: 'rollo' },
    { name: 'Filtro aire split', description: 'Filtro de aire para evaporador', specialty: 'REFRIGERACION', price: 3500, unit: 'unidad' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function seedServicesAndProducts(organizationId: string) {
    console.log(`\n🔧 Starting services & products seed for organization: ${organizationId}\n`);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
        where: { id: organizationId }
    });

    if (!org) {
        throw new Error(`❌ Organization ${organizationId} not found`);
    }

    console.log(`✅ Found organization: ${org.name}\n`);

    // ─── SEED SERVICE TYPE CONFIGS ────────────────────────────────────────────────
    console.log('📝 Seeding ServiceTypeConfig entries...');

    let serviceTypesCreated = 0;
    let serviceTypesUpdated = 0;

    for (const st of SERVICE_TYPES) {
        const result = await prisma.serviceTypeConfig.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: st.code,
                },
            },
            update: {
                name: st.name,
                description: st.description,
                specialty: st.specialty,  // Link to trade
                color: st.color,
                icon: st.icon,
                sortOrder: st.sortOrder,
                isActive: true,
                updatedAt: new Date(),
            },
            create: {
                code: st.code,
                name: st.name,
                description: st.description,
                specialty: st.specialty,  // Link to trade
                color: st.color,
                icon: st.icon,
                sortOrder: st.sortOrder,
                isActive: true,
                organizationId,
            },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            serviceTypesCreated++;
        } else {
            serviceTypesUpdated++;
        }
    }

    console.log(`   - Created: ${serviceTypesCreated}`);
    console.log(`   - Updated: ${serviceTypesUpdated}\n`);

    // ─── SEED SERVICES ────────────────────────────────────────────────────────────
    console.log('💼 Seeding PriceItem (SERVICES)...');

    let servicesCreated = 0;
    let servicesUpdated = 0;

    for (const service of SERVICES) {
        // Use name + org + specialty as uniqueness identifier
        const existingService = await prisma.priceItem.findFirst({
            where: {
                organizationId,
                name: service.name,
                type: 'SERVICE',
                specialty: service.specialty,
            },
        });

        if (existingService) {
            await prisma.priceItem.update({
                where: { id: existingService.id },
                data: {
                    description: service.description,
                    price: service.price,
                    unit: service.unit,
                    pricingModel: service.pricingModel,
                    taxRate: service.taxRate ?? 21.0,
                    isActive: true,
                    updatedAt: new Date(),
                },
            });
            servicesUpdated++;
        } else {
            await prisma.priceItem.create({
                data: {
                    name: service.name,
                    description: service.description,
                    type: 'SERVICE',
                    specialty: service.specialty,
                    pricingModel: service.pricingModel,
                    price: service.price,
                    unit: service.unit,
                    taxRate: service.taxRate ?? 21.0,
                    isActive: true,
                    organizationId,
                },
            });
            servicesCreated++;
        }
    }

    console.log(`   - Created: ${servicesCreated}`);
    console.log(`   - Updated: ${servicesUpdated}\n`);

    // ─── SEED PRODUCTS ────────────────────────────────────────────────────────────
    console.log('📦 Seeding PriceItem (PRODUCTS)...');

    let productsCreated = 0;
    let productsUpdated = 0;

    for (const product of PRODUCTS) {
        const existingProduct = await prisma.priceItem.findFirst({
            where: {
                organizationId,
                name: product.name,
                type: 'PRODUCT',
                specialty: product.specialty,
            },
        });

        if (existingProduct) {
            await prisma.priceItem.update({
                where: { id: existingProduct.id },
                data: {
                    description: product.description,
                    price: product.price,
                    unit: product.unit,
                    taxRate: product.taxRate ?? 21.0,
                    isActive: true,
                    updatedAt: new Date(),
                },
            });
            productsUpdated++;
        } else {
            await prisma.priceItem.create({
                data: {
                    name: product.name,
                    description: product.description,
                    type: 'PRODUCT',
                    specialty: product.specialty,
                    pricingModel: 'FIXED', // Products always fixed price
                    price: product.price,
                    unit: product.unit,
                    taxRate: product.taxRate ?? 21.0,
                    isActive: true,
                    organizationId,
                },
            });
            productsCreated++;
        }
    }

    console.log(`   - Created: ${productsCreated}`);
    console.log(`   - Updated: ${productsUpdated}\n`);

    // ─── SUMMARY ────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ SEED COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    console.log('📊 Summary:');
    console.log(`   - Service Types: ${serviceTypesCreated + serviceTypesUpdated} (${serviceTypesCreated} new, ${serviceTypesUpdated} updated)`);
    console.log(`   - Services: ${servicesCreated + servicesUpdated} (${servicesCreated} new, ${servicesUpdated} updated)`);
    console.log(`   - Products: ${productsCreated + productsUpdated} (${productsCreated} new, ${productsUpdated} updated)`);

    console.log('\n📋 By Specialty:');
    for (const [specialty, config] of Object.entries(SPECIALTIES)) {
        const serviceCount = SERVICES.filter(s => s.specialty === specialty).length;
        const productCount = PRODUCTS.filter(p => p.specialty === specialty).length;
        console.log(`   ${config.icon} ${specialty}: ${serviceCount} services, ${productCount} products`);
    }

    // ─── IMPLEMENTATION STATUS ───────────────────────────────────────────────
    console.log('\n✅ SPECIALTY LINKING IMPLEMENTED:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('   ServiceTypeConfig now includes specialty field:');
    console.log('   - Each service type is linked to its trade (PLOMERO, ELECTRICISTA, etc.)');
    console.log('   - PriceItem.specialty already existed for pricebook items');
    console.log('   - User.specialties[] stores technician qualifications');
    console.log('');
    console.log('   Optional Enhancement (for convenience, not enforcement):');
    console.log('   - Dispatch recommendations can filter by matching specialty');
    console.log('   - UI can show trade icons/colors based on service type');
    console.log('───────────────────────────────────────────────────────────────────────────────\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    const orgId = process.argv[2];

    if (!orgId) {
        console.log('');
        console.log('Usage: npx tsx docs/testing-scripts/seed-services-and-products.ts <organization-id>');
        console.log('');
        console.log('Example:');
        console.log('  npx tsx docs/testing-scripts/seed-services-and-products.ts cm6gvnj5q0003vu3c9s1frlkj');
        console.log('');
        process.exit(1);
    }

    try {
        await seedServicesAndProducts(orgId);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
