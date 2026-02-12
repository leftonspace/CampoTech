/**
 * Utility Functions
 * =================
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in ARS
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
}

/**
 * Format date in Argentine format - ALWAYS uses Buenos Aires timezone
 * This ensures dates display consistently regardless of user location
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Buenos_Aires', // Always use Argentina timezone
  }).format(d);
}

/**
 * Format date and time - ALWAYS uses Buenos Aires timezone
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Buenos_Aires', // Always use Argentina timezone
  }).format(d);
}

/**
 * Format relative time (e.g., "hace 5 minutos")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const now = new Date();
  const then = new Date(date);
  if (isNaN(then.getTime())) return '-';
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
  if (diffHour < 24) return `hace ${diffHour} hora${diffHour > 1 ? 's' : ''}`;
  if (diffDay < 7) return `hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;

  return formatDate(date);
}

/**
 * Format address object to string
 */
export function formatAddress(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    const parts = [
      addr.street,
      addr.number,
      addr.floor && `Piso ${addr.floor}`,
      addr.apartment && `Depto ${addr.apartment}`,
      addr.city,
      addr.postalCode,
    ].filter(Boolean);
    return parts.join(', ') || '';
  }
  return '';
}

/**
 * Format CUIT with dashes (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const clean = cuit.replace(/\D/g, '');
  if (clean.length !== 11) return cuit;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

/**
 * Format phone number for display with proper international formatting
 * Handles multiple country codes:
 * - +1 (US/Canada): +1 (XXX) XXX-XXXX
 * - +54 (Argentina): +54 9 XX XXXX-XXXX (mobile) or +54 XX XXXX-XXXX (landline)
 * - +55 (Brazil): +55 XX XXXXX-XXXX
 * - +52 (Mexico): +52 XX XXXX-XXXX
 * - +56 (Chile): +56 X XXXX-XXXX
 * - +57 (Colombia): +57 XXX XXX-XXXX
 * - +598 (Uruguay): +598 X XXX-XXXX
 * - Other international: +XX XXXX XXXX
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';

  const clean = phone.replace(/\D/g, '');

  // Empty or too short
  if (clean.length < 7) return phone;

  // +1 (US/Canada) - NANP format: +1 (XXX) XXX-XXXX
  if (clean.startsWith('1') && clean.length === 11) {
    const areaCode = clean.slice(1, 4);
    const exchange = clean.slice(4, 7);
    const subscriber = clean.slice(7);
    return `+1 (${areaCode}) ${exchange}-${subscriber}`;
  }

  // Argentine mobile: +54 9 XX XXXX-XXXX (13 digits with 549)
  if (clean.startsWith('549') && clean.length === 13) {
    const areaCode = clean.slice(3, 5);
    const firstPart = clean.slice(5, 9);
    const secondPart = clean.slice(9);
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Argentine landline/fixed: +54 XX XXXX-XXXX (12 digits with 54)
  if (clean.startsWith('54') && !clean.startsWith('549') && clean.length === 12) {
    const areaCode = clean.slice(2, 4);
    const firstPart = clean.slice(4, 8);
    const secondPart = clean.slice(8);
    return `+54 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Brazil: +55 XX XXXXX-XXXX (13 digits) or +55 XX XXXX-XXXX (12 digits)
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    const areaCode = clean.slice(2, 4);
    if (clean.length === 13) {
      const firstPart = clean.slice(4, 9);
      const secondPart = clean.slice(9);
      return `+55 ${areaCode} ${firstPart}-${secondPart}`;
    } else {
      const firstPart = clean.slice(4, 8);
      const secondPart = clean.slice(8);
      return `+55 ${areaCode} ${firstPart}-${secondPart}`;
    }
  }

  // Mexico: +52 XX XXXX-XXXX (12 digits)
  if (clean.startsWith('52') && clean.length === 12) {
    const areaCode = clean.slice(2, 4);
    const firstPart = clean.slice(4, 8);
    const secondPart = clean.slice(8);
    return `+52 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Chile: +56 X XXXX-XXXX (11 digits)
  if (clean.startsWith('56') && clean.length === 11) {
    const prefix = clean.slice(2, 3);
    const firstPart = clean.slice(3, 7);
    const secondPart = clean.slice(7);
    return `+56 ${prefix} ${firstPart}-${secondPart}`;
  }

  // Colombia: +57 XXX XXX-XXXX (12 digits)
  if (clean.startsWith('57') && clean.length === 12) {
    const areaCode = clean.slice(2, 5);
    const firstPart = clean.slice(5, 8);
    const secondPart = clean.slice(8);
    return `+57 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Uruguay: +598 X XXX-XXXX (11 digits)
  if (clean.startsWith('598') && clean.length === 11) {
    const prefix = clean.slice(3, 4);
    const firstPart = clean.slice(4, 7);
    const secondPart = clean.slice(7);
    return `+598 ${prefix} ${firstPart}-${secondPart}`;
  }

  // Paraguay: +595 XX XXX-XXXX (12 digits)
  if (clean.startsWith('595') && clean.length === 12) {
    const areaCode = clean.slice(3, 5);
    const firstPart = clean.slice(5, 8);
    const secondPart = clean.slice(8);
    return `+595 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Peru: +51 XXX XXX-XXX (11 digits)
  if (clean.startsWith('51') && clean.length === 11) {
    const areaCode = clean.slice(2, 5);
    const firstPart = clean.slice(5, 8);
    const secondPart = clean.slice(8);
    return `+51 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Bolivia: +591 X XXX-XXXX (11 digits)
  if (clean.startsWith('591') && clean.length === 11) {
    const prefix = clean.slice(3, 4);
    const firstPart = clean.slice(4, 7);
    const secondPart = clean.slice(7);
    return `+591 ${prefix} ${firstPart}-${secondPart}`;
  }

  // Ecuador: +593 X XXX-XXXX (12 digits)
  if (clean.startsWith('593') && clean.length === 12) {
    const prefix = clean.slice(3, 4);
    const firstPart = clean.slice(4, 8);
    const secondPart = clean.slice(8);
    return `+593 ${prefix} ${firstPart}-${secondPart}`;
  }

  // Venezuela: +58 XXX XXX-XXXX (12 digits)
  if (clean.startsWith('58') && clean.length === 12) {
    const areaCode = clean.slice(2, 5);
    const firstPart = clean.slice(5, 8);
    const secondPart = clean.slice(8);
    return `+58 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Panama: +507 XXXX-XXXX (11 digits)
  if (clean.startsWith('507') && clean.length === 11) {
    const firstPart = clean.slice(3, 7);
    const secondPart = clean.slice(7);
    return `+507 ${firstPart}-${secondPart}`;
  }

  // 10-digit local number (assume Argentina without country code)
  if (clean.length === 10) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }

  // 11-digit local number (assume Argentina mobile without country code)
  if (clean.length === 11 && !clean.startsWith('1')) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 7)}-${clean.slice(7)}`;
  }

  // Generic international format for numbers > 10 digits
  if (clean.length > 10) {
    // Find country code (1-3 digits) and format the rest
    const countryCodeLength = clean.startsWith('1') ? 1 :
      clean.length <= 12 ? 2 : 3;
    const countryCode = clean.slice(0, countryCodeLength);
    const remaining = clean.slice(countryCodeLength);

    // Format remaining as XXX XXXX-XXXX or similar
    if (remaining.length >= 10) {
      const areaCode = remaining.slice(0, 3);
      const firstPart = remaining.slice(3, 7);
      const secondPart = remaining.slice(7);
      return `+${countryCode} ${areaCode} ${firstPart}-${secondPart}`;
    } else if (remaining.length >= 7) {
      const firstPart = remaining.slice(0, remaining.length - 4);
      const secondPart = remaining.slice(-4);
      return `+${countryCode} ${firstPart}-${secondPart}`;
    }
  }

  // Return original if no pattern matches
  return phone;
}

/**
 * Get initials from name
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Job status display
 * Supports both lowercase (frontend) and uppercase (database) keys
 */
