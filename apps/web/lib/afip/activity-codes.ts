/**
 * AFIP Activity Codes Mapping
 * ===========================
 *
 * Maps AFIP economic activity codes (CLAE - Clasificador de Actividades Económicas)
 * to CampoTech service types.
 *
 * CLAE codes are based on CIIU Rev.4 (International Standard Industrial Classification)
 * and adapted for Argentina by AFIP.
 *
 * Reference: https://serviciosweb.afip.gob.ar/genericos/nomencladorActividades/
 */

import type { ActivityCode, MappedServiceType } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CampoTech service categories
 */
export type ServiceCategory =
  | 'hvac' // Heating, Ventilation, Air Conditioning
  | 'plumbing' // Plumbing, gas, sanitary
  | 'electrical' // Electrical installations
  | 'construction' // General construction
  | 'maintenance' // General maintenance services
  | 'refrigeration' // Commercial refrigeration
  | 'other';

/**
 * CampoTech service types from the system
 * These match the ServiceType enum in the database
 */
export const CAMPOTECH_SERVICE_TYPES = [
  'INSTALACION_SPLIT',
  'REPARACION_SPLIT',
  'MANTENIMIENTO_SPLIT',
  'INSTALACION_CALEFACTOR',
  'REPARACION_CALEFACTOR',
  'MANTENIMIENTO_CALEFACTOR',
  'OTRO',
] as const;

