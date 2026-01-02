/**
 * Coupon Validation API
 * =====================
 *
 * POST /api/subscription/validate-coupon - Validate a coupon code and calculate discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS } from '@/lib/mercadopago/config';
import type { SubscriptionTier } from '@/lib/config/tier-limits';
import type { BillingCycle } from '@/lib/types/subscription';

interface DiscountCalculation {
  originalPrice: number;
  discountedPrice: number;
  amountSaved: number;
  discountDescription: string;
  freeMonths?: number;
  discountedMonths?: number;
  discountPercentage?: number;
}

function calculateDiscount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coupon: any,
  tier: Exclude<SubscriptionTier, 'FREE'>,
  billingCycle: BillingCycle
): DiscountCalculation {
  const plan = SUBSCRIPTION_PLANS[tier];
  const basePrice = billingCycle === 'MONTHLY'
    ? plan.monthly.priceARS
    : plan.yearly.priceARS;

  let discountedPrice = basePrice;
  let discountDescription = '';
  let freeMonths: number | undefined;
  let discountedMonths: number | undefined;
  let discountPercentage: number | undefined;

  switch (coupon.discountType) {
    case 'PERCENTAGE':
      discountPercentage = Number(coupon.percentageOff);
      discountedPrice = basePrice * (1 - discountPercentage / 100);
      discountDescription = `${discountPercentage}% de descuento`;
      break;

    case 'FREE_MONTHS': {
      const months = coupon.freeMonths ?? 0;
      freeMonths = months;
      if (billingCycle === 'MONTHLY') {
        discountedPrice = 0; // First payment is free
        discountDescription = `${months} ${months === 1 ? 'mes' : 'meses'} gratis`;
      } else {
        // For yearly, calculate proportional discount
        const monthlyRate = plan.monthly.priceARS;
        const savedAmount = monthlyRate * months;
        discountedPrice = Math.max(0, basePrice - savedAmount);
        discountDescription = `${months} meses gratis incluidos`;
      }
      break;
    }

    case 'FIXED_AMOUNT':
      const fixedAmount = Number(coupon.fixedAmountOff);
      discountedPrice = Math.max(0, basePrice - fixedAmount);
      discountDescription = `$${fixedAmount.toLocaleString('es-AR')} de descuento`;
      break;

    case 'COMBINED':
      freeMonths = coupon.combinedFreeMonths;
      discountPercentage = Number(coupon.combinedPercentageOff);
      discountedMonths = coupon.combinedPercentageMonths;

      if (billingCycle === 'MONTHLY') {
        discountedPrice = 0; // First payment free
        discountDescription = `${freeMonths} ${freeMonths === 1 ? 'mes' : 'meses'} gratis, luego ${discountPercentage}% off por ${discountedMonths} meses`;
      } else {
        // For yearly, calculate combined savings
        const monthlyRate = plan.monthly.priceARS;
        const freeSavings = monthlyRate * (freeMonths || 0);
        const discountedMonthsSavings = monthlyRate * (discountedMonths || 0) * (discountPercentage || 0) / 100;
        discountedPrice = Math.max(0, basePrice - freeSavings - discountedMonthsSavings);
        discountDescription = `${freeMonths} meses gratis + ${discountPercentage}% off`;
      }
      break;
  }

  return {
    originalPrice: basePrice,
    discountedPrice: Math.round(discountedPrice),
    amountSaved: Math.round(basePrice - discountedPrice),
    discountDescription,
    freeMonths,
    discountedMonths,
    discountPercentage,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, tier, billingCycle } = body as {
      code: string;
      tier: string;
      billingCycle: string;
    };

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código de cupón requerido' },
        { status: 400 }
      );
    }

    // Find the coupon
    const coupon = await prisma.couponCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Código de cupón inválido' },
        { status: 404 }
      );
    }

    // Check if active
    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: 'Este cupón ya no está activo' },
        { status: 400 }
      );
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validFrom) {
      return NextResponse.json(
        { success: false, error: 'Este cupón aún no está vigente' },
        { status: 400 }
      );
    }

    if (now > coupon.validUntil) {
      return NextResponse.json(
        { success: false, error: 'Este cupón ha expirado' },
        { status: 400 }
      );
    }

    // Check usage limits
    if (coupon.maxTotalUses && coupon.currentUses >= coupon.maxTotalUses) {
      return NextResponse.json(
        { success: false, error: 'Este cupón ha alcanzado su límite de uso' },
        { status: 400 }
      );
    }

    // Check per-organization usage
    const orgUsageCount = await prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        organizationId: session.organizationId,
      },
    });

    if (orgUsageCount >= coupon.maxUsesPerOrg) {
      return NextResponse.json(
        { success: false, error: 'Ya has utilizado este cupón' },
        { status: 400 }
      );
    }

    // Check applicable tiers
    const applicableTiers = coupon.applicableTiers as string[];
    if (applicableTiers.length > 0 && !applicableTiers.includes(tier)) {
      return NextResponse.json(
        { success: false, error: `Este cupón no aplica para el plan ${tier}` },
        { status: 400 }
      );
    }

    // Check applicable billing cycles
    const applicableCycles = coupon.applicableCycles as string[];
    if (applicableCycles.length > 0 && !applicableCycles.includes(billingCycle)) {
      const cycleText = billingCycle === 'MONTHLY' ? 'mensual' : 'anual';
      return NextResponse.json(
        { success: false, error: `Este cupón no aplica para facturación ${cycleText}` },
        { status: 400 }
      );
    }

    // Calculate discount
    const discount = calculateDiscount(
      coupon,
      tier as Exclude<SubscriptionTier, 'FREE'>,
      billingCycle as BillingCycle
    );

    return NextResponse.json({
      success: true,
      data: {
        couponId: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        ...discount,
        // For combined discounts, include tracking info
        ...(coupon.discountType === 'COMBINED' && {
          combinedDetails: {
            freeMonths: coupon.combinedFreeMonths,
            percentageOff: coupon.combinedPercentageOff ? Number(coupon.combinedPercentageOff) : null,
            percentageMonths: coupon.combinedPercentageMonths,
          },
        }),
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al validar el cupón' },
      { status: 500 }
    );
  }
}
