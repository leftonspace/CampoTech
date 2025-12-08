/**
 * AFIP QR Code Generator
 * ======================
 *
 * Generates QR codes for electronic invoices per AFIP RG 4291.
 * The QR code contains encoded invoice data that can be scanned
 * for verification against AFIP's servers.
 *
 * Reference: https://www.afip.gob.ar/fe/qr/
 */

import * as crypto from 'crypto';
import {
  QRCodeData,
  AFIPInvoiceType,
  AFIPDocumentType,
  AFIPCurrency,
} from './afip.types';
import { formatAFIPDate } from './wsfe/invoice-builder';

// ═══════════════════════════════════════════════════════════════════════════════
// QR DATA GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build QR code data object per RG 4291
 */
export function buildQRCodeData(params: {
  date: Date;
  cuit: string;
  puntoVenta: number;
  invoiceType: AFIPInvoiceType;
  invoiceNumber: number;
  total: number;
  currency?: AFIPCurrency;
  exchangeRate?: number;
  customerDocType: AFIPDocumentType;
  customerDocNumber: string;
  cae: string;
}): QRCodeData {
  return {
    ver: 1,
    fecha: formatDateForQR(params.date),
    cuit: params.cuit,
    ptoVta: params.puntoVenta,
    tipoCmp: params.invoiceType,
    nroCmp: params.invoiceNumber,
    importe: roundAmount(params.total),
    moneda: params.currency || AFIPCurrency.PESOS,
    ctz: params.exchangeRate || 1,
    tipoDocRec: params.customerDocType,
    nroDocRec: params.customerDocNumber,
    tipoCodAut: 'E', // E = CAE (electronic authorization code)
    codAut: params.cae,
  };
}

/**
 * Format date for QR code (YYYY-MM-DD)
 */