export type CampoTechServiceType = (typeof CAMPOTECH_SERVICE_TYPES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP ACTIVITY CODE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AFIP activity code to service category mapping
 *
 * Codes from Division 43: Construcción especializada
 * https://serviciosweb.afip.gob.ar/genericos/nomencladorActividades/
 */
export const AFIP_ACTIVITY_MAPPINGS: Record<
  string,
  {
    description: string;
    category: ServiceCategory;
    serviceTypes: CampoTechServiceType[];
    confidence: 'high' | 'medium' | 'low';
  }
> = {
  // ───────────────────────────────────────────────────────────────────────────────
  // HVAC - Aire Acondicionado y Climatización (Primary for CampoTech)
  // ───────────────────────────────────────────────────────────────────────────────

  '432901': {
    description: 'Instalación de sistemas de aire acondicionado',
    category: 'hvac',
    serviceTypes: ['INSTALACION_SPLIT', 'MANTENIMIENTO_SPLIT', 'REPARACION_SPLIT'],
    confidence: 'high',
  },
  '432902': {
    description: 'Instalación de sistemas de calefacción',
    category: 'hvac',
    serviceTypes: [
      'INSTALACION_CALEFACTOR',
      'MANTENIMIENTO_CALEFACTOR',
      'REPARACION_CALEFACTOR',
    ],
    confidence: 'high',
  },
  '432909': {
    description: 'Instalación de otros sistemas de refrigeración y climatización',
    category: 'hvac',
    serviceTypes: [
      'INSTALACION_SPLIT',
      'REPARACION_SPLIT',
      'MANTENIMIENTO_SPLIT',
      'INSTALACION_CALEFACTOR',
      'REPARACION_CALEFACTOR',
      'MANTENIMIENTO_CALEFACTOR',
    ],
    confidence: 'high',
  },

  // Refrigeración comercial e industrial
  '331201': {
    description: 'Reparación de maquinaria agropecuaria y forestal',
    category: 'maintenance',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '331211': {
    description:
      'Reparación y mantenimiento de maquinaria de uso general (incluye refrigeración)',
    category: 'refrigeration',
    serviceTypes: ['REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT'],
    confidence: 'medium',
  },
  '331212': {
    description: 'Reparación y mantenimiento de equipos de refrigeración',
    category: 'refrigeration',
    serviceTypes: ['REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT'],
    confidence: 'high',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // INSTALACIONES SANITARIAS Y DE GAS (Plumbing)
  // ───────────────────────────────────────────────────────────────────────────────

  '432110': {
    description: 'Instalaciones de gas',
    category: 'plumbing',
    serviceTypes: ['INSTALACION_CALEFACTOR', 'REPARACION_CALEFACTOR'],
    confidence: 'medium',
  },
  '432120': {
    description: 'Instalaciones sanitarias y de plomería',
    category: 'plumbing',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '432190': {
    description: 'Instalaciones sanitarias y de gas n.c.p.',
    category: 'plumbing',
    serviceTypes: ['INSTALACION_CALEFACTOR', 'OTRO'],
    confidence: 'medium',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // INSTALACIONES ELÉCTRICAS (Electrical)
  // ───────────────────────────────────────────────────────────────────────────────

  '432200': {
    description: 'Instalaciones eléctricas',
    category: 'electrical',
    serviceTypes: ['INSTALACION_SPLIT', 'OTRO'],
    confidence: 'medium',
  },
  '432210': {
    description: 'Instalación de sistemas eléctricos para edificios',
    category: 'electrical',
    serviceTypes: ['INSTALACION_SPLIT', 'OTRO'],
    confidence: 'medium',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // CONSTRUCCIÓN GENERAL
  // ───────────────────────────────────────────────────────────────────────────────

  '410011': {
    description: 'Construcción de edificios residenciales',
    category: 'construction',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '410021': {
    description: 'Construcción de edificios no residenciales',
    category: 'construction',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '433000': {
    description: 'Terminación de edificios',
    category: 'construction',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '439100': {
    description: 'Otras actividades especializadas de construcción n.c.p.',
    category: 'construction',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // REPARACIÓN Y MANTENIMIENTO
  // ───────────────────────────────────────────────────────────────────────────────

  '952100': {
    description: 'Reparación de aparatos electrónicos de consumo',
    category: 'maintenance',
    serviceTypes: ['REPARACION_SPLIT', 'OTRO'],
    confidence: 'low',
  },
  '952200': {
    description:
      'Reparación de aparatos de uso doméstico y equipos hogareños (incluye AA)',
    category: 'hvac',
    serviceTypes: ['REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT'],
    confidence: 'high',
  },
  '952210': {
    description: 'Reparación de equipos de aire acondicionado domésticos',
    category: 'hvac',
    serviceTypes: ['REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT'],
    confidence: 'high',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // COMERCIO DE EQUIPOS
  // ───────────────────────────────────────────────────────────────────────────────

  '465490': {
    description: 'Venta al por mayor de máquinas, equipos y materiales conexos',
    category: 'hvac',
    serviceTypes: ['INSTALACION_SPLIT', 'INSTALACION_CALEFACTOR'],
    confidence: 'low',
  },
  '475400': {
    description: 'Venta al por menor de artefactos eléctricos y de gas',
    category: 'hvac',
    serviceTypes: ['INSTALACION_SPLIT', 'INSTALACION_CALEFACTOR'],
    confidence: 'low',
  },
  '475410': {
    description: 'Venta al por menor de equipos de aire acondicionado',
    category: 'hvac',
    serviceTypes: ['INSTALACION_SPLIT'],
    confidence: 'medium',
  },

  // ───────────────────────────────────────────────────────────────────────────────
  // SERVICIOS TÉCNICOS
  // ───────────────────────────────────────────────────────────────────────────────

  '711001': {
    description: 'Servicios de arquitectura e ingeniería',
    category: 'construction',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '711002': {
    description: 'Servicios de ingeniería',
    category: 'hvac',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '749009': {
    description: 'Actividades profesionales, científicas y técnicas n.c.p.',
    category: 'maintenance',
    serviceTypes: ['OTRO'],
    confidence: 'low',
  },
  '812090': {
    description: 'Limpieza de edificios y mantenimiento',
    category: 'maintenance',
    serviceTypes: ['MANTENIMIENTO_SPLIT', 'MANTENIMIENTO_CALEFACTOR'],
    confidence: 'low',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get mapping for a specific AFIP activity code
 */
export function getActivityMapping(code: string): MappedServiceType | null {
  const mapping = AFIP_ACTIVITY_MAPPINGS[code];
  if (!mapping) return null;

  return {
    afipCode: code,
    afipDescription: mapping.description,
    serviceCategory: mapping.category,
    serviceTypes: mapping.serviceTypes,
    confidence: mapping.confidence,
  };
}

/**
 * Map multiple AFIP activity codes to CampoTech service types
 */
export function matchActivityToServices(codes: ActivityCode[]): MappedServiceType[] {
  const mappedServices: MappedServiceType[] = [];
  const seenCodes = new Set<string>();

  for (const activity of codes) {
    const code = activity.code.replace(/\D/g, ''); // Remove non-digits
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    const mapping = getActivityMapping(code);
    if (mapping) {
      mappedServices.push({
        ...mapping,
        afipDescription: activity.description || mapping.afipDescription,
      });
    }
  }

  // Sort by confidence (high first)
  return mappedServices.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
}

/**
 * Check if activity codes match HVAC-related services
 * Returns true if at least one high-confidence HVAC activity is found
 */
export function hasHVACActivity(codes: ActivityCode[]): boolean {
  const mappedServices = matchActivityToServices(codes);
  return mappedServices.some(
    (s) => s.serviceCategory === 'hvac' && s.confidence === 'high'
  );
}

/**
 * Get all unique service types from activity codes
 */
export function getServiceTypesFromActivities(codes: ActivityCode[]): CampoTechServiceType[] {
  const mappedServices = matchActivityToServices(codes);
  const serviceTypes = new Set<CampoTechServiceType>();

  for (const service of mappedServices) {
    for (const type of service.serviceTypes) {
      serviceTypes.add(type as CampoTechServiceType);
    }
  }

  return Array.from(serviceTypes);
}

/**
 * Calculate activity code match score for verification
 * Returns a score from 0-100 based on how well activities match HVAC services
 */
export function calculateActivityMatchScore(codes: ActivityCode[]): {
  score: number;
  recommendation: 'approved' | 'review' | 'rejected';
  reason: string;
} {
  if (codes.length === 0) {
    return {
      score: 0,
      recommendation: 'review',
      reason: 'No se encontraron actividades registradas en AFIP',
    };
  }

  const mappedServices = matchActivityToServices(codes);

  if (mappedServices.length === 0) {
    return {
      score: 10,
      recommendation: 'review',
      reason: 'Las actividades registradas no coinciden con servicios de climatización',
    };
  }

  // Count by confidence level
  const highConfidence = mappedServices.filter((s) => s.confidence === 'high').length;
  const mediumConfidence = mappedServices.filter((s) => s.confidence === 'medium').length;

  // Calculate score
  let score = 0;
  score += highConfidence * 40; // Max 40 per high confidence match
  score += mediumConfidence * 20; // Max 20 per medium confidence match

  // Cap at 100
  score = Math.min(100, score);

  // Check for HVAC specifically
  const hasHVAC = mappedServices.some((s) => s.serviceCategory === 'hvac');

  if (score >= 70 && hasHVAC) {
    return {
      score,
      recommendation: 'approved',
      reason: 'Actividades relacionadas con climatización verificadas',
    };
  } else if (score >= 40 || hasHVAC) {
    return {
      score,
      recommendation: 'review',
      reason: 'Actividades parcialmente relacionadas - requiere revisión manual',
    };
  } else {
    return {
      score,
      recommendation: 'rejected',
      reason: 'Las actividades registradas no corresponden a servicios de climatización',
    };
  }
}

/**
 * Get human-readable service category name in Spanish
 */
export function getServiceCategoryName(category: ServiceCategory): string {
  const names: Record<ServiceCategory, string> = {
    hvac: 'Climatización y Aire Acondicionado',
    plumbing: 'Instalaciones Sanitarias y de Gas',
    electrical: 'Instalaciones Eléctricas',
    construction: 'Construcción',
    maintenance: 'Mantenimiento General',
    refrigeration: 'Refrigeración Comercial',
    other: 'Otros',
  };
  return names[category] || 'Otros';
}

/**
 * Format activity code for display
 */
export function formatActivityCode(code: string): string {
  // Format as XXX.XXX if 6 digits
  if (code.length === 6) {
    return `${code.slice(0, 3)}.${code.slice(3)}`;
  }
  return code;
}
