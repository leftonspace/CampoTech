/**
 * AFIP Invoice Builder
 * ====================
 *
 * Builds the FECAESolicitar request payload from application invoice data.
 */

import {
  AFIPInvoiceInput,
  AFIPInvoiceType,
  AFIPDocumentType,
  AFIPConceptType,
  AFIPCurrency,
  FECAERequest,
  FECAECabRequest,
  FECAEDetRequest,
  FECAEIVAItem,
  WSFEAuth,
  AFIP_IVA_RATES,
} from '../afip.types';

// ═══════════════════════════════════════════════════════════════════════════════
// DATE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format date to AFIP format (YYYYMMDD)
 */
export function formatAFIPDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parse AFIP date (YYYYMMDD) to Date
 */
export function parseAFIPDate(afipDate: string): Date {
  const year = parseInt(afipDate.substring(0, 4), 10);
  const month = parseInt(afipDate.substring(4, 6), 10) - 1;
  const day = parseInt(afipDate.substring(6, 8), 10);
  return new Date(year, month, day);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMOUNT FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Round to 2 decimal places for AFIP
 */
export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Validate amount is within AFIP limits
 */
export function validateAmount(amount: number, fieldName: string): void {
  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  if (amount > 999999999.99) {
    throw new Error(`${fieldName} exceeds maximum allowed amount`);
  }
  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IVA BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build IVA items array for AFIP request
 */
export function buildIVAItems(
  ivaBreakdown: AFIPInvoiceInput['ivaBreakdown']
): FECAEIVAItem[] {
  return ivaBreakdown
    .filter(item => item.amount > 0)
    .map(item => {
      const ivaConfig = AFIP_IVA_RATES[item.rate];
      if (!ivaConfig) {
        throw new Error(`Unsupported IVA rate: ${item.rate}`);
      }

      return {
        Id: ivaConfig.code,
        BaseImp: roundAmount(item.base),
        Importe: roundAmount(item.amount),
      };
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the FECAECabRequest (header)
 */
export function buildCabRequest(
  puntoVenta: number,
  invoiceType: AFIPInvoiceType
): FECAECabRequest {
  return {
    CantReg: 1,
    PtoVta: puntoVenta,
    CbteTipo: invoiceType,
  };
}

/**
 * Build the FECAEDetRequest (detail)
 */
export function buildDetRequest(
  invoice: AFIPInvoiceInput,
  invoiceNumber: number
): FECAEDetRequest {
  // Validate amounts
  validateAmount(invoice.total, 'total');
  validateAmount(invoice.subtotal, 'subtotal');
  validateAmount(invoice.taxAmount, 'taxAmount');

  // Check totals match
  const calculatedTotal = roundAmount(invoice.subtotal + invoice.taxAmount);
  const providedTotal = roundAmount(invoice.total);
  if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
    throw new Error(
      `Total mismatch: subtotal (${invoice.subtotal}) + tax (${invoice.taxAmount}) = ${calculatedTotal}, but total is ${invoice.total}`
    );
  }

  // Build IVA items
  const ivaItems = buildIVAItems(invoice.ivaBreakdown);

  // Base request
  const detRequest: FECAEDetRequest = {
    Concepto: invoice.concept,
    DocTipo: invoice.customerDocType,
    DocNro: invoice.customerCuit,
    CbteDesde: invoiceNumber,
    CbteHasta: invoiceNumber,
    CbteFch: formatAFIPDate(invoice.emissionDate),
    ImpTotal: roundAmount(invoice.total),
    ImpTotConc: 0,  // Non-taxable (usually 0)
    ImpNeto: roundAmount(invoice.subtotal),
    ImpOpEx: 0,     // Exempt (usually 0)
    ImpIVA: roundAmount(invoice.taxAmount),
    ImpTrib: 0,     // Other taxes (usually 0)
    MonId: AFIPCurrency.PESOS,
    MonCotiz: 1,
  };

  // Add IVA breakdown if present
  if (ivaItems.length > 0) {
    detRequest.Iva = ivaItems;
  }

  // Add service dates if concept includes services
  if (invoice.concept === AFIPConceptType.SERVICIOS ||
      invoice.concept === AFIPConceptType.PRODUCTOS_Y_SERVICIOS) {
    if (invoice.serviceStartDate) {
      detRequest.FchServDesde = formatAFIPDate(invoice.serviceStartDate);
    }
    if (invoice.serviceEndDate) {
      detRequest.FchServHasta = formatAFIPDate(invoice.serviceEndDate);
    }
    if (invoice.dueDate) {
      detRequest.FchVtoPago = formatAFIPDate(invoice.dueDate);
    }
  }

  return detRequest;
}

/**
 * Build the complete FECAESolicitar request
 */
export function buildCAERequest(
  auth: WSFEAuth,
  invoice: AFIPInvoiceInput,
  invoiceNumber: number
): FECAERequest {
  return {
    Auth: auth,
    FeCAEReq: {
      FeCabReq: buildCabRequest(invoice.puntoVenta, invoice.invoiceType),
      FeDetReq: {
        FECAEDetRequest: [buildDetRequest(invoice, invoiceNumber)],
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE TYPE DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine invoice type based on IVA conditions
 */
export function determineInvoiceType(
  sellerCondition: 'responsable_inscripto' | 'monotributista' | 'exento',
  buyerCondition: 'responsable_inscripto' | 'monotributista' | 'exento' | 'consumidor_final'
): AFIPInvoiceType {
  // Monotributistas always issue Factura C
  if (sellerCondition === 'monotributista') {
    return AFIPInvoiceType.FACTURA_C;
  }

  // Exentos can't issue invoices (shouldn't happen)
  if (sellerCondition === 'exento') {
    throw new Error('Exento sellers cannot issue electronic invoices');
  }

  // Responsable Inscripto seller
  if (sellerCondition === 'responsable_inscripto') {
    // To Responsable Inscripto or Monotributista → Factura A
    if (buyerCondition === 'responsable_inscripto' || buyerCondition === 'monotributista') {
      return AFIPInvoiceType.FACTURA_A;
    }
    // To Consumidor Final, Exento, or others → Factura B
    return AFIPInvoiceType.FACTURA_B;
  }

  // Default to B
  return AFIPInvoiceType.FACTURA_B;
}

/**
 * Get document type for customer
 */
export function getDocumentType(
  cuit: string | null,
  dni: string | null
): { docType: AFIPDocumentType; docNro: string } {
  if (cuit && cuit.length === 11) {
    return { docType: AFIPDocumentType.CUIT, docNro: cuit };
  }
  if (dni && dni.length >= 7) {
    return { docType: AFIPDocumentType.DNI, docNro: dni };
  }
  // Consumidor final
  return { docType: AFIPDocumentType.CONSUMIDOR_FINAL, docNro: '0' };
}