function formatDateForQR(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Round amount to 2 decimal places
 */
function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR URL GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

const AFIP_QR_BASE_URL = 'https://www.afip.gob.ar/fe/qr/';

/**
 * Generate the QR code URL for AFIP verification
 *
 * The URL format is: https://www.afip.gob.ar/fe/qr/?p=<base64_encoded_data>
 */
export function generateQRUrl(data: QRCodeData): string {
  // Convert data to JSON
  const jsonData = JSON.stringify(data);

  // Encode to base64
  const base64Data = Buffer.from(jsonData).toString('base64');

  // Build URL
  return `${AFIP_QR_BASE_URL}?p=${base64Data}`;
}

/**
 * Decode QR URL back to data (useful for verification)
 */
export function decodeQRUrl(url: string): QRCodeData | null {
  try {
    const urlObj = new URL(url);
    const base64Data = urlObj.searchParams.get('p');

    if (!base64Data) {
      return null;
    }

    const jsonData = Buffer.from(base64Data, 'base64').toString('utf8');
    return JSON.parse(jsonData) as QRCodeData;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR IMAGE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate QR code as SVG string
 *
 * This is a simple implementation that creates an SVG QR code.
 * For production, consider using a library like 'qrcode' for better quality.
 */
export function generateQRSvg(data: string, size: number = 150): string {
  // For a proper QR code, we need to use a QR library
  // This is a placeholder that creates a simple representation
  // In production, use: import QRCode from 'qrcode'; QRCode.toString(data, { type: 'svg' });

  const modules = generateQRModules(data);
  const moduleCount = modules.length;
  const moduleSize = size / moduleCount;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        const x = col * moduleSize;
        const y = row * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Generate QR code as base64 PNG
 *
 * Note: This requires a QR library. Using a hash-based placeholder for now.
 */
export function generateQRBase64(data: string): string {
  // In production, use a proper QR library:
  // import QRCode from 'qrcode';
  // return QRCode.toDataURL(data);

  // Placeholder: return a data URL that indicates QR generation is needed
  const hash = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  return `data:text/plain;base64,${Buffer.from(`QR:${hash}`).toString('base64')}`;
}

/**
 * Generate QR modules (simplified QR generation)
 *
 * This is a very simplified implementation for demonstration.
 * In production, use a proper QR code library.
 */
function generateQRModules(data: string): boolean[][] {
  // Create a simple 21x21 QR-like pattern based on data hash
  // Real QR codes need proper encoding (Reed-Solomon, etc.)
  const size = 21; // Minimum QR code size
  const modules: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

  // Hash the data to get consistent pattern
  const hash = crypto.createHash('sha256').update(data).digest();

  // Add finder patterns (top-left, top-right, bottom-left)
  addFinderPattern(modules, 0, 0);
  addFinderPattern(modules, size - 7, 0);
  addFinderPattern(modules, 0, size - 7);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  // Fill data area with hash-based pattern
  let hashIndex = 0;
  for (let row = 9; row < size - 1; row++) {
    for (let col = 9; col < size - 1; col++) {
      if (!isReserved(row, col, size)) {
        modules[row][col] = (hash[hashIndex % hash.length] & (1 << (col % 8))) !== 0;
        hashIndex++;
      }
    }
  }

  return modules;
}

/**
 * Add finder pattern to QR code
 */
function addFinderPattern(modules: boolean[][], startRow: number, startCol: number): void {
  // 7x7 finder pattern
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const isOuter = row === 0 || row === 6 || col === 0 || col === 6;
      const isInner = row >= 2 && row <= 4 && col >= 2 && col <= 4;
      modules[startRow + row][startCol + col] = isOuter || isInner;
    }
  }
}

/**
 * Check if position is reserved (finder patterns, timing)
 */
function isReserved(row: number, col: number, size: number): boolean {
  // Finder pattern areas + 1 module separator
  if ((row < 9 && col < 9) || // Top-left
      (row < 9 && col >= size - 8) || // Top-right
      (row >= size - 8 && col < 9)) { // Bottom-left
    return true;
  }
  // Timing patterns
  if (row === 6 || col === 6) {
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API
// ═══════════════════════════════════════════════════════════════════════════════

export interface QRGenerationResult {
  url: string;
  data: QRCodeData;
  svg?: string;
  base64?: string;
}

/**
 * Generate complete QR code for an invoice
 */
export function generateInvoiceQR(params: {
  date: Date;
  cuit: string;
  puntoVenta: number;
  invoiceType: AFIPInvoiceType;
  invoiceNumber: number;
  total: number;
  customerDocType: AFIPDocumentType;
  customerDocNumber: string;
  cae: string;
  includeSvg?: boolean;
  includeBase64?: boolean;
}): QRGenerationResult {
  // Build QR data
  const data = buildQRCodeData({
    date: params.date,
    cuit: params.cuit,
    puntoVenta: params.puntoVenta,
    invoiceType: params.invoiceType,
    invoiceNumber: params.invoiceNumber,
    total: params.total,
    customerDocType: params.customerDocType,
    customerDocNumber: params.customerDocNumber,
    cae: params.cae,
  });

  // Generate URL
  const url = generateQRUrl(data);

  // Build result
  const result: QRGenerationResult = {
    url,
    data,
  };

  // Optional: Generate SVG
  if (params.includeSvg) {
    result.svg = generateQRSvg(url);
  }

  // Optional: Generate base64
  if (params.includeBase64) {
    result.base64 = generateQRBase64(url);
  }

  return result;
}

/**
 * Validate QR code data
 */
export function validateQRData(data: QRCodeData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.ver !== 1) {
    errors.push('Invalid QR version');
  }

  if (!data.cuit || data.cuit.length !== 11) {
    errors.push('Invalid CUIT');
  }

  if (!data.ptoVta || data.ptoVta < 1 || data.ptoVta > 99999) {
    errors.push('Invalid punto de venta');
  }

  if (!data.nroCmp || data.nroCmp < 1) {
    errors.push('Invalid invoice number');
  }

  if (!data.codAut || data.codAut.length !== 14) {
    errors.push('Invalid CAE (must be 14 digits)');
  }

  if (data.importe < 0) {
    errors.push('Invalid amount');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
