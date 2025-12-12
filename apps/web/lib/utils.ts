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
 * Format date in Argentine format
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Format date and time
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
 * Format phone number
 */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 11) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
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
 */
export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  scheduled: 'Programado',
  en_camino: 'En camino',
  working: 'En trabajo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const JOB_STATUS_COLORS: Record<string, string> = {
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
