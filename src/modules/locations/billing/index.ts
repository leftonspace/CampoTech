/**
 * Location Billing Module
 * =======================
 *
 * Multi-location billing and invoicing support.
 */

// Punto de Venta Manager
export {
  PuntoVentaManager,
  getPuntoVentaManager,
  PuntoVentaError,
  type PuntoVentaConfig,
  type NextInvoiceNumber,
  type InvoiceNumberUpdate,
  type InvoiceType,
  type NotaCreditoType,
} from './punto-venta-manager';

// Location Invoice Router
export {
  LocationInvoiceRouter,
  getLocationInvoiceRouter,
  InvoiceRoutingError,
  type InvoiceRoutingResult,
  type InvoiceRoutingInput,
  type RoutingReason,
  type LocationWithAfipConfig,
} from './location-invoice-router';

// Consolidated Billing
export {
  ConsolidatedBillingService,
  getConsolidatedBillingService,
  ConsolidatedBillingError,
  type ConsolidatedInvoiceItem,
  type ConsolidatedInvoiceInput,
  type ConsolidatedInvoiceSummary,
  type LocationBillingSummary,
  type OrganizationBillingReport,
  type PendingBillingItem,
} from './consolidated-billing';

// Inter-Location Charges
export {
  InterLocationChargesService,
  getInterLocationChargesService,
  InterLocationChargeError,
  type InterLocationCharge,
  type ChargeType,
  type ReferenceType,
  type ChargeStatus,
  type CreateChargeInput,
  type SettlementSummary,
  type LocationBalance,
} from './inter-location-charges';
