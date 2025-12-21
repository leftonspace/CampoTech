/**
 * WhatsApp Link Utilities
 *
 * Generates wa.me links for click-to-chat functionality.
 * This is for the INICIAL tier - uses the business's personal WhatsApp number.
 */

/**
 * Normalize a phone number to international format (Argentina-focused)
 * Removes all non-digit characters and ensures proper format for wa.me links
 *
 * @example
 * normalizePhoneNumber('+54 11 5555-1234') // '5491155551234'
 * normalizePhoneNumber('11 5555 1234')     // '5491155551234' (assumes Argentina)
 * normalizePhoneNumber('+1 555 123 4567')  // '15551234567'
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If the number starts with 0, remove it (Argentine local format)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // If it's an Argentine number without country code (typically 10 digits starting with area code)
  // Add the Argentina country code (54) and mobile prefix (9) for mobile numbers
  if (digits.length === 10 && !digits.startsWith('54')) {
    // Check if it's a mobile number (starts with 11, 15, or other mobile area codes)
    const areaCode = digits.slice(0, 2);
    const mobileAreaCodes = ['11', '15', '22', '23', '26', '29', '34', '35', '37', '38', '26', '29', '34', '35', '36', '37', '38', '54', '26', '29'];

    // For mobile numbers in Argentina, use 54 9 format
    // Area code 11 (Buenos Aires), 351 (Córdoba), 261 (Mendoza), etc.
    digits = '549' + digits;
  }

  // If it already has 54 but missing the 9 for mobile, add it
  if (digits.startsWith('54') && digits.length === 12) {
    // Check if it's missing the 9 prefix for mobile
    const afterCountryCode = digits.slice(2);
    if (!afterCountryCode.startsWith('9')) {
      digits = '549' + afterCountryCode;
    }
  }

  return digits;
}

/**
 * Generate a wa.me link for WhatsApp click-to-chat
 *
 * @param phone - Phone number (will be normalized)
 * @param message - Optional pre-filled message
 * @returns Full wa.me URL
 *
 * @example
 * generateWhatsAppLink('+54 11 5555-1234')
 * // 'https://wa.me/5491155551234'
 *
 * generateWhatsAppLink('+54 11 5555-1234', 'Hola, tengo una consulta')
 * // 'https://wa.me/5491155551234?text=Hola%2C%20tengo%20una%20consulta'
 */
export function generateWhatsAppLink(phone: string, message?: string): string {
  const normalizedPhone = normalizePhoneNumber(phone);

  let url = `https://wa.me/${normalizedPhone}`;

  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }

  return url;
}

/**
 * Generate a WhatsApp link for invoice inquiries
 */
export function generateInvoiceWhatsAppLink(
  businessPhone: string,
  invoiceNumber: string,
  invoiceType: string = 'Factura'
): string {
  const message = `Hola, tengo una consulta sobre la ${invoiceType} ${invoiceNumber}`;
  return generateWhatsAppLink(businessPhone, message);
}

/**
 * Generate a WhatsApp link for job/appointment confirmations
 */
export function generateJobWhatsAppLink(
  customerPhone: string,
  customerName: string,
  jobNumber: string,
  scheduledDate?: string
): string {
  const dateText = scheduledDate ? ` programado para el ${scheduledDate}` : '';
  const message = `Hola ${customerName}, le escribimos respecto al trabajo ${jobNumber}${dateText}.`;
  return generateWhatsAppLink(customerPhone, message);
}

/**
 * Generate a WhatsApp link for customer contact
 */
export function generateCustomerWhatsAppLink(
  customerPhone: string,
  customerName: string
): string {
  const message = `Hola ${customerName},`;
  return generateWhatsAppLink(customerPhone, message);
}

/**
 * Generate a WhatsApp link for public business profile
 */
export function generateBusinessProfileWhatsAppLink(
  businessPhone: string,
  businessName?: string
): string {
  const message = businessName
    ? `Hola, vi el perfil de ${businessName} en CampoTech`
    : 'Hola, vi tu perfil en CampoTech';
  return generateWhatsAppLink(businessPhone, message);
}

/**
 * Generate a QR code data URL for a WhatsApp link
 * Uses the qr-code-styling library or a simple API
 *
 * @param phone - Phone number
 * @param message - Optional pre-filled message
 * @returns Promise resolving to QR code data URL
 */
export async function generateWhatsAppQRCode(
  phone: string,
  message?: string
): Promise<string> {
  const whatsAppLink = generateWhatsAppLink(phone, message);

  // Use a free QR code API for simplicity
  // In production, you might want to use a local library like qrcode
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(whatsAppLink)}`;

  return qrApiUrl;
}

/**
 * Check if a phone number is valid for WhatsApp
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // WhatsApp numbers should have at least 10 digits and at most 15
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Format phone number for display
 * Returns a human-readable format while keeping the original structure
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Argentine mobile format: +54 9 11 XXXX-XXXX
  if (digits.startsWith('549') && digits.length === 13) {
    const areaCode = digits.slice(3, 5);
    const firstPart = digits.slice(5, 9);
    const secondPart = digits.slice(9);
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Argentine landline format: +54 11 XXXX-XXXX
  if (digits.startsWith('54') && digits.length === 12) {
    const areaCode = digits.slice(2, 4);
    const firstPart = digits.slice(4, 8);
    const secondPart = digits.slice(8);
    return `+54 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Generic format with country code
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
  }

  // Just return with basic formatting
  return phone;
}

// Pre-defined message templates
export const WhatsAppMessageTemplates = {
  invoice: {
    inquiry: (invoiceNumber: string) =>
      `Hola, tengo una consulta sobre la factura ${invoiceNumber}`,
    reminder: (invoiceNumber: string, dueDate: string) =>
      `Hola, le recordamos que la factura ${invoiceNumber} vence el ${dueDate}`,
    thanks: (invoiceNumber: string) =>
      `Gracias por su pago de la factura ${invoiceNumber}`,
  },
  job: {
    confirmation: (jobNumber: string, date: string, time: string) =>
      `Confirmamos su turno ${jobNumber} para el ${date} a las ${time}. Responda SI para confirmar.`,
    reminder: (jobNumber: string, date: string) =>
      `Le recordamos su turno ${jobNumber} programado para mañana ${date}`,
    onTheWay: (technicianName: string, eta: string) =>
      `${technicianName} está en camino. Tiempo estimado de llegada: ${eta}`,
    completed: (jobNumber: string) =>
      `El trabajo ${jobNumber} ha sido completado. ¡Gracias por confiar en nosotros!`,
  },
  general: {
    greeting: (customerName: string) =>
      `Hola ${customerName},`,
    followUp: (customerName: string) =>
      `Hola ${customerName}, ¿cómo resultó nuestro servicio? Nos encantaría conocer su opinión.`,
  },
} as const;
