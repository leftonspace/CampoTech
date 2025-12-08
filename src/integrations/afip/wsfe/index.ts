/**
 * WSFE Module Index
 * =================
 *
 * Web Service de Factura Electrónica v1
 */

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
} from './invoice-builder';

export { WSFEClient, getWSFEClient, resetWSFEClient } from './wsfe.client';

export {
  reserveInvoiceNumber,
  syncSequenceWithAFIP,
  requestCAE,
  requestCAEBatch,
  shouldRetryCAE,
  getRetryDelay,
} from './cae-request';
export type { CAERequestResult } from './cae-request';