export const JOB_STATUS_LABELS: Record<string, string> = {
  // Database enum values (uppercase)
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  EN_ROUTE: 'En camino',
  IN_PROGRESS: 'En trabajo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  // Legacy lowercase keys for backwards compatibility
  pending: 'Pendiente',
  scheduled: 'Asignado',
  en_camino: 'En camino',
  working: 'En trabajo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const JOB_STATUS_COLORS: Record<string, string> = {
  // Database enum values (uppercase)
  PENDING: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  EN_ROUTE: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  // Legacy lowercase keys for backwards compatibility
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  en_camino: 'bg-purple-100 text-purple-800',
  working: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

/**
 * Invoice status display
 */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending_cae: 'Pendiente CAE',
  issued: 'Emitida',
  sent: 'Enviada',
  paid: 'Pagada',
  partially_paid: 'Pago parcial',
  overdue: 'Vencida',
  cancelled: 'Anulada',
  rejected: 'Rechazada',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_cae: 'bg-yellow-100 text-yellow-800',
  issued: 'bg-blue-100 text-blue-800',
  sent: 'bg-purple-100 text-purple-800',
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};

/**
 * Payment status display
 */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-purple-100 text-purple-800',
  charged_back: 'bg-red-100 text-red-800',
};

/**
 * IVA condition labels
 */
export const IVA_CONDITION_LABELS: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista: 'Monotributista',
  consumidor_final: 'Consumidor Final',
  exento: 'Exento',
};

/**
 * User role labels in Spanish
 * Supports both uppercase (database enum) and lowercase keys
 */
export const USER_ROLE_LABELS: Record<string, string> = {
  // Database enum values (uppercase)
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  // Lowercase keys for backwards compatibility
  super_admin: 'Super Admin',
  owner: 'Propietario',
  admin: 'Administrador',
  technician: 'Técnico',
};

/**
 * Get the Spanish label for a user role
 * @param role - The role from the database (e.g., 'OWNER', 'TECHNICIAN')
 * @returns The Spanish label or the original role if not found
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Usuario';
  return USER_ROLE_LABELS[role] || USER_ROLE_LABELS[role.toUpperCase()] || role;
}

/**
 * Normalize text for accent-insensitive search
 * Removes diacritical marks (accents) and converts to lowercase
 * e.g., "María" -> "maria", "José" -> "jose"
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Check if a text matches a search query (accent-insensitive)
 * @param text - The text to search in
 * @param query - The search query
 * @returns true if the normalized text includes the normalized query
 */
export function searchMatches(text: string | null | undefined, query: string): boolean {
  if (!text || !query) return !query; // If no query, match everything
  return normalizeSearchText(text).includes(normalizeSearchText(query));
}

/**
 * Check if any of the provided texts match the search query (accent-insensitive)
 * @param texts - Array of texts to search in
 * @param query - The search query
 * @returns true if any normalized text includes the normalized query
 */
export function searchMatchesAny(texts: (string | null | undefined)[], query: string): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeSearchText(query);
  return texts.some(text => text && normalizeSearchText(text).includes(normalizedQuery));
}
