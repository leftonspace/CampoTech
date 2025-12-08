/**
 * MercadoPago Cuotas (Installments) Module
 * ========================================
 *
 * Installment plans and TEA/CFT calculation
 */

export {
  calculateTEACFT,
  fetchInstallmentOptions,
  processInstallmentOptions,
  getInstallmentOptionsForDisplay,
  validateInstallmentPlan,
  getInterestFreeOptions,
  getBestInstallmentOption,
} from './cuotas.calculator';

export type {
  InstallmentOption,
  PromotionalInstallment,
} from './cuotas.calculator';
