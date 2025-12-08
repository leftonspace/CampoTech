/**
 * MercadoPago Installments (Cuotas) Calculator
 * ============================================
 *
 * Handles installment plans and TEA/CFT calculation for BCRA compliance.
 * Supports fetching installment options from MercadoPago and calculating
 * the true financial cost.
 */

import {
  InstallmentsResponse,
  PayerCost,
  TEACFTResult,
  PaymentMethodId,
} from '../mercadopago.types';
import { makeAuthenticatedRequest } from '../oauth';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TEA/CFT CALCULATION (BCRA COMPLIANCE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate TEA (Tasa Efectiva Anual) and CFT (Costo Financiero Total)
 * Required by BCRA regulation for consumer credit transparency
 *
 * @param amount - Original purchase amount
 * @param installments - Number of installments
 * @param installmentAmount - Amount per installment
 * @param totalAmount - Total amount to be paid
 */
export function calculateTEACFT(
  amount: number,
  installments: number,
  installmentAmount: number,
  totalAmount: number
): TEACFTResult {
  // If no financing (1 installment or no interest)
  if (installments <= 1 || totalAmount <= amount) {
    return {
      tea: 0,
      cft: 0,
      cftLabel: 'CFT: 0.00%',
      monthlyRate: 0,
      totalInterest: 0,
    };
  }

  const totalInterest = totalAmount - amount;

  // Calculate monthly rate using Newton-Raphson method
  // for solving: amount = sum(installmentAmount / (1 + r)^i) for i = 1 to n
  const monthlyRate = calculateMonthlyRate(amount, installmentAmount, installments);

  // TEA = (1 + monthly_rate)^12 - 1
  const tea = (Math.pow(1 + monthlyRate, 12) - 1) * 100;

  // CFT includes additional costs (IVA on interest, insurance, etc.)
  // For simplicity, we estimate CFT as TEA + ~21% (IVA on financial services)
  const cft = tea * 1.21;

  return {
    tea: roundToDecimals(tea, 2),
    cft: roundToDecimals(cft, 2),
    cftLabel: `CFT: ${roundToDecimals(cft, 2).toFixed(2)}%`,
    monthlyRate: roundToDecimals(monthlyRate * 100, 4),
    totalInterest: roundToDecimals(totalInterest, 2),
  };
}

/**
 * Calculate monthly interest rate using Newton-Raphson method
 * Solves: PV = PMT * [(1 - (1 + r)^-n) / r]
 */
function calculateMonthlyRate(
  presentValue: number,
  payment: number,
  periods: number
): number {
  let rate = 0.01; // Initial guess: 1%
  const tolerance = 0.0000001;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const f = presentValue - payment * ((1 - Math.pow(1 + rate, -periods)) / rate);
    const fPrime =
      payment *
      ((1 - Math.pow(1 + rate, -periods)) / (rate * rate) -
        (periods * Math.pow(1 + rate, -periods - 1)) / rate);

    const newRate = rate - f / fPrime;

    if (Math.abs(newRate - rate) < tolerance) {
      return Math.max(0, newRate);
    }

    rate = newRate;

    // Prevent negative or extreme rates
    if (rate < 0) rate = 0.001;
    if (rate > 1) rate = 0.5;
  }

  // Fallback: simple calculation if Newton-Raphson doesn't converge
  const totalInterest = payment * periods - presentValue;
  return totalInterest / (presentValue * periods);
}

/**
 * Round to specified decimal places
 */
function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLMENT OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface InstallmentOption {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  rate: number;
  isInterestFree: boolean;
  tea: number;
  cft: number;
  cftLabel: string;
  label: string;
}

/**
 * Fetch installment options from MercadoPago
 */
export async function fetchInstallmentOptions(
  accessToken: string,
  amount: number,
  paymentMethodId?: PaymentMethodId,
  issuerId?: string
): Promise<{ success: true; options: InstallmentsResponse[] } | { success: false; error: string }> {
  const params = new URLSearchParams({
    amount: amount.toString(),
  });

  if (paymentMethodId) {
    params.append('payment_method_id', paymentMethodId);
  }

  if (issuerId) {
    params.append('issuer.id', issuerId);
  }

  const result = await makeAuthenticatedRequest<InstallmentsResponse[]>(
    accessToken,
    'GET',
    `/v1/payment_methods/installments?${params.toString()}`
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, options: result.data };
}

