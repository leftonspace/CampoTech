/**
 * Smart Rounding Utility - "El Redondeo"
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * Argentine cash handling convention:
 * Nobody charges $16,020 - rounding to $16,000 or $16,500 looks professional.
 * 
 * Implements configurable rounding strategies for price calculations.
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPORARY TYPES (will be replaced by Prisma imports after migration)
// ═══════════════════════════════════════════════════════════════════════════════

export type RoundingStrategy = 'ROUND_100' | 'ROUND_500' | 'ROUND_1000' | 'ROUND_5000' | 'NO_ROUNDING';
export type RoundingDirection = 'NEAREST' | 'UP' | 'DOWN';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RoundingConfig {
    strategy: RoundingStrategy;
    direction: RoundingDirection;
}

export interface RoundingPreview {
    original: number;
    rounded: number;
    difference: number;
    differencePercent: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rounding unit for each strategy
 */
const ROUNDING_UNITS: Record<RoundingStrategy, number> = {
    ROUND_100: 100,
    ROUND_500: 500,
    ROUND_1000: 1000,
    ROUND_5000: 5000,
    NO_ROUNDING: 1,
};

/**
 * UI Labels for rounding strategies
 */
export const ROUNDING_STRATEGY_LABELS: Record<RoundingStrategy, string> = {
    ROUND_100: 'Redondear a $100',
    ROUND_500: 'Redondear a $500 (Recomendado)',
    ROUND_1000: 'Redondear a $1,000',
    ROUND_5000: 'Redondear a $5,000',
    NO_ROUNDING: 'Sin redondeo',
};

/**
 * UI Labels for rounding directions
 */
export const ROUNDING_DIRECTION_LABELS: Record<RoundingDirection, string> = {
    NEAREST: 'Al más cercano',
    UP: 'Siempre hacia arriba (protege margen)',
    DOWN: 'Siempre hacia abajo (amigable al cliente)',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ROUNDING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply smart rounding to a price
 * 
 * @example
 * // $15,000 + 6.8% = $16,020
 * applySmartRounding(16020, 'ROUND_500', 'NEAREST') // → 16000
 * applySmartRounding(16020, 'ROUND_500', 'UP')      // → 16500
 * applySmartRounding(16020, 'ROUND_500', 'DOWN')    // → 16000
 */
export function applySmartRounding(
    price: number | Decimal,
    strategy: RoundingStrategy,
    direction: RoundingDirection
): Decimal {
    const priceNum = typeof price === 'number' ? price : price.toNumber();
    const roundingUnit = ROUNDING_UNITS[strategy];

    if (roundingUnit === 1) {
        // NO_ROUNDING - return as-is (rounded to 2 decimal places)
        return new Decimal(Math.round(priceNum * 100) / 100);
    }

    let rounded: number;

    switch (direction) {
        case 'UP':
            rounded = Math.ceil(priceNum / roundingUnit) * roundingUnit;
            break;
        case 'DOWN':
            rounded = Math.floor(priceNum / roundingUnit) * roundingUnit;
            break;
        case 'NEAREST':
        default:
            rounded = Math.round(priceNum / roundingUnit) * roundingUnit;
            break;
    }

    return new Decimal(rounded);
}

/**
 * Get a preview of how rounding affects a price
 */
export function getRoundingPreview(
    price: number,
    strategy: RoundingStrategy,
    direction: RoundingDirection
): RoundingPreview {
    const rounded = applySmartRounding(price, strategy, direction).toNumber();
    const difference = rounded - price;
    const differencePercent = price > 0 ? (difference / price) * 100 : 0;

    return {
        original: price,
        rounded,
        difference,
        differencePercent,
    };
}

/**
 * Get previews for all rounding strategies
 */
export function getAllRoundingPreviews(price: number): Record<RoundingStrategy, RoundingPreview> {
    const result: Partial<Record<RoundingStrategy, RoundingPreview>> = {};

    for (const strategy of Object.keys(ROUNDING_UNITS) as RoundingStrategy[]) {
        result[strategy] = getRoundingPreview(price, strategy, 'NEAREST');
    }

    return result as Record<RoundingStrategy, RoundingPreview>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFLATION + ROUNDING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply inflation adjustment with smart rounding
 * 
 * @example
 * // Item: $15,000, Index: 4.8%, Extra: 2%, Strategy: ROUND_500, Direction: NEAREST
 * // Calculation: $15,000 × 1.068 = $16,020
 * // Rounding: $16,020 → $16,000
 */
export function applyInflationWithRounding(
    price: number | Decimal,
    indexRate: number,
    extraPercent: number,
    config: RoundingConfig
): { adjustedPrice: Decimal; beforeRounding: number; roundingDiff: number } {
    const priceNum = typeof price === 'number' ? price : price.toNumber();

    // Calculate total adjustment
    const totalRate = indexRate + extraPercent;
    const multiplier = 1 + totalRate / 100;
    const beforeRounding = priceNum * multiplier;

    // Apply rounding
    const adjustedPrice = applySmartRounding(beforeRounding, config.strategy, config.direction);
    const roundingDiff = adjustedPrice.toNumber() - beforeRounding;

    return {
        adjustedPrice,
        beforeRounding,
        roundingDiff,
    };
}

/**
 * Calculate the effective percentage change after rounding
 */
export function getEffectivePercentChange(
    originalPrice: number,
    newPrice: number | Decimal
): number {
    const newPriceNum = typeof newPrice === 'number' ? newPrice : newPrice.toNumber();

    if (originalPrice === 0) return 0;

    return ((newPriceNum - originalPrice) / originalPrice) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that rounding configuration is sensible for a given price range
 */
export function validateRoundingConfig(
    averagePrice: number,
    strategy: RoundingStrategy
): { valid: boolean; warning?: string } {
    const roundingUnit = ROUNDING_UNITS[strategy];

    // Warning if rounding unit is > 10% of average price
    if (roundingUnit > averagePrice * 0.1) {
        return {
            valid: true,
            warning: `El redondeo a $${roundingUnit.toLocaleString()} puede ser agresivo para precios promedio de $${averagePrice.toLocaleString()}`,
        };
    }

    // Warning if rounding unit is < 0.1% of average price (too fine)
    if (roundingUnit < averagePrice * 0.001 && strategy !== 'NO_ROUNDING') {
        return {
            valid: true,
            warning: `El redondeo a $${roundingUnit.toLocaleString()} es muy fino para precios promedio de $${averagePrice.toLocaleString()}`,
        };
    }

    return { valid: true };
}
