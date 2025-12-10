/**
 * Utility Functions
 * =================
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency (Argentine Pesos)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date, formatStr = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: es });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
}

/**
 * Format relative time (e.g., "hace 2 horas")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  // Format Argentine phone: +54 9 11 1234-5678
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('549')) {
    const areaCode = cleaned.slice(3, 5);
    const firstPart = cleaned.slice(5, 9);
    const secondPart = cleaned.slice(9);
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`;
  }

  return phone;
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Job statuses
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    en_camino: 'bg-purple-100 text-purple-800',
    working: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',

    // Invoice statuses
    draft: 'bg-gray-100 text-gray-800',
    issued: 'bg-blue-100 text-blue-800',
    sent: 'bg-cyan-100 text-cyan-800',
    paid: 'bg-green-100 text-green-800',
    voided: 'bg-red-100 text-red-800',

    // Ticket statuses
    open: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    waiting_customer: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',

    // Booking statuses
    confirmed: 'bg-green-100 text-green-800',
    deposit_required: 'bg-orange-100 text-orange-800',
    expired: 'bg-gray-100 text-gray-800',
  };

  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get status label in Spanish
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // Job statuses
    pending: 'Pendiente',
    scheduled: 'Agendado',
    en_camino: 'En camino',
    working: 'En progreso',
    completed: 'Completado',
    cancelled: 'Cancelado',

    // Invoice statuses
    draft: 'Borrador',
    issued: 'Emitida',
    sent: 'Enviada',
    paid: 'Pagada',
    voided: 'Anulada',

    // Ticket statuses
    open: 'Abierto',
    in_progress: 'En progreso',
    waiting_customer: 'Esperando respuesta',
    resolved: 'Resuelto',
    closed: 'Cerrado',

    // Booking statuses
    confirmed: 'Confirmado',
    deposit_required: 'Requiere seña',
    expired: 'Expirado',
  };

  return labels[status] || status;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format invoice number
 */
export function formatInvoiceNumber(
  invoiceType: string,
  puntoVenta: number,
  invoiceNumber: number
): string {
  const pvStr = puntoVenta.toString().padStart(4, '0');
  const numStr = invoiceNumber.toString().padStart(8, '0');
  return `${invoiceType} ${pvStr}-${numStr}`;
}

/**
 * Calculate star rating display
 */
export function getStarRating(rating: number): { full: number; half: boolean; empty: number } {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return { full, half, empty };
}
