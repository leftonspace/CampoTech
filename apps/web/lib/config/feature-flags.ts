/**
 * CampoTech Feature Flags Configuration
 * ======================================
 *
 * Defines which features are available per subscription tier.
 * This is different from the Capabilities system which is for system-wide toggles.
 * Feature flags here are TIER-BASED access control.
 */

import { SubscriptionTier, getTierOrder } from './tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type FeatureId =
  // Core Features (available to all)
  | 'basic_jobs'
  | 'basic_customers'
  | 'basic_invoicing'
  | 'whatsapp_receive'

  // BASICO+ Features
  | 'afip_integration'
  | 'mercado_pago'
  | 'calendar_view'
  | 'whatsapp_send'
  | 'multi_user'

  // PROFESIONAL+ Features
  | 'whatsapp_ai'
  | 'voice_transcription'
  | 'live_tracking'
  | 'nearest_technician'
  | 'fleet_management'
  | 'inventory_management'

  // EMPRESARIAL Features
  | 'multi_location'
  | 'advanced_analytics'
  | 'customer_portal'
  | 'public_api'
  | 'webhooks'

  // Enterprise Only (custom pricing)
  | 'white_label';

export interface FeatureConfig {
  id: FeatureId;
  name: string;
  description: string;
  category: 'core' | 'integrations' | 'communication' | 'operations' | 'analytics' | 'enterprise';
  minTier: SubscriptionTier;
  icon?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const FEATURES: Record<FeatureId, FeatureConfig> = {
  // Core Features (FREE+)
  basic_jobs: {
    id: 'basic_jobs',
    name: 'Gestión de Trabajos',
    description: 'Crear, asignar y completar trabajos de servicio',
    category: 'core',
    minTier: 'FREE',
    icon: 'wrench',
  },
  basic_customers: {
    id: 'basic_customers',
    name: 'Gestión de Clientes',
    description: 'Registro y seguimiento de clientes',
    category: 'core',
    minTier: 'FREE',
    icon: 'users',
  },
  basic_invoicing: {
    id: 'basic_invoicing',
    name: 'Facturación Básica',
    description: 'Crear y enviar facturas',
    category: 'core',
    minTier: 'FREE',
    icon: 'file-text',
  },
  whatsapp_receive: {
    id: 'whatsapp_receive',
    name: 'Recibir WhatsApp',
    description: 'Recibir mensajes de clientes por WhatsApp',
    category: 'communication',
    minTier: 'FREE',
    icon: 'message-circle',
  },

  // BASICO+ Features
  afip_integration: {
    id: 'afip_integration',
    name: 'Integración AFIP',
    description: 'Factura electrónica con CAE automático',
    category: 'integrations',
    minTier: 'BASICO',
    icon: 'check-square',
  },
  mercado_pago: {
    id: 'mercado_pago',
    name: 'Mercado Pago',
    description: 'Cobrar con tarjeta y link de pago',
    category: 'integrations',
    minTier: 'BASICO',
    icon: 'credit-card',
  },
  calendar_view: {
    id: 'calendar_view',
    name: 'Vista Calendario',
    description: 'Visualizar trabajos en calendario',
    category: 'operations',
    minTier: 'BASICO',
    icon: 'calendar',
  },
  whatsapp_send: {
    id: 'whatsapp_send',
    name: 'Enviar WhatsApp',
    description: 'Enviar mensajes y notificaciones automáticas',
    category: 'communication',
    minTier: 'BASICO',
    icon: 'send',
  },
  multi_user: {
    id: 'multi_user',
    name: 'Multi-Usuario',
    description: 'Agregar empleados y técnicos',
    category: 'operations',
    minTier: 'BASICO',
    icon: 'users',
  },

  // PROFESIONAL+ Features
  whatsapp_ai: {
    id: 'whatsapp_ai',
    name: 'WhatsApp IA',
    description: 'Respuestas automáticas inteligentes',
    category: 'communication',
    minTier: 'PROFESIONAL',
    icon: 'bot',
  },
  voice_transcription: {
    id: 'voice_transcription',
    name: 'Transcripción de Voz',
    description: 'Convertir audios de WhatsApp a texto automáticamente',
    category: 'communication',
    minTier: 'PROFESIONAL',
    icon: 'mic',
  },
  live_tracking: {
    id: 'live_tracking',
    name: 'Seguimiento en Vivo',
    description: 'Ver ubicación de técnicos en tiempo real',
    category: 'operations',
    minTier: 'PROFESIONAL',
    icon: 'map-pin',
  },
  nearest_technician: {
    id: 'nearest_technician',
    name: 'Técnico Más Cercano',
    description: 'Asignar trabajo al técnico más cercano',
    category: 'operations',
    minTier: 'PROFESIONAL',
    icon: 'navigation',
  },
  fleet_management: {
    id: 'fleet_management',
    name: 'Gestión de Flota',
    description: 'Administrar vehículos, documentación y mantenimiento',
    category: 'operations',
    minTier: 'PROFESIONAL',
    icon: 'truck',
  },
  inventory_management: {
    id: 'inventory_management',
    name: 'Gestión de Inventario',
    description: 'Control de stock, productos y materiales',
    category: 'operations',
    minTier: 'PROFESIONAL',
    icon: 'package',
  },

  // EMPRESARIAL Features
  multi_location: {
    id: 'multi_location',
    name: 'Multi-Sucursal',
    description: 'Operar múltiples ubicaciones con config. independiente',
    category: 'enterprise',
    minTier: 'EMPRESARIAL',
    icon: 'building',
  },
  advanced_analytics: {
    id: 'advanced_analytics',
    name: 'Analítica Avanzada',
    description: 'Reportes detallados, KPIs y proyecciones',
    category: 'analytics',
    minTier: 'EMPRESARIAL',
    icon: 'bar-chart-2',
  },
  customer_portal: {
    id: 'customer_portal',
    name: 'Portal de Clientes',
    description: 'Portal personalizado para que clientes vean sus trabajos',
    category: 'enterprise',
    minTier: 'EMPRESARIAL',
    icon: 'globe',
  },
  public_api: {
    id: 'public_api',
    name: 'API Pública',
    description: 'Integrar con sistemas externos vía REST API',
    category: 'enterprise',
    minTier: 'EMPRESARIAL',
    icon: 'code',
  },
  webhooks: {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Recibir notificaciones en tiempo real en tu sistema',
    category: 'enterprise',
    minTier: 'EMPRESARIAL',
    icon: 'webhook',
  },

  // Enterprise Only (requires custom contract)
  white_label: {
    id: 'white_label',
    name: 'Marca Blanca',
    description: 'Remover branding de CampoTech, usar tu propia marca',
    category: 'enterprise',
    minTier: 'EMPRESARIAL', // Actually requires custom Enterprise contract
    icon: 'palette',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE ACCESS MATRIX (Precomputed for performance)
// ═══════════════════════════════════════════════════════════════════════════════

export const TIER_FEATURES: Record<SubscriptionTier, FeatureId[]> = {
  FREE: [
    'basic_jobs',
    'basic_customers',
    'basic_invoicing',
    'whatsapp_receive',
  ],
  BASICO: [
    'basic_jobs',
    'basic_customers',
    'basic_invoicing',
    'whatsapp_receive',
    'afip_integration',
    'mercado_pago',
    'calendar_view',
    'whatsapp_send',
    'multi_user',
  ],
  PROFESIONAL: [
    'basic_jobs',
    'basic_customers',
    'basic_invoicing',
    'whatsapp_receive',
    'afip_integration',
    'mercado_pago',
    'calendar_view',
    'whatsapp_send',
    'multi_user',
    'whatsapp_ai',
    'voice_transcription',
    'live_tracking',
    'nearest_technician',
    'fleet_management',
    'inventory_management',
  ],
  EMPRESARIAL: [
    'basic_jobs',
    'basic_customers',
    'basic_invoicing',
    'whatsapp_receive',
    'afip_integration',
    'mercado_pago',
    'calendar_view',
    'whatsapp_send',
    'multi_user',
    'whatsapp_ai',
    'voice_transcription',
    'live_tracking',
    'nearest_technician',
    'fleet_management',
    'inventory_management',
    'multi_location',
    'advanced_analytics',
    'customer_portal',
    'public_api',
    'webhooks',
    // white_label excluded - requires custom contract
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE TO FEATURE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RouteFeatureMapping {
  pattern: RegExp;
  feature: FeatureId;
}

export const ROUTE_FEATURE_MAP: RouteFeatureMapping[] = [
  { pattern: /^\/api\/afip\//, feature: 'afip_integration' },
  { pattern: /^\/api\/mercado-pago\//, feature: 'mercado_pago' },
  { pattern: /^\/api\/calendar\//, feature: 'calendar_view' },
  { pattern: /^\/api\/whatsapp\/send/, feature: 'whatsapp_send' },
  { pattern: /^\/api\/whatsapp\/ai\//, feature: 'whatsapp_ai' },
  { pattern: /^\/api\/voice\//, feature: 'voice_transcription' },
  { pattern: /^\/api\/tracking\//, feature: 'live_tracking' },
  { pattern: /^\/api\/dispatch\/nearest/, feature: 'nearest_technician' },
  { pattern: /^\/api\/vehicles\//, feature: 'fleet_management' },
  { pattern: /^\/api\/fleet\//, feature: 'fleet_management' },
  { pattern: /^\/api\/inventory\//, feature: 'inventory_management' },
  { pattern: /^\/api\/locations\/[^/]+\//, feature: 'multi_location' }, // Multi-location operations
  { pattern: /^\/api\/analytics\/advanced\//, feature: 'advanced_analytics' },
  { pattern: /^\/api\/portal\//, feature: 'customer_portal' },
  { pattern: /^\/api\/v1\//, feature: 'public_api' }, // Public API endpoints
  { pattern: /^\/api\/webhooks\//, feature: 'webhooks' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a tier has access to a feature
 */
export function hasFeatureAccess(tier: SubscriptionTier, featureId: FeatureId): boolean {
  const feature = FEATURES[featureId];
  if (!feature) return false;

  // Special case: white_label requires custom Enterprise contract
  if (featureId === 'white_label') {
    return false; // Handled separately via capability override
  }

  return getTierOrder(tier) >= getTierOrder(feature.minTier);
}

/**
 * Get all features available to a tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): FeatureConfig[] {
  return TIER_FEATURES[tier].map(id => FEATURES[id]).filter(Boolean);
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinimumTierForFeature(featureId: FeatureId): SubscriptionTier | null {
  const feature = FEATURES[featureId];
  return feature?.minTier || null;
}

/**
 * Get feature by ID
 */
export function getFeature(featureId: FeatureId): FeatureConfig | null {
  return FEATURES[featureId] || null;
}

/**
 * Get feature required for a route
 */
export function getFeatureForRoute(path: string): FeatureId | null {
  for (const mapping of ROUTE_FEATURE_MAP) {
    if (mapping.pattern.test(path)) {
      return mapping.feature;
    }
  }
  return null;
}

/**
 * Get features grouped by category
 */
export function getFeaturesByCategory(): Record<string, FeatureConfig[]> {
  const grouped: Record<string, FeatureConfig[]> = {};

  for (const feature of Object.values(FEATURES)) {
    if (!grouped[feature.category]) {
      grouped[feature.category] = [];
    }
    grouped[feature.category].push(feature);
  }

  return grouped;
}

/**
 * Get features that would be unlocked by upgrading from one tier to another
 */
export function getUnlockableFeatures(
  currentTier: SubscriptionTier,
  targetTier: SubscriptionTier
): FeatureConfig[] {
  const currentFeatures = new Set(TIER_FEATURES[currentTier]);
  const targetFeatures = TIER_FEATURES[targetTier];

  return targetFeatures
    .filter(id => !currentFeatures.has(id))
    .map(id => FEATURES[id])
    .filter(Boolean);
}

/**
 * Get tier comparison for upgrade prompts
 */
export function getTierComparison(currentTier: SubscriptionTier): Array<{
  tier: SubscriptionTier;
  name: string;
  newFeatures: FeatureConfig[];
}> {
  const tiers: SubscriptionTier[] = ['BASICO', 'PROFESIONAL', 'EMPRESARIAL'];
  const currentIndex = getTierOrder(currentTier);

  return tiers
    .filter(tier => getTierOrder(tier) > currentIndex)
    .map(tier => ({
      tier,
      name: tier === 'BASICO' ? 'Básico' :
            tier === 'PROFESIONAL' ? 'Profesional' : 'Empresarial',
      newFeatures: getUnlockableFeatures(currentTier, tier),
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE NOT AVAILABLE ERROR
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeatureNotAvailableError {
  error: 'feature_not_available';
  feature: FeatureId;
  feature_name: string;
  current_tier: SubscriptionTier;
  required_tier: SubscriptionTier;
  message: string;
  upgrade_url: string;
}

/**
 * Create feature not available error response
 */
export function createFeatureNotAvailableError(
  featureId: FeatureId,
  currentTier: SubscriptionTier
): FeatureNotAvailableError {
  const feature = FEATURES[featureId];

  const tierNames: Record<SubscriptionTier, string> = {
    FREE: 'Gratis',
    BASICO: 'Básico',
    PROFESIONAL: 'Profesional',
    EMPRESARIAL: 'Empresarial',
  };

  return {
    error: 'feature_not_available',
    feature: featureId,
    feature_name: feature?.name || featureId,
    current_tier: currentTier,
    required_tier: feature?.minTier || 'BASICO',
    message: `${feature?.name || featureId} no está disponible en tu plan actual.`,
    upgrade_url: `/settings/billing/upgrade?feature=${featureId}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE TO FEATURE MAPPING (For Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps navigation modules to their required features.
 * Only modules listed here require tier access - others are always available.
 */
export const TIER_GATED_MODULES: Record<string, FeatureId> = {
  map: 'live_tracking',
  calendar: 'calendar_view',
  fleet: 'fleet_management',
  inventory: 'inventory_management',
  payments: 'mercado_pago',
  analytics: 'advanced_analytics',
  locations: 'multi_location',
  whatsapp: 'whatsapp_send',
  team: 'multi_user',
};

/**
 * Modules that are always available (no tier restriction).
 * Access is controlled only by role permissions.
 */
export const ALWAYS_AVAILABLE_MODULES: string[] = [
  'dashboard',
  'jobs',
  'customers',
  'invoices',
  'settings',
];

/**
 * Check if a module requires tier access
 */
export function isModuleTierGated(module: string): boolean {
  return module in TIER_GATED_MODULES;
}

/**
 * Get the feature required for a module
 */
export function getModuleFeature(module: string): FeatureId | null {
  return TIER_GATED_MODULES[module] || null;
}

/**
 * Check if a module is locked for a given tier
 */
export function isModuleLocked(module: string, tier: SubscriptionTier): boolean {
  const feature = TIER_GATED_MODULES[module];
  if (!feature) return false;
  return !hasFeatureAccess(tier, feature);
}

/**
 * Get the minimum tier required for a module
 */
export function getModuleMinimumTier(module: string): SubscriptionTier | null {
  const feature = TIER_GATED_MODULES[module];
  if (!feature) return null;
  return getMinimumTierForFeature(feature);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION ITEMS WITH FEATURE GATING INFO
// ═══════════════════════════════════════════════════════════════════════════════

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  feature?: FeatureId;
}

/**
 * Dashboard navigation items with feature requirements
 */
export const DASHBOARD_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', href: '/dashboard', icon: 'home' },
  { id: 'jobs', label: 'Trabajos', href: '/dashboard/jobs', icon: 'wrench' },
  { id: 'customers', label: 'Clientes', href: '/dashboard/customers', icon: 'users' },
  { id: 'calendar', label: 'Calendario', href: '/dashboard/calendar', icon: 'calendar', feature: 'calendar_view' },
  { id: 'invoices', label: 'Facturas', href: '/dashboard/invoices', icon: 'file-text' },
  { id: 'payments', label: 'Pagos', href: '/dashboard/payments', icon: 'credit-card', feature: 'mercado_pago' },
  { id: 'fleet', label: 'Flota', href: '/dashboard/fleet', icon: 'truck', feature: 'fleet_management' },
  { id: 'inventory', label: 'Inventario', href: '/dashboard/inventory', icon: 'package', feature: 'inventory_management' },
  { id: 'dispatch', label: 'Despacho', href: '/dashboard/dispatch', icon: 'map-pin', feature: 'live_tracking' },
  { id: 'locations', label: 'Sucursales', href: '/dashboard/locations', icon: 'building', feature: 'multi_location' },
  { id: 'whatsapp', label: 'WhatsApp', href: '/dashboard/whatsapp', icon: 'message-circle' },
  { id: 'analytics', label: 'Reportes', href: '/dashboard/analytics', icon: 'bar-chart-2', feature: 'advanced_analytics' },
  { id: 'settings', label: 'Configuración', href: '/dashboard/settings', icon: 'settings' },
];

/**
 * Get navigation items filtered by tier access
 */
export function getNavItemsForTier(tier: SubscriptionTier): Array<NavItem & { locked: boolean }> {
  return DASHBOARD_NAV.map(item => ({
    ...item,
    locked: item.feature ? !hasFeatureAccess(tier, item.feature) : false,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default FEATURES;
