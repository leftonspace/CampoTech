/**
 * Discovery Types
 * ===============
 *
 * Type definitions for business discovery and search.
 * Phase 15: Consumer Marketplace
 */

import {
  BusinessPublicProfile,
  ServiceCategory,
  BusinessBadge,
  BusinessRankingFactors,
} from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BusinessSearchParams {
  query?: string;
  category?: ServiceCategory;
  categories?: ServiceCategory[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  city?: string;
  neighborhood?: string;
  minRating?: number;
  maxResponseTimeHours?: number;
  hasEmergency?: boolean;
  badges?: BusinessBadge[];
  verified?: boolean;
  acceptingNewClients?: boolean;
  sortBy?: 'rating' | 'distance' | 'response_time' | 'reviews' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface BusinessSearchResult {
  business: BusinessPublicProfile;
  distance?: number;  // in km
  matchScore: number;
  relevanceScore: number;
  highlights?: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  snippet: string;
}

export interface SearchFilters {
  categories: { category: ServiceCategory; count: number }[];
  badges: { badge: BusinessBadge; count: number }[];
  ratingRanges: { min: number; max: number; count: number }[];
  neighborhoods: { name: string; count: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEO SEARCH TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeoSearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: ServiceCategory;
  limit?: number;
}

export interface GeoSearchResult {
  businessId: string;
  distance: number;
  lat: number;
  lng: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RANKING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RankingWeights {
  rating: number;        // Weight for rating factors (0-1)
  activity: number;      // Weight for activity factors (0-1)
  quality: number;       // Weight for quality factors (0-1)
  relevance: number;     // Weight for relevance factors (0-1)
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  rating: 0.40,
  activity: 0.25,
  quality: 0.20,
  relevance: 0.15,
};

export interface RankedBusiness {
  business: BusinessPublicProfile;
  score: number;
  factors: BusinessRankingFactors;
  breakdown: {
    ratingScore: number;
    activityScore: number;
    qualityScore: number;
    relevanceScore: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MatchingCriteria {
  serviceCategory: ServiceCategory;
  location: {
    lat: number;
    lng: number;
    city?: string;
    neighborhood?: string;
  };
  urgency?: string;
  budgetRange?: string;
  maxBusinesses?: number;
}

export interface MatchedBusiness {
  businessId: string;
  orgId: string;
  displayName: string;
  overallRating: number;
  ratingCount: number;
  distance?: number;
  matchScore: number;
  responseTimeHours?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface CategoryMetadata {
  category: ServiceCategory;
  displayName: string;
  displayNameEs: string;
  icon: string;
  description: string;
  popularServices: string[];
}

export const CATEGORY_METADATA: CategoryMetadata[] = [
  {
    category: ServiceCategory.PLUMBING,
    displayName: 'Plumbing',
    displayNameEs: 'Plomería',
    icon: '🔧',
    description: 'Repairs, installations, and maintenance',
    popularServices: ['Destape de cañerías', 'Reparación de pérdidas', 'Instalación de griferías'],
  },
  {
    category: ServiceCategory.ELECTRICAL,
    displayName: 'Electrical',
    displayNameEs: 'Electricidad',
    icon: '⚡',
    description: 'Wiring, installations, and repairs',
    popularServices: ['Instalación eléctrica', 'Reparación de cortocircuitos', 'Instalación de luces'],
  },
  {
    category: ServiceCategory.HVAC,
    displayName: 'HVAC',
    displayNameEs: 'Aire Acondicionado',
    icon: '❄️',
    description: 'Air conditioning and heating',
    popularServices: ['Instalación de split', 'Carga de gas', 'Limpieza de equipos'],
  },
  {
    category: ServiceCategory.GAS,
    displayName: 'Gas',
    displayNameEs: 'Gas',
    icon: '🔥',
    description: 'Gas installations and repairs',
    popularServices: ['Instalación de calefón', 'Revisión de instalaciones', 'Habilitación de gas'],
  },
  {
    category: ServiceCategory.LOCKSMITH,
    displayName: 'Locksmith',
    displayNameEs: 'Cerrajería',
    icon: '🔒',
    description: 'Lock services and security',
    popularServices: ['Apertura de puertas', 'Cambio de cerraduras', 'Copias de llaves'],
  },
  {
    category: ServiceCategory.PAINTING,
    displayName: 'Painting',
    displayNameEs: 'Pintura',
    icon: '🎨',
    description: 'Interior and exterior painting',
    popularServices: ['Pintura de interiores', 'Pintura de exteriores', 'Empapelado'],
  },
  {
    category: ServiceCategory.CONSTRUCTION,
    displayName: 'Construction',
    displayNameEs: 'Construcción',
    icon: '🔨',
    description: 'Building and remodeling',
    popularServices: ['Remodelaciones', 'Ampliaciones', 'Albañilería'],
  },
  {
    category: ServiceCategory.CLEANING,
    displayName: 'Cleaning',
    displayNameEs: 'Limpieza',
    icon: '🧹',
    description: 'Home and office cleaning',
    popularServices: ['Limpieza profunda', 'Limpieza de oficinas', 'Limpieza post obra'],
  },
  {
    category: ServiceCategory.GARDENING,
    displayName: 'Gardening',
    displayNameEs: 'Jardinería',
    icon: '🌿',
    description: 'Garden maintenance and landscaping',
    popularServices: ['Corte de césped', 'Poda de árboles', 'Diseño de jardines'],
  },
  {
    category: ServiceCategory.PEST_CONTROL,
    displayName: 'Pest Control',
    displayNameEs: 'Control de Plagas',
    icon: '🐜',
    description: 'Pest elimination and prevention',
    popularServices: ['Fumigación', 'Control de roedores', 'Desinfección'],
  },
  {
    category: ServiceCategory.APPLIANCE_REPAIR,
    displayName: 'Appliance Repair',
    displayNameEs: 'Reparación de Electrodomésticos',
    icon: '🔌',
    description: 'Repair of home appliances',
    popularServices: ['Reparación de lavarropas', 'Reparación de heladeras', 'Reparación de microondas'],
  },
  {
    category: ServiceCategory.CARPENTRY,
    displayName: 'Carpentry',
    displayNameEs: 'Carpintería',
    icon: '🪚',
    description: 'Woodwork and furniture',
    popularServices: ['Muebles a medida', 'Reparación de muebles', 'Instalación de placares'],
  },
  {
    category: ServiceCategory.ROOFING,
    displayName: 'Roofing',
    displayNameEs: 'Techos',
    icon: '🏠',
    description: 'Roof repairs and installation',
    popularServices: ['Reparación de techos', 'Impermeabilización', 'Instalación de canaletas'],
  },
  {
    category: ServiceCategory.FLOORING,
    displayName: 'Flooring',
    displayNameEs: 'Pisos',
    icon: '🪵',
    description: 'Floor installation and repair',
    popularServices: ['Pulido de pisos', 'Colocación de pisos', 'Reparación de pisos'],
  },
  {
    category: ServiceCategory.WINDOWS_DOORS,
    displayName: 'Windows & Doors',
    displayNameEs: 'Ventanas y Puertas',
    icon: '🚪',
    description: 'Window and door services',
    popularServices: ['Instalación de ventanas', 'Reparación de persianas', 'Instalación de puertas'],
  },
  {
    category: ServiceCategory.SECURITY,
    displayName: 'Security',
    displayNameEs: 'Seguridad',
    icon: '🛡️',
    description: 'Security systems and alarms',
    popularServices: ['Instalación de alarmas', 'Cámaras de seguridad', 'Cercos eléctricos'],
  },
  {
    category: ServiceCategory.MOVING,
    displayName: 'Moving',
    displayNameEs: 'Mudanzas',
    icon: '📦',
    description: 'Moving and transport services',
    popularServices: ['Mudanzas locales', 'Fletes', 'Embalaje'],
  },
  {
    category: ServiceCategory.GENERAL,
    displayName: 'General',
    displayNameEs: 'General',
    icon: '🛠️',
    description: 'Various handyman services',
    popularServices: ['Mantenimiento general', 'Pequeñas reparaciones', 'Instalaciones varias'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getCategoryMetadata(category: ServiceCategory): CategoryMetadata | undefined {
  return CATEGORY_METADATA.find(c => c.category === category);
}

export function getCategoryDisplayName(category: ServiceCategory, locale = 'es'): string {
  const meta = getCategoryMetadata(category);
  if (!meta) return category;
  return locale === 'es' ? meta.displayNameEs : meta.displayName;
}
