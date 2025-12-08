/**
 * AFIP Integration Module
 * =======================
 *
 * Complete integration with AFIP (Administración Federal de Ingresos Públicos)
 * for electronic invoicing in Argentina.
 *
 * Components:
 * - WSAA: Authentication (Web Service de Autenticación y Autorización)
 * - WSFEv1: Electronic Invoicing (Web Service de Factura Electrónica v1)
 * - Padron: Taxpayer Lookup (WS_SR_PADRON)
 * - QR Generator: Invoice QR codes per RG 4291
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export * from './afip.types';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export { AFIPService, getAFIPService, resetAFIPService } from './afip.service';

// ═══════════════════════════════════════════════════════════════════════════════
// WSAA (AUTHENTICATION)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createSignedTRA,
  generateTRAXml,
  signTRA,
  getCachedToken,
  setCachedToken,
  invalidateToken,
  invalidateAllTokens,
  clearCache,
  cleanupExpiredTokens,
  getCacheStats,
  TokenManager,
  WSAAClient,
  getWSAAClient,
  resetWSAAClient,
} from './wsaa';

// ═══════════════════════════════════════════════════════════════════════════════
// WSFE (ELECTRONIC INVOICING)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  formatAFIPDate,
  parseAFIPDate,
  roundAmount,
  validateAmount,
  buildIVAItems,
  buildCabRequest,
  buildDetRequest,
  buildCAERequest,
  determineInvoiceType,
  getDocumentType,
  WSFEClient,
  getWSFEClient,
  resetWSFEClient,
  reserveInvoiceNumber,
  syncSequenceWithAFIP,
  requestCAE,
  requestCAEBatch,
  shouldRetryCAE,
  getRetryDelay,
} from './wsfe';
export type { CAERequestResult } from './wsfe';

// ═══════════════════════════════════════════════════════════════════════════════
// PADRON (CUIT LOOKUP)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  CUITLookupClient,
  getCUITLookupClient,
  resetCUITLookupClient,
  validateCUITFormat,
  formatCUIT,
  cleanCUIT,
} from './padron';

// ═══════════════════════════════════════════════════════════════════════════════
// QR CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  buildQRCodeData,
  generateQRUrl,
  decodeQRUrl,
  generateQRSvg,
  generateQRBase64,
  generateInvoiceQR,
  validateQRData,
} from './qr-generator';
export type { QRGenerationResult } from './qr-generator';
