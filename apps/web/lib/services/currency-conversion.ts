/**
 * Currency Conversion Utilities
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * Simple functions for USD/ARS conversion in the pricebook context.
 * Uses the ExchangeRateService for actual rate fetching.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { convertUsdToArs, convertArsToUsd, getExchangeRate, ExchangeRateSource } from './exchange-rate.service';
import { applySmartRounding, RoundingConfig } from './smart-rounding';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceConversionResult {
    originalCurrency: 'USD' | 'ARS';
    originalAmount: number;
    convertedCurrency: 'USD' | 'ARS';
    convertedAmount: number;
    exchangeRate: number;
    exchangeRateSource: ExchangeRateSource;
    isStale: boolean;
    roundedAmount?: number;
}

export interface ConversionOptions {
    source?: ExchangeRateSource;
    markup?: number;
    rounding?: RoundingConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate ARS price from USD price item
 * 
 * @param usdPrice - Price in USD
 * @param options - Conversion options (source, markup, rounding)
 * @returns Conversion result with all details
 */
export async function calculateARSFromUSD(
    usdPrice: number | Decimal,
    options: ConversionOptions = {}
): Promise<PriceConversionResult> {
    const {
        source = 'BLUE',
        markup = 0,
        rounding,
    } = options;

    const usdAmount = typeof usdPrice === 'number' ? usdPrice : usdPrice.toNumber();

    const { arsAmount, rate, isStale } = await convertUsdToArs(usdAmount, source, markup);

    let finalAmount = arsAmount;

    // Apply rounding if configured
    if (rounding) {
        const rounded = applySmartRounding(arsAmount, rounding.strategy, rounding.direction);
        finalAmount = rounded.toNumber();
    }

    return {
        originalCurrency: 'USD',
        originalAmount: usdAmount,
        convertedCurrency: 'ARS',
        convertedAmount: arsAmount,
        exchangeRate: rate,
        exchangeRateSource: source,
        isStale,
        roundedAmount: rounding ? finalAmount : undefined,
    };
}

/**
 * Calculate USD equivalent for an ARS price
 * (Primarily for display purposes)
 */
export async function calculateUSDFromARS(
    arsPrice: number | Decimal,
    options: ConversionOptions = {}
): Promise<PriceConversionResult> {
    const { source = 'BLUE' } = options;

    const arsAmount = typeof arsPrice === 'number' ? arsPrice : arsPrice.toNumber();

    const { usdAmount, rate, isStale } = await convertArsToUsd(arsAmount, source);

    return {
        originalCurrency: 'ARS',
        originalAmount: arsAmount,
        convertedCurrency: 'USD',
        convertedAmount: usdAmount,
        exchangeRate: rate,
        exchangeRateSource: source,
        isStale,
    };
}

/**
 * Get the effective ARS price for a price item
 * Handles both ARS and USD-denominated items
 */
export async function getEffectiveARSPrice(
    price: number | Decimal,
    currency: 'ARS' | 'USD',
    options: ConversionOptions = {}
): Promise<{
    arsPrice: number;
    exchangeRate?: number;
    isConverted: boolean;
    isStale: boolean;
}> {
    const priceNum = typeof price === 'number' ? price : price.toNumber();

    if (currency === 'ARS') {
        // No conversion needed
        let finalPrice = priceNum;

        if (options.rounding) {
            finalPrice = applySmartRounding(priceNum, options.rounding.strategy, options.rounding.direction).toNumber();
        }

        return {
            arsPrice: finalPrice,
            isConverted: false,
            isStale: false,
        };
    }

    // USD conversion needed
    const result = await calculateARSFromUSD(priceNum, options);

    return {
        arsPrice: result.roundedAmount ?? result.convertedAmount,
        exchangeRate: result.exchangeRate,
        isConverted: true,
        isStale: result.isStale,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JITTER CONTROL (ANCHOR LOGIC)
// ═══════════════════════════════════════════════════════════════════════════════

export interface JitterControlResult {
    shouldUpdate: boolean;
    percentChange: number;
    direction: 'UP' | 'DOWN';
    anchorRate: number;
    currentRate: number;
}

/**
 * Check if exchange rate change warrants a price update notification
 * Compares current rate against the "anchor" rate (rate at last price update)
 */
export async function checkExchangeRateThreshold(
    anchorRate: number | Decimal,
    threshold: number,
    source: ExchangeRateSource = 'BLUE'
): Promise<JitterControlResult> {
    const anchorRateNum = typeof anchorRate === 'number' ? anchorRate : anchorRate.toNumber();

    const currentRateData = await getExchangeRate(source);
    const currentRate = currentRateData.sellRate.toNumber();

    // Calculate percentage change from anchor
    const change = currentRate - anchorRateNum;
    const percentChange = (Math.abs(change) / anchorRateNum) * 100;

    const direction = change >= 0 ? 'UP' : 'DOWN';
    const shouldUpdate = percentChange >= threshold;

    return {
        shouldUpdate,
        percentChange,
        direction,
        anchorRate: anchorRateNum,
        currentRate,
    };
}

/**
 * Get progress towards threshold (for UI display)
 * e.g., "Faltan ~2.4% para activar notificación"
 */
export function getThresholdProgress(
    percentChange: number,
    threshold: number
): { progress: number; remaining: number } {
    const progress = Math.min((percentChange / threshold) * 100, 100);
    const remaining = Math.max(threshold - percentChange, 0);

    return { progress, remaining };
}
