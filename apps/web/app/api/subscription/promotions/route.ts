/**
 * Active Promotions API
 * =====================
 *
 * GET /api/subscription/promotions - Get active website-wide promotions and pricing
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS } from '@/lib/mercadopago/config';

export async function GET() {
  try {
    const now = new Date();

    // Get active global discount
    const activePromotion = await prisma.globalDiscount.findFirst({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    // Get pricing settings
    let pricingSettings = await prisma.pricingSettings.findFirst();
    if (!pricingSettings) {
      pricingSettings = await prisma.pricingSettings.create({
        data: {
          defaultAnnualDiscount: 17,
          showDiscountsPublicly: true,
        },
      });
    }

    // Calculate prices with any active promotion
    const plans = Object.entries(SUBSCRIPTION_PLANS).map(([tier, plan]) => {
      const baseMonthly = plan.monthly.priceARS;
      const baseYearly = plan.yearly.priceARS;

      let promotionMonthly = baseMonthly;
      let promotionYearly = baseYearly;
      let promotionDescription: string | null = null;

      // Check if promotion applies to this tier
      const applicableTiers = (activePromotion?.applicableTiers || []) as string[];
      const appliesToTier = applicableTiers.length === 0 || applicableTiers.includes(tier);

      if (activePromotion && appliesToTier && pricingSettings?.showDiscountsPublicly) {
        const applicableCycles = (activePromotion.applicableCycles || []) as string[];
        const appliesToMonthly = applicableCycles.length === 0 || applicableCycles.includes('MONTHLY');
        const appliesToYearly = applicableCycles.length === 0 || applicableCycles.includes('YEARLY');

        switch (activePromotion.discountType) {
          case 'PERCENTAGE':
            const pctOff = Number(activePromotion.percentageOff);
            if (appliesToMonthly) promotionMonthly = baseMonthly * (1 - pctOff / 100);
            if (appliesToYearly) promotionYearly = baseYearly * (1 - pctOff / 100);
            promotionDescription = `${pctOff}% de descuento`;
            break;

          case 'FREE_MONTHS':
            const freeMonths = activePromotion.freeMonths || 0;
            if (appliesToMonthly) promotionMonthly = 0; // First month free
            if (appliesToYearly) {
              const monthlyRate = baseMonthly;
              promotionYearly = Math.max(0, baseYearly - (monthlyRate * freeMonths));
            }
            promotionDescription = `${freeMonths} ${freeMonths === 1 ? 'mes' : 'meses'} gratis`;
            break;

          case 'FIXED_AMOUNT':
            const fixedOff = Number(activePromotion.fixedAmountOff);
            if (appliesToMonthly) promotionMonthly = Math.max(0, baseMonthly - fixedOff);
            if (appliesToYearly) promotionYearly = Math.max(0, baseYearly - fixedOff);
            promotionDescription = `$${fixedOff.toLocaleString('es-AR')} de descuento`;
            break;

          case 'COMBINED':
            const combFreeMonths = activePromotion.combinedFreeMonths || 0;
            const combPctOff = Number(activePromotion.combinedPercentageOff) || 0;
            const combPctMonths = activePromotion.combinedPercentageMonths || 0;

            if (appliesToMonthly) promotionMonthly = 0; // First month free
            if (appliesToYearly) {
              const monthlyRate = baseMonthly;
              const freeSavings = monthlyRate * combFreeMonths;
              const pctSavings = monthlyRate * combPctMonths * (combPctOff / 100);
              promotionYearly = Math.max(0, baseYearly - freeSavings - pctSavings);
            }
            promotionDescription = `${combFreeMonths} meses gratis + ${combPctOff}% off`;
            break;
        }
      }

      return {
        tier,
        name: plan.name,
        description: plan.description,
        features: plan.features,
        monthly: {
          basePrice: baseMonthly,
          promotionPrice: Math.round(promotionMonthly),
          hasPromotion: promotionMonthly < baseMonthly,
          priceFormatted: new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
          }).format(Math.round(promotionMonthly)),
          basePriceFormatted: new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
          }).format(baseMonthly),
        },
        yearly: {
          basePrice: baseYearly,
          promotionPrice: Math.round(promotionYearly),
          hasPromotion: promotionYearly < baseYearly,
          priceFormatted: new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
          }).format(Math.round(promotionYearly)),
          basePriceFormatted: new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
          }).format(baseYearly),
          savingsPercent: plan.yearly.savingsPercent,
        },
        promotionDescription: promotionDescription,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        plans,
        activePromotion: activePromotion ? {
          id: activePromotion.id,
          name: activePromotion.name,
          description: activePromotion.description,
          bannerText: activePromotion.bannerText,
          badgeText: activePromotion.badgeText,
          validUntil: activePromotion.validUntil.toISOString(),
          discountType: activePromotion.discountType,
        } : null,
        showDiscounts: pricingSettings.showDiscountsPublicly,
        defaultAnnualDiscount: Number(pricingSettings.defaultAnnualDiscount),
      },
    });
  } catch (error) {
    console.error('Promotions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching promotions' },
      { status: 500 }
    );
  }
}
