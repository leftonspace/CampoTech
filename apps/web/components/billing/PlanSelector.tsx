'use client';

/**
 * Plan Selector Component
 * =======================
 *
 * Displays subscription plans with monthly/yearly toggle.
 * Shows pricing, features, and allows plan selection.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanData {
  tier: string;
  name: string;
  description: string;
  features: string[];
  monthly: {
    price: number;
    priceFormatted: string;
  };
  yearly: {
    price: number;
    priceFormatted: string;
    savings: number;
  };
}

export interface PlanSelectorProps {
  plans: PlanData[];
  currentTier?: string;
  currentCycle?: 'MONTHLY' | 'YEARLY';
  onSelectPlan?: (tier: string, cycle: 'MONTHLY' | 'YEARLY') => void;
  isLoading?: boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PlanSelector({
  plans,
  currentTier,
  currentCycle = 'MONTHLY',
  onSelectPlan,
  isLoading = false,
  className,
}: PlanSelectorProps) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>(currentCycle);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Calculate yearly savings
  const yearlySavings = plans.reduce((max, plan) => {
    const monthlyCost = plan.monthly.price * 12;
    const yearlyCost = plan.yearly.price;
    const savings = monthlyCost - yearlyCost;
    return savings > max ? savings : max;
  }, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSelectPlan = async (tier: string) => {
    if (tier === currentTier && billingCycle === currentCycle) return;
    if (tier === 'FREE') return;

    setSelectedPlan(tier);

    if (onSelectPlan) {
      onSelectPlan(tier, billingCycle);
    } else {
      // Default: redirect to checkout
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/subscription/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            tier,
            billingCycle,
          }),
        });

        const data = await response.json();

        if (data.success && data.data.checkoutUrl) {
          window.location.href = data.data.checkoutUrl;
        } else {
          console.error('Checkout failed:', data.error);
          alert(data.error || 'Error al crear el checkout');
          setSelectedPlan(null);
        }
      } catch (error) {
        console.error('Checkout error:', error);
        alert('Error al conectar con el servidor');
        setSelectedPlan(null);
      }
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Billing Cycle Toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-all',
              billingCycle === 'MONTHLY'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Mensual
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-all',
              billingCycle === 'YEARLY'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Anual
          </button>
        </div>

        {billingCycle === 'YEARLY' && yearlySavings > 0 && (
          <div className="flex items-center gap-2 text-success-600 text-sm font-medium animate-fade-in">
            <Sparkles className="h-4 w-4" />
            Ahorrás {formatCurrency(yearlySavings)} al año
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isPopular = plan.tier === 'PROFESIONAL';
          const price = billingCycle === 'MONTHLY' ? plan.monthly : plan.yearly;
          const isSelecting = selectedPlan === plan.tier;

          return (
            <div
              key={plan.tier}
              className={cn(
                'relative flex flex-col p-6 rounded-2xl border-2 transition-all',
                isCurrent
                  ? 'border-primary-500 bg-primary-50 shadow-lg'
                  : isPopular
                    ? 'border-primary-300 bg-white shadow-md hover:shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* Popular Badge */}
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-full">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-full">
                    <Check className="h-3 w-3" />
                    Plan Actual
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {price.priceFormatted}
                  </span>
                  <span className="text-gray-500">
                    /{billingCycle === 'MONTHLY' ? 'mes' : 'año'}
                  </span>
                </div>
                {billingCycle === 'YEARLY' && plan.yearly.savings > 0 && (
                  <p className="text-sm text-success-600 mt-1">
                    {plan.yearly.savings}% de ahorro
                  </p>
                )}
                {billingCycle === 'YEARLY' && (
                  <p className="text-xs text-gray-400 mt-1">
                    ({formatCurrency(plan.yearly.price / 12)}/mes)
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.tier)}
                disabled={isCurrent || isLoading || isSelecting || plan.tier === 'FREE'}
                className={cn(
                  'w-full py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                  isCurrent
                    ? 'bg-primary-100 text-primary-700 cursor-default'
                    : plan.tier === 'FREE'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isPopular
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                )}
              >
                {isSelecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : isCurrent ? (
                  'Plan Actual'
                ) : plan.tier === 'FREE' ? (
                  'Plan Gratuito'
                ) : (
                  <>
                    Elegir {plan.name}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment Info */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Pago seguro procesado por{' '}
          <span className="font-medium text-blue-500">Mercado Pago</span>
        </p>
        <p className="mt-1">
          Aceptamos tarjetas de crédito, débito, transferencia y efectivo
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default PlanSelector;