/**
 * Process raw installment response into display-friendly options
 */
export function processInstallmentOptions(
  amount: number,
  payerCosts: PayerCost[]
): InstallmentOption[] {
  return payerCosts.map((cost) => {
    const teaCft = calculateTEACFT(
      amount,
      cost.installments,
      cost.installmentAmount,
      cost.totalAmount
    );

    const isInterestFree = cost.installmentRate === 0 || cost.totalAmount <= amount;

    let label: string;
    if (cost.installments === 1) {
      label = '1 pago';
    } else if (isInterestFree) {
      label = `${cost.installments} cuotas sin interés de $${cost.installmentAmount.toFixed(2)}`;
    } else {
      label = `${cost.installments} cuotas de $${cost.installmentAmount.toFixed(2)} (${teaCft.cftLabel})`;
    }

    return {
      installments: cost.installments,
      installmentAmount: cost.installmentAmount,
      totalAmount: cost.totalAmount,
      rate: cost.installmentRate,
      isInterestFree,
      tea: teaCft.tea,
      cft: teaCft.cft,
      cftLabel: teaCft.cftLabel,
      label,
    };
  });
}

/**
 * Get installment options for display
 */
export async function getInstallmentOptionsForDisplay(
  accessToken: string,
  amount: number,
  paymentMethodId?: PaymentMethodId
): Promise<{ success: true; options: InstallmentOption[] } | { success: false; error: string }> {
  const fetchResult = await fetchInstallmentOptions(accessToken, amount, paymentMethodId);

  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error };
  }

  // Combine all payer costs from all responses
  const allPayerCosts: PayerCost[] = [];
  for (const response of fetchResult.options) {
    allPayerCosts.push(...response.payerCosts);
  }

  // Remove duplicates by installment count (keep lowest rate)
  const uniqueCosts = new Map<number, PayerCost>();
  for (const cost of allPayerCosts) {
    const existing = uniqueCosts.get(cost.installments);
    if (!existing || cost.installmentRate < existing.installmentRate) {
      uniqueCosts.set(cost.installments, cost);
    }
  }

  // Sort by installment count
  const sortedCosts = Array.from(uniqueCosts.values()).sort(
    (a, b) => a.installments - b.installments
  );

  const options = processInstallmentOptions(amount, sortedCosts);

  return { success: true, options };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate if installment plan is available for amount
 */
export function validateInstallmentPlan(
  amount: number,
  installments: number,
  payerCosts: PayerCost[]
): { valid: boolean; error?: string; payerCost?: PayerCost } {
  const cost = payerCosts.find((c) => c.installments === installments);

  if (!cost) {
    return {
      valid: false,
      error: `${installments} cuotas no disponible para este medio de pago`,
    };
  }

  if (amount < cost.minAllowedAmount) {
    return {
      valid: false,
      error: `Monto mínimo para ${installments} cuotas: $${cost.minAllowedAmount}`,
    };
  }

  if (amount > cost.maxAllowedAmount) {
    return {
      valid: false,
      error: `Monto máximo para ${installments} cuotas: $${cost.maxAllowedAmount}`,
    };
  }

  return { valid: true, payerCost: cost };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOTIONAL HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export interface PromotionalInstallment {
  installments: number;
  promotionId: string;
  label: string;
  isInterestFree: boolean;
  validUntil?: Date;
}

/**
 * Filter interest-free installment options
 */
export function getInterestFreeOptions(payerCosts: PayerCost[]): PayerCost[] {
  return payerCosts.filter((cost) => cost.installmentRate === 0 && cost.installments > 1);
}

/**
 * Get best installment option (most installments at lowest rate)
 */
export function getBestInstallmentOption(payerCosts: PayerCost[]): PayerCost | null {
  if (payerCosts.length === 0) return null;

  // First try to find interest-free options
  const interestFree = getInterestFreeOptions(payerCosts);
  if (interestFree.length > 0) {
    return interestFree.reduce((best, current) =>
      current.installments > best.installments ? current : best
    );
  }

  // Otherwise, find lowest rate with most installments
  return payerCosts.reduce((best, current) => {
    if (current.installmentRate < best.installmentRate) return current;
    if (
      current.installmentRate === best.installmentRate &&
      current.installments > best.installments
    ) {
      return current;
    }
    return best;
  });
}
