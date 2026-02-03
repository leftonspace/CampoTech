/**
 * Job Templates & Service Types
 * ==============================
 * 
 * Service types, pricing, and job generation logic.
 */

/**
 * Valid ServiceType enum values from Prisma schema
 */
export type ServiceTypeEnum =
    | 'INSTALACION_SPLIT'
    | 'REPARACION_SPLIT'
    | 'MANTENIMIENTO_SPLIT'
    | 'INSTALACION_CALEFACTOR'
    | 'REPARACION_CALEFACTOR'
    | 'MANTENIMIENTO_CALEFACTOR'
    | 'OTRO';

/**
 * Valid JobStatus enum values from Prisma schema
 */
export type JobStatusEnum =
    | 'PENDING'
    | 'ASSIGNED'
    | 'EN_ROUTE'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED';

export interface ServiceType {
    code: string;
    name: string;
    enumValue: ServiceTypeEnum;  // The actual Prisma enum value
    tradeCategory: 'REFRIGERACION' | 'ELECTRICISTA' | 'PLOMERO' | 'GASISTA' | 'MULTI';
    basePrice: number;
    estimatedHours: number;
    description: string;
}

/**
 * Service types with realistic Argentine pricing (in ARS)
 */
export const SERVICE_TYPES: ServiceType[] = [
    // ═══════════════════════════════════════════════════════════════════════════════
    // REFRIGERACION (maps to HVAC enum values)
    // ═══════════════════════════════════════════════════════════════════════════════
    { code: 'HVAC-INST-SPLIT', name: 'Instalación de Split', enumValue: 'INSTALACION_SPLIT', tradeCategory: 'REFRIGERACION', basePrice: 45000, estimatedHours: 4, description: 'Instalación completa de aire acondicionado split' },
    { code: 'HVAC-REP-SPLIT', name: 'Reparación de Split', enumValue: 'REPARACION_SPLIT', tradeCategory: 'REFRIGERACION', basePrice: 25000, estimatedHours: 2, description: 'Diagnóstico y reparación de aire acondicionado' },
    { code: 'HVAC-MANT-SPLIT', name: 'Mantenimiento Split', enumValue: 'MANTENIMIENTO_SPLIT', tradeCategory: 'REFRIGERACION', basePrice: 15000, estimatedHours: 1.5, description: 'Limpieza y mantenimiento preventivo' },

    // Calefactor services
    { code: 'HVAC-INST-CALEF', name: 'Instalación Calefactor', enumValue: 'INSTALACION_CALEFACTOR', tradeCategory: 'GASISTA', basePrice: 35000, estimatedHours: 3, description: 'Instalación de calefactor/estufa' },
    { code: 'HVAC-REP-CALEF', name: 'Reparación Calefactor', enumValue: 'REPARACION_CALEFACTOR', tradeCategory: 'GASISTA', basePrice: 20000, estimatedHours: 2, description: 'Reparación de calefactor/estufa' },
    { code: 'HVAC-MANT-CALEF', name: 'Mantenimiento Calefactor', enumValue: 'MANTENIMIENTO_CALEFACTOR', tradeCategory: 'GASISTA', basePrice: 12000, estimatedHours: 1, description: 'Mantenimiento de calefactor' },

    // ═══════════════════════════════════════════════════════════════════════════════
    // OTHER SERVICES (OTRO enum + serviceTypeCode)
    // ═══════════════════════════════════════════════════════════════════════════════
    { code: 'ELEC-INST-TABLERO', name: 'Instalación Tablero Eléctrico', enumValue: 'OTRO', tradeCategory: 'ELECTRICISTA', basePrice: 35000, estimatedHours: 4, description: 'Instalación o cambio de tablero eléctrico' },
    { code: 'ELEC-REP-CORTO', name: 'Reparación Cortocircuito', enumValue: 'OTRO', tradeCategory: 'ELECTRICISTA', basePrice: 18000, estimatedHours: 2, description: 'Identificación y reparación de cortocircuito' },
    { code: 'ELEC-INST-TOMA', name: 'Instalación Tomas/Interruptores', enumValue: 'OTRO', tradeCategory: 'ELECTRICISTA', basePrice: 8000, estimatedHours: 1, description: 'Instalación de tomas e interruptores' },
    { code: 'PLOM-DESTAPE', name: 'Destape de Cañerías', enumValue: 'OTRO', tradeCategory: 'PLOMERO', basePrice: 15000, estimatedHours: 2, description: 'Destape de cañerías obstruidas' },
    { code: 'PLOM-REP-PERDIDA', name: 'Reparación Pérdida de Agua', enumValue: 'OTRO', tradeCategory: 'PLOMERO', basePrice: 12000, estimatedHours: 1.5, description: 'Reparación de pérdidas' },
    { code: 'PLOM-INST-TERMO', name: 'Instalación Termotanque', enumValue: 'OTRO', tradeCategory: 'PLOMERO', basePrice: 20000, estimatedHours: 3, description: 'Instalación de termotanque eléctrico o gas' },
    { code: 'GAS-INST-CALEFON', name: 'Instalación Calefón', enumValue: 'OTRO', tradeCategory: 'GASISTA', basePrice: 25000, estimatedHours: 3, description: 'Instalación de calefón a gas' },
    { code: 'GAS-REP-CALEFON', name: 'Reparación Calefón', enumValue: 'OTRO', tradeCategory: 'GASISTA', basePrice: 18000, estimatedHours: 2, description: 'Reparación de calefón' },
    { code: 'GAS-PERDIDA', name: 'Detección Pérdida de Gas', enumValue: 'OTRO', tradeCategory: 'GASISTA', basePrice: 12000, estimatedHours: 1, description: 'Detección y reparación pérdida de gas' },
];

/**
 * Job status distribution for realistic simulation
 */
export const JOB_STATUS_DISTRIBUTION: Record<JobStatusEnum, number> = {
    COMPLETED: 0.60,    // 60% historical completed
    IN_PROGRESS: 0.15,  // 15% currently in progress
    ASSIGNED: 0.10,     // 10% assigned but not started
    EN_ROUTE: 0.05,     // 5% on the way
    PENDING: 0.08,      // 8% pending assignment
    CANCELLED: 0.02,    // 2% cancelled
};

/**
 * Helper to get random service for a technician based on their specialties
 */
export function getRandomServiceForTechnician(techSpecialties: string[]): ServiceType {
    // Filter services that match technician's specialties
    const matchingServices = SERVICE_TYPES.filter(s =>
        techSpecialties.includes(s.tradeCategory) || s.tradeCategory === 'MULTI'
    );

    if (matchingServices.length === 0) {
        return SERVICE_TYPES[0]; // Fallback
    }

    return matchingServices[Math.floor(Math.random() * matchingServices.length)];
}

/**
 * Apply price variation (+/- 20%)
 */
export function applyPriceVariation(basePrice: number): number {
    const variation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    return Math.round(basePrice * variation / 100) * 100; // Round to nearest 100
}
