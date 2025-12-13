/**
 * Location Billing Module
 * =======================
 *
 * Zone billing and invoicing support.
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
