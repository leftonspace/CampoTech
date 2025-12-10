/**
 * Consumer Constants
 * ==================
 *
 * Phase 15: Consumer Marketplace
 * Constants and configuration for consumer features.
 */

export const CATEGORIES = [
  { id: 'plumbing', name: 'Plomeria', icon: '🔧' },
  { id: 'electrical', name: 'Electricidad', icon: '⚡' },
  { id: 'hvac', name: 'Aire Acond.', icon: '❄️' },
  { id: 'construction', name: 'Construccion', icon: '🔨' },
  { id: 'locksmith', name: 'Cerrajeria', icon: '🔒' },
  { id: 'painting', name: 'Pintura', icon: '🎨' },
  { id: 'gas', name: 'Gas', icon: '🔥' },
  { id: 'cleaning', name: 'Limpieza', icon: '🧹' },
  { id: 'gardening', name: 'Jardineria', icon: '🌱' },
  { id: 'pest_control', name: 'Fumigacion', icon: '🐛' },
  { id: 'appliance_repair', name: 'Electrodomesticos', icon: '🔌' },
  { id: 'carpentry', name: 'Carpinteria', icon: '🪚' },
  { id: 'roofing', name: 'Techos', icon: '🏠' },
  { id: 'flooring', name: 'Pisos', icon: '🧱' },
  { id: 'windows_doors', name: 'Aberturas', icon: '🚪' },
  { id: 'security', name: 'Seguridad', icon: '📹' },
  { id: 'moving', name: 'Mudanzas', icon: '📦' },
  { id: 'general', name: 'Otros', icon: '➕' },
];

export function getCategoryInfo(categoryId: string) {
  return CATEGORIES.find((c) => c.id === categoryId);
}

export const URGENCY_OPTIONS = [
  { key: 'emergency', label: 'Urgente', description: 'Lo necesito ahora' },
  { key: 'today', label: 'Hoy', description: 'Durante el dia de hoy' },
  { key: 'this_week', label: 'Esta semana', description: 'En los proximos dias' },
  { key: 'flexible', label: 'Flexible', description: 'Sin apuro' },
];

export const BUDGET_RANGES = [
  { key: 'under_5000', label: 'Menos de $5.000' },
  { key: '5000_15000', label: '$5.000 - $15.000' },
  { key: '15000_50000', label: '$15.000 - $50.000' },
  { key: '50000_100000', label: '$50.000 - $100.000' },
  { key: 'over_100000', label: 'Mas de $100.000' },
  { key: 'not_specified', label: 'No especificado' },
];

export const TIME_SLOTS = [
  { key: 'morning', label: 'Manana (8-12)', description: '08:00 - 12:00' },
  { key: 'afternoon', label: 'Tarde (12-18)', description: '12:00 - 18:00' },
  { key: 'evening', label: 'Noche (18-21)', description: '18:00 - 21:00' },
  { key: 'any', label: 'Cualquier horario', description: 'Flexible' },
];

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: 'Esperando presupuestos',
  quotes_received: 'Presupuestos recibidos',
  accepted: 'Presupuesto aceptado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  viewed: 'Visto',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  withdrawn: 'Retirado',
};

export const BADGE_LABELS: Record<string, string> = {
  verified: 'Verificado',
  top_rated: 'Mejor valorado',
  fast_responder: 'Respuesta rapida',
  new: 'Nuevo',
  licensed: 'Matriculado',
  insured: 'Asegurado',
  background_checked: 'Antecedentes verificados',
  premium: 'Premium',
};

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/consumer/auth/login',
  AUTH_VERIFY: '/consumer/auth/verify',
  AUTH_ME: '/consumer/profiles/me',

  // Discovery
  DISCOVERY_SEARCH: '/consumer/discovery/search',
  DISCOVERY_TOP: '/consumer/discovery/top',
  DISCOVERY_BUSINESS: '/consumer/discovery/business',

  // Requests
  REQUESTS: '/consumer/requests',
  REQUEST_QUOTES: '/consumer/requests/:id/quotes',

  // Quotes
  QUOTES: '/consumer/quotes',
  QUOTE_ACCEPT: '/consumer/quotes/:id/accept',
  QUOTE_DECLINE: '/consumer/quotes/:id/decline',

  // Reviews
  REVIEWS: '/consumer/reviews',
  REVIEWS_BUSINESS: '/consumer/reviews/business',

  // Jobs
  JOBS: '/consumer/jobs',
};
