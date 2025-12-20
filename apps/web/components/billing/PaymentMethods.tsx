/**
 * Payment Methods Component
 * =========================
 *
 * Displays accepted payment methods with icons and cuotas information.
 * Shows credit cards, debit cards, cash, transfer, and MercadoPago wallet options.
 */

'use client';

import { CreditCard, Landmark, Wallet, Store, Smartphone, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentMethodsProps {
  /** Show compact version */
  compact?: boolean;
  /** Show cuotas information */
  showCuotas?: boolean;
  /** Additional class names */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD BRAND IMAGES (using official brand colors for recognition)
// ═══════════════════════════════════════════════════════════════════════════════

const CARD_BRANDS = {
  visa: { name: 'Visa', bgColor: 'bg-blue-600', textColor: 'text-white' },
  mastercard: { name: 'Mastercard', bgColor: 'bg-red-500', textColor: 'text-white' },
  amex: { name: 'Amex', bgColor: 'bg-blue-500', textColor: 'text-white' },
  naranja: { name: 'Naranja', bgColor: 'bg-orange-500', textColor: 'text-white' },
  cabal: { name: 'Cabal', bgColor: 'bg-blue-700', textColor: 'text-white' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PaymentMethods({
  compact = false,
  showCuotas = true,
  className,
}: PaymentMethodsProps) {
  if (compact) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {Object.entries(CARD_BRANDS).map(([key, brand]) => (
          <span
            key={key}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              brand.bgColor,
              brand.textColor
            )}
            title={brand.name}
          >
            {brand.name}
          </span>
        ))}
        <span className="text-xs text-gray-500">+ más métodos</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Credit Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Tarjetas de crédito</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CARD_BRANDS).map(([key, brand]) => (
            <span
              key={key}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium',
                brand.bgColor,
                brand.textColor
              )}
            >
              {brand.name}
            </span>
          ))}
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 text-gray-700">
            Diners
          </span>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 text-gray-700">
            Y más
          </span>
        </div>
        {showCuotas && (
          <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
            <Info className="h-4 w-4" />
            Hasta 12 cuotas disponibles
          </p>
        )}
      </div>

      {/* Debit Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Tarjetas de débito</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white">
            Visa Débito
          </span>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-500 text-white">
            Mastercard Débito
          </span>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-500 text-white">
            Maestro
          </span>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white">
            Cabal Débito
          </span>
        </div>
      </div>

      {/* Cash */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Store className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Pago en efectivo</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white">
            Pago Fácil
          </span>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white">
            Rapipago
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Recibirás un código para pagar en cualquier sucursal. El pago se acredita en 1-2 horas.
        </p>
      </div>

      {/* Bank Transfer */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Transferencia bancaria</h3>
        </div>
        <p className="text-sm text-gray-500">
          Podés transferir desde tu homebanking o app de banco. Se acredita en 24-48 horas hábiles.
        </p>
      </div>

      {/* MercadoPago Wallet */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Dinero en cuenta</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-400 text-white flex items-center gap-1">
            <Smartphone className="h-4 w-4" />
            Mercado Pago
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Usá el saldo de tu cuenta de Mercado Pago para pagar al instante.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUOTAS INFO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface CuotasInfoProps {
  /** Price to show cuotas for */
  price: number;
  /** Maximum installments */
  maxInstallments?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Shows installment (cuotas) options for a given price
 */
export function CuotasInfo({
  price,
  maxInstallments = 12,
  className,
}: CuotasInfoProps) {
  // Calculate example cuota values
  const cuotasOptions = [
    { count: 1, label: 'Pago único', amount: price, interestFree: true },
    { count: 3, label: '3 cuotas', amount: price / 3, interestFree: true },
    { count: 6, label: '6 cuotas', amount: price / 6 * 1.1, interestFree: false },
    { count: 12, label: '12 cuotas', amount: price / 12 * 1.2, interestFree: false },
  ].filter(c => c.count <= maxInstallments);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-gray-700">Opciones de pago</h4>
      <div className="space-y-1">
        {cuotasOptions.map((option) => (
          <div
            key={option.count}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-gray-600">
              {option.label}
              {option.interestFree && (
                <span className="ml-1 text-xs text-success-600 font-medium">
                  sin interés
                </span>
              )}
            </span>
            <span className="font-medium text-gray-900">
              {option.count > 1 && `${option.count} x `}
              {formatCurrency(option.amount)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        * Las cuotas sin interés pueden variar según la tarjeta y promociones vigentes
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASH PAYMENT INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CashPaymentInstructionsProps {
  /** Payment code (from MercadoPago) */
  paymentCode?: string;
  /** Expiration date */
  expiresAt?: Date;
  /** Additional class names */
  className?: string;
}

/**
 * Shows instructions for cash payment at Pago Fácil / Rapipago
 */
export function CashPaymentInstructions({
  paymentCode,
  expiresAt,
  className,
}: CashPaymentInstructionsProps) {
  return (
    <div className={cn('bg-amber-50 rounded-lg p-4', className)}>
      <h3 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
        <Store className="h-5 w-5" />
        Cómo pagar en efectivo
      </h3>

      <ol className="space-y-3 text-sm text-amber-800">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
            1
          </span>
          <span>
            Acercate a cualquier sucursal de <strong>Pago Fácil</strong> o{' '}
            <strong>Rapipago</strong>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
            2
          </span>
          <span>Indicá que querés pagar a Mercado Pago</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
            3
          </span>
          <span>
            Proporcioná el código:{' '}
            {paymentCode ? (
              <strong className="font-mono">{paymentCode}</strong>
            ) : (
              <span className="text-gray-500">(se genera al confirmar)</span>
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
            4
          </span>
          <span>Realizá el pago y guardá el comprobante</span>
        </li>
      </ol>

      {expiresAt && (
        <p className="mt-3 text-xs text-amber-600 border-t border-amber-200 pt-3">
          El código vence el{' '}
          {expiresAt.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-amber-200">
        <a
          href="https://www.google.com/maps/search/pago+facil+o+rapipago"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 text-sm font-medium"
        >
          <Store className="h-4 w-4" />
          Encontrar sucursal cercana
        </a>
      </div>
    </div>
  );
}

export default PaymentMethods;
