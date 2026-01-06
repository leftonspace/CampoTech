/**
 * Monotributo Categories Reference Data
 * =======================================
 *
 * Phase 2.4 Task 2.4.1: Monotributo Category Reference Data
 *
 * Official AFIP Monotributo limits for 2024/2025.
 * These values should be updated annually when AFIP publishes new limits.
 *
 * Source: AFIP Resolution General
 * Last Updated: January 2026
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MonotributoCategory {
    maxAnnual: number;
    maxMonthly: number;
    name: string;
    type: 'services_and_goods' | 'services_only';
    monthlyFee?: number; // Optional: monthly payment amount
}

export type MonotributoCategoryKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';

/**
 * Official AFIP Monotributo limits (2024/2025)
 *
 * Categories A-H: Available for services AND goods
 * Categories I-K: Available for services ONLY
 */
export const MONOTRIBUTO_CATEGORIES: Record<MonotributoCategoryKey, MonotributoCategory> = {
    A: {
        maxAnnual: 2108288.01,
        maxMonthly: 175690.67,
        name: 'Categoría A',
        type: 'services_and_goods',
        monthlyFee: 12128.39,
    },
    B: {
        maxAnnual: 3133941.63,
        maxMonthly: 261161.80,
        name: 'Categoría B',
        type: 'services_and_goods',
        monthlyFee: 13576.03,
    },
    C: {
        maxAnnual: 4387518.23,
        maxMonthly: 365626.52,
        name: 'Categoría C',
        type: 'services_and_goods',
        monthlyFee: 15489.80,
    },
    D: {
        maxAnnual: 5449094.55,
        maxMonthly: 454091.21,
        name: 'Categoría D',
        type: 'services_and_goods',
        monthlyFee: 19405.69,
    },
    E: {
        maxAnnual: 6416528.72,
        maxMonthly: 534710.73,
        name: 'Categoría E',
        type: 'services_and_goods',
        monthlyFee: 26105.73,
    },
    F: {
        maxAnnual: 8020661.10,
        maxMonthly: 668388.43,
        name: 'Categoría F',
        type: 'services_and_goods',
        monthlyFee: 31347.16,
    },
    G: {
        maxAnnual: 9614793.48,
        maxMonthly: 801232.79,
        name: 'Categoría G',
        type: 'services_and_goods',
        monthlyFee: 36276.80,
    },
    H: {
        maxAnnual: 11915838.24,
        maxMonthly: 992986.52,
        name: 'Categoría H',
        type: 'services_and_goods',
        monthlyFee: 66111.51,
    },
    I: {
        maxAnnual: 13337213.56,
        maxMonthly: 1111434.46,
        name: 'Categoría I (Solo servicios)',
        type: 'services_only',
        monthlyFee: 84854.91,
    },
    J: {
        maxAnnual: 15285088.40,
        maxMonthly: 1273757.37,
        name: 'Categoría J (Solo servicios)',
        type: 'services_only',
        monthlyFee: 103539.61,
    },
    K: {
        maxAnnual: 16957163.23,
        maxMonthly: 1413096.94,
        name: 'Categoría K (Solo servicios)',
        type: 'services_only',
        monthlyFee: 117315.36,
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all category keys
 */
export function getMonotributoCategoryKeys(): MonotributoCategoryKey[] {
    return Object.keys(MONOTRIBUTO_CATEGORIES) as MonotributoCategoryKey[];
}

/**
 * Get categories available for services (all categories)
 */
export function getServiceCategories(): MonotributoCategoryKey[] {
    return getMonotributoCategoryKeys();
}

/**
 * Get categories available for goods (A-H only)
 */
export function getGoodsCategories(): MonotributoCategoryKey[] {
    return getMonotributoCategoryKeys().filter(
        (key) => MONOTRIBUTO_CATEGORIES[key].type === 'services_and_goods'
    );
}

/**
 * Check if a category is valid
 */
export function isValidMonotributoCategory(category: string): category is MonotributoCategoryKey {
    return category in MONOTRIBUTO_CATEGORIES;
}

/**
 * Get category details
 */
export function getMonotributoCategory(category: MonotributoCategoryKey): MonotributoCategory {
    return MONOTRIBUTO_CATEGORIES[category];
}

/**
 * Format currency for Argentine Peso
 */
export function formatARS(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Get category options for dropdown
 */
export function getMonotributoCategoryOptions(): Array<{ value: MonotributoCategoryKey; label: string }> {
    return getMonotributoCategoryKeys().map((key) => ({
        value: key,
        label: `${key} - ${MONOTRIBUTO_CATEGORIES[key].name} (hasta ${formatARS(MONOTRIBUTO_CATEGORIES[key].maxAnnual)}/año)`,
    }));
}

/**
 * Suggest next category based on current billing
 */
export function suggestNextCategory(
    currentCategory: MonotributoCategoryKey,
    ytdBilling: number
): MonotributoCategoryKey | null {
    const categories = getMonotributoCategoryKeys();
    const currentIndex = categories.indexOf(currentCategory);

    // If not at max category and approaching limit, suggest next
    if (currentIndex < categories.length - 1) {
        const currentLimit = MONOTRIBUTO_CATEGORIES[currentCategory].maxAnnual;
        const percentUsed = (ytdBilling / currentLimit) * 100;

        if (percentUsed >= 85) {
            return categories[currentIndex + 1];
        }
    }

    return null;
}
