/**
 * Exchange Rate Service
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * Fetches and caches exchange rates from multiple sources:
 * - OFICIAL: BCRA official rate (API)
 * - BLUE: Informal market rate (scraping)
 * - MEP: Stock market derived (scraping)
 * - CRYPTO: USDT/ARS (API)
 * 
 * Implements the "Legal Shield" pattern - internally uses BLUE,
 * but displays as "Cotización de Mercado" in UI.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Re-export the enum from Prisma - use as type until TS server reloads
// After TS restart, can change to: import { ExchangeRateSource } from '@prisma/client';
export type ExchangeRateSource = 'OFICIAL' | 'BLUE' | 'MEP' | 'CCL' | 'CRYPTO' | 'CUSTOM';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExchangeRateData {
    source: ExchangeRateSource;
    buyRate: number;
    sellRate: number;
    averageRate: number;
    fetchedAt: Date;
    isStale?: boolean;
}

export interface CachedRate {
    id: string;
    source: ExchangeRateSource;
    buyRate: Decimal;
    sellRate: Decimal;
    averageRate: Decimal;
    fetchedAt: Date;
    validUntil: Date;
    isStale: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours max staleness

/**
 * UI Labels for exchange rate sources (Legal Shield pattern)
 * BLUE is displayed as "Cotización de Mercado" to avoid legal sensitivity
 */
export const EXCHANGE_RATE_LABELS: Record<ExchangeRateSource, string> = {
    OFICIAL: 'Dólar Oficial',
    BLUE: 'Cotización de Mercado',  // ← Legal shield - not "Dólar Blue"
    MEP: 'Dólar MEP',
    CCL: 'Dólar CCL',
    CRYPTO: 'Cotización Crypto',
    CUSTOM: 'Cotización Personalizada',
};

/**
 * Internal labels for admin/dev views
 */
export const EXCHANGE_RATE_INTERNAL: Record<ExchangeRateSource, string> = {
    OFICIAL: 'Oficial (BCRA)',
    BLUE: 'Blue (Informal)',
    MEP: 'MEP (Bolsa)',
    CCL: 'CCL',
    CRYPTO: 'Crypto (USDT)',
    CUSTOM: 'Custom',
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY UTILITIES (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries - 1) {
                // Exponential backoff with jitter
                const delay = Math.min(
                    baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
                    maxDelayMs
                );
                console.log(`[Exchange Rate] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('All retries failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCHANGE RATE FETCHERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch official rate from BCRA API
 * https://api.bcra.gob.ar/estadisticas/v2.0/principalesvariables
 */
async function fetchOfficialRate(): Promise<ExchangeRateData> {
    try {
        // BCRA API for official exchange rate
        // Variable ID 4 = Tipo de cambio de referencia
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(
            `https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/4/${today}/${today}`,
            {
                headers: {
                    'Accept': 'application/json',
                },
                next: { revalidate: 3600 }, // Cache for 1 hour
            }
        );

        if (!response.ok) {
            throw new Error(`BCRA API error: ${response.status}`);
        }

        const data = await response.json();

        // BCRA returns array of data points
        const latestRate = data.results?.[0]?.valor;

        if (!latestRate) {
            throw new Error('No rate data from BCRA');
        }

        const rate = parseFloat(latestRate);

        return {
            source: 'OFICIAL' as ExchangeRateSource,
            buyRate: rate * 0.99, // Approximate buy rate
            sellRate: rate * 1.01, // Approximate sell rate
            averageRate: rate,
            fetchedAt: new Date(),
        };
    } catch (error) {
        console.error('Failed to fetch BCRA official rate:', error);
        throw error;
    }
}

/**
 * Scrape Dólar Blue from dolarhoy.com
 * Fallback: ambito.com
 */
async function fetchBlueRate(): Promise<ExchangeRateData> {
    try {
        // Try dolarhoy.com first
        const response = await fetch('https://dolarhoy.com/cotizacion-dolar-blue', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 3600 },
        });

        if (!response.ok) {
            throw new Error(`dolarhoy.com error: ${response.status}`);
        }

        const html = await response.text();

        // Parse buy/sell rates from HTML
        // dolarhoy structure: <div class="topic">Compra</div><div class="value">$1480,00</div>
        // We need to find "Compra" followed by a value, and "Venta" followed by a value
        const buyMatch = html.match(/class="topic"[^>]*>\s*Compra\s*<\/div>\s*<div[^>]*class="value"[^>]*>\s*\$?\s*([\d.,]+)/is);
        const sellMatch = html.match(/class="topic"[^>]*>\s*Venta\s*<\/div>\s*<div[^>]*class="value"[^>]*>\s*\$?\s*([\d.,]+)/is);

        if (!buyMatch || !sellMatch) {
            console.warn('[dolarhoy] Could not parse with primary regex, trying fallback...');
            // Fallback: try to find the first two "value" divs with prices
            const allValues = [...html.matchAll(/class="value"[^>]*>\s*\$?\s*([\d.,]+)/gi)];
            if (allValues.length >= 2) {
                const buyRate = parseFloat(allValues[0][1].replace(/\./g, '').replace(',', '.'));
                const sellRate = parseFloat(allValues[1][1].replace(/\./g, '').replace(',', '.'));
                return {
                    source: 'BLUE' as ExchangeRateSource,
                    buyRate,
                    sellRate,
                    averageRate: (buyRate + sellRate) / 2,
                    fetchedAt: new Date(),
                };
            }
            throw new Error('Could not parse dolarhoy.com rates');
        }

        const buyRate = parseFloat(buyMatch[1].replace(/\./g, '').replace(',', '.'));
        const sellRate = parseFloat(sellMatch[1].replace(/\./g, '').replace(',', '.'));

        return {
            source: 'BLUE' as ExchangeRateSource,
            buyRate,
            sellRate,
            averageRate: (buyRate + sellRate) / 2,
            fetchedAt: new Date(),
        };
    } catch (error) {
        console.error('Failed to fetch Blue rate from dolarhoy:', error);

        // Try fallback to ambito.com
        try {
            return await fetchBlueFromAmbito();
        } catch {
            throw error;
        }
    }
}

/**
 * Fallback scraper for Blue rate from ambito.com
 */
async function fetchBlueFromAmbito(): Promise<ExchangeRateData> {
    const response = await fetch('https://mercados.ambito.com/dolar/informal/variacion', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    if (!response.ok) {
        throw new Error(`ambito.com error: ${response.status}`);
    }

    const data = await response.json();

    // ambito returns JSON: { "compra": "1150", "venta": "1180", ... }
    const buyRate = parseFloat(data.compra?.replace(',', '.') || '0');
    const sellRate = parseFloat(data.venta?.replace(',', '.') || '0');

    if (!buyRate || !sellRate) {
        throw new Error('Invalid rate data from ambito.com');
    }

    return {
        source: 'BLUE' as ExchangeRateSource,
        buyRate,
        sellRate,
        averageRate: (buyRate + sellRate) / 2,
        fetchedAt: new Date(),
    };
}

/**
 * Fetch MEP rate from ambito.com
 * Uses the /dolarrava/mep endpoint (as per their HTML data-indice attribute)
 */
async function fetchMEPRate(): Promise<ExchangeRateData> {
    // Try primary endpoint first (from HTML data-indice), then fallback
    const endpoints = [
        'https://mercados.ambito.com/dolarrava/mep/variacion',
        'https://mercados.ambito.com/dolar/mep/variacion',
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                next: { revalidate: 3600 },
            });

            if (!response.ok) {
                throw new Error(`ambito.com MEP error: ${response.status}`);
            }

            const data = await response.json();

            // MEP may return referencia instead of compra/venta
            const referencia = parseFloat(data.referencia?.replace(',', '.') || '0');
            const buyRate = parseFloat(data.compra?.replace(',', '.') || '0') || referencia;
            const sellRate = parseFloat(data.venta?.replace(',', '.') || '0') || referencia;

            if (!buyRate && !sellRate && !referencia) {
                throw new Error('Invalid MEP rate data');
            }

            return {
                source: 'MEP' as ExchangeRateSource,
                buyRate: buyRate || referencia,
                sellRate: sellRate || referencia,
                averageRate: referencia || (buyRate + sellRate) / 2,
                fetchedAt: new Date(),
            };
        } catch (error) {
            console.error(`Failed to fetch MEP from ${endpoint}:`, error);
            lastError = error as Error;
            // Try next endpoint
        }
    }

    throw lastError || new Error('Failed to fetch MEP rate from all endpoints');
}

/**
 * Fetch CCL (Contado con Liquidación) rate from ambito.com
 * Uses the /dolarrava/cl endpoint (as per their HTML data-indice attribute)
 */
async function fetchCCLRate(): Promise<ExchangeRateData> {
    // Try primary endpoint first, then fallback
    const endpoints = [
        'https://mercados.ambito.com/dolarrava/cl/variacion',
        'https://mercados.ambito.com/dolar/ccl/variacion',
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                next: { revalidate: 3600 },
            });

            if (!response.ok) {
                throw new Error(`ambito.com CCL error: ${response.status}`);
            }

            const data = await response.json();

            // CCL returns referencia instead of compra/venta (screenshot shows "Referencia")
            const referencia = parseFloat(data.referencia?.replace(',', '.') || '0');
            const buyRate = parseFloat(data.compra?.replace(',', '.') || '0') || referencia;
            const sellRate = parseFloat(data.venta?.replace(',', '.') || '0') || referencia;

            if (!buyRate && !sellRate && !referencia) {
                throw new Error('Invalid CCL rate data');
            }

            return {
                source: 'CCL' as ExchangeRateSource,
                buyRate: buyRate || referencia,
                sellRate: sellRate || referencia,
                averageRate: referencia || (buyRate + sellRate) / 2,
                fetchedAt: new Date(),
            };
        } catch (error) {
            console.error(`Failed to fetch CCL from ${endpoint}:`, error);
            lastError = error as Error;
            // Try next endpoint
        }
    }

    throw lastError || new Error('Failed to fetch CCL rate from all endpoints');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get cached exchange rate for a source
 */
async function getCachedRate(source: ExchangeRateSource): Promise<CachedRate | null> {
    const rate = await prisma.exchangeRate.findFirst({
        where: {
            source,
            validUntil: {
                gte: new Date(),
            },
        },
        orderBy: {
            fetchedAt: 'desc',
        },
    });

    return rate;
}

/**
 * Get last known rate (even if expired) for fallback
 */
async function getLastKnownRate(source: ExchangeRateSource): Promise<CachedRate | null> {
    const rate = await prisma.exchangeRate.findFirst({
        where: { source },
        orderBy: { fetchedAt: 'desc' },
    });

    return rate;
}

/**
 * Check if a cached rate is within stale TTL
 */
function isWithinStaleTTL(rate: CachedRate): boolean {
    const staleCutoff = new Date(Date.now() - STALE_TTL_MS);
    return rate.fetchedAt >= staleCutoff;
}

/**
 * Cache a fetched exchange rate
 */
async function cacheRate(data: ExchangeRateData): Promise<CachedRate> {
    const validUntil = new Date(Date.now() + CACHE_TTL_MS);

    const rate = await prisma.exchangeRate.create({
        data: {
            source: data.source,
            buyRate: new Decimal(data.buyRate),
            sellRate: new Decimal(data.sellRate),
            averageRate: new Decimal(data.averageRate),
            fetchedAt: data.fetchedAt,
            validUntil,
            isStale: data.isStale || false,
        },
    });

    return rate;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current exchange rate for a source
 * Returns cached if valid, fetches new if expired
 */
export async function getExchangeRate(
    source: ExchangeRateSource
): Promise<CachedRate & { label: string }> {
    // Check cache first
    const cached = await getCachedRate(source);

    if (cached) {
        return {
            ...cached,
            label: EXCHANGE_RATE_LABELS[source],
        };
    }

    // Fetch fresh rate
    try {
        let data: ExchangeRateData;

        switch (source) {
            case 'OFICIAL':
                data = await fetchOfficialRate();
                break;
            case 'BLUE':
                data = await fetchBlueRate();
                break;
            case 'MEP':
                data = await fetchMEPRate();
                break;
            case 'CCL':
                data = await fetchCCLRate();
                break;
            case 'CRYPTO':
            case 'CUSTOM':
                // These will be implemented in Phase 3
                throw new Error(`Source ${source} not yet implemented`);
            default:
                throw new Error(`Unknown source: ${source}`);
        }

        const rate = await cacheRate(data);
        return {
            ...rate,
            label: EXCHANGE_RATE_LABELS[source],
        };
    } catch (error) {
        console.error(`Failed to fetch ${source} rate:`, error);

        // Fallback to last known rate if within stale TTL
        const lastKnown = await getLastKnownRate(source);

        if (lastKnown && isWithinStaleTTL(lastKnown)) {
            // Mark as stale and return
            return {
                ...lastKnown,
                isStale: true,
                label: EXCHANGE_RATE_LABELS[source],
            };
        }

        throw new Error(`No valid rate available for ${source}`);
    }
}

/**
 * Get all current exchange rates
 */
export async function getAllExchangeRates(): Promise<(CachedRate & { label: string })[]> {
    const sources: ExchangeRateSource[] = ['OFICIAL', 'BLUE', 'MEP', 'CCL'];
    const results: (CachedRate & { label: string })[] = [];

    for (const source of sources) {
        try {
            const rate = await getExchangeRate(source);
            results.push(rate);
        } catch (error) {
            console.error(`Failed to get ${source} rate:`, error);
            // Continue with other sources
        }
    }

    return results;
}

/**
 * Force refresh exchange rates from all sources
 */
export async function refreshAllRates(): Promise<void> {
    const sources: ExchangeRateSource[] = ['OFICIAL', 'BLUE', 'MEP', 'CCL'];

    for (const source of sources) {
        try {
            let data: ExchangeRateData;

            switch (source) {
                case 'OFICIAL':
                    data = await fetchOfficialRate();
                    break;
                case 'BLUE':
                    data = await fetchBlueRate();
                    break;
                case 'MEP':
                    data = await fetchMEPRate();
                    break;
                default:
                    continue;
            }

            await cacheRate(data);
            console.log(`Refreshed ${source} rate: ${data.averageRate}`);
        } catch (error) {
            console.error(`Failed to refresh ${source} rate:`, error);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// USD → ARS CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert USD price to ARS
 * Uses sell rate (customer buys from us)
 */
export async function convertUsdToArs(
    usdAmount: number,
    source: ExchangeRateSource = 'BLUE',
    markup: number = 0
): Promise<{ arsAmount: number; rate: number; isStale: boolean }> {
    const rate = await getExchangeRate(source);

    // Apply markup
    const effectiveRate = rate.sellRate.toNumber() * (1 + markup / 100);
    const arsAmount = usdAmount * effectiveRate;

    return {
        arsAmount,
        rate: effectiveRate,
        isStale: rate.isStale,
    };
}

/**
 * Convert ARS price to USD
 * Uses buy rate (for reference/display)
 */
export async function convertArsToUsd(
    arsAmount: number,
    source: ExchangeRateSource = 'BLUE'
): Promise<{ usdAmount: number; rate: number; isStale: boolean }> {
    const rate = await getExchangeRate(source);

    const usdAmount = arsAmount / rate.buyRate.toNumber();

    return {
        usdAmount,
        rate: rate.buyRate.toNumber(),
        isStale: rate.isStale,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL RATE OVERRIDE (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ManualRateInput {
    source: ExchangeRateSource;
    buyRate: number;
    sellRate: number;
    reason?: string;
}

/**
 * Set a manual exchange rate override
 * Used by admins when scrapers fail or for custom rates
 */
export async function setManualRate(input: ManualRateInput): Promise<CachedRate> {
    const validUntil = new Date(Date.now() + CACHE_TTL_MS);
    const averageRate = (input.buyRate + input.sellRate) / 2;

    const rate = await prisma.exchangeRate.create({
        data: {
            source: input.source,
            buyRate: new Decimal(input.buyRate),
            sellRate: new Decimal(input.sellRate),
            averageRate: new Decimal(averageRate),
            fetchedAt: new Date(),
            validUntil,
            isStale: false,
            // Mark as manual entry in metadata (could extend model later)
        },
    });

    console.log(`[Exchange Rate] Manual rate set for ${input.source}: ${averageRate}`);
    return rate;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE HISTORY (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateHistoryEntry {
    id: string;
    source: ExchangeRateSource;
    buyRate: number;
    sellRate: number;
    averageRate: number;
    fetchedAt: Date;
}

export interface RateHistoryOptions {
    source?: ExchangeRateSource;
    days?: number;
    limit?: number;
}

/**
 * Get historical exchange rates for charting
 */
export async function getRateHistory(
    options: RateHistoryOptions = {}
): Promise<RateHistoryEntry[]> {
    const { source, days = 30, limit = 500 } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rates = await prisma.exchangeRate.findMany({
        where: {
            ...(source && { source }),
            fetchedAt: { gte: startDate },
        },
        orderBy: { fetchedAt: 'asc' },
        take: limit,
        select: {
            id: true,
            source: true,
            buyRate: true,
            sellRate: true,
            averageRate: true,
            fetchedAt: true,
        },
    });

    return rates.map((r: typeof rates[0]) => ({
        id: r.id,
        source: r.source as ExchangeRateSource,
        buyRate: r.buyRate.toNumber(),
        sellRate: r.sellRate.toNumber(),
        averageRate: r.averageRate.toNumber(),
        fetchedAt: r.fetchedAt,
    }));
}

/**
 * Get rate statistics for a time period
 */
export async function getRateStats(source: ExchangeRateSource, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rates = await prisma.exchangeRate.findMany({
        where: {
            source,
            fetchedAt: { gte: startDate },
        },
        select: {
            averageRate: true,
            fetchedAt: true,
        },
        orderBy: { fetchedAt: 'asc' },
    });

    if (rates.length === 0) {
        return null;
    }

    const values = rates.map((r: typeof rates[0]) => r.averageRate.toNumber());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const current = values[values.length - 1];
    const first = values[0];
    const change = current - first;
    const changePercent = (change / first) * 100;

    return {
        source,
        period: `${days}d`,
        current,
        min,
        max,
        change,
        changePercent,
        dataPoints: rates.length,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON-SAFE REFRESH (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RefreshResult {
    source: ExchangeRateSource;
    success: boolean;
    rate?: number;
    error?: string;
}

/**
 * Refresh all rates with retry logic - safe for cron jobs
 * Returns detailed results for each source
 */
export async function refreshAllRatesWithRetry(): Promise<RefreshResult[]> {
    const sources: ExchangeRateSource[] = ['OFICIAL', 'BLUE', 'MEP'];
    const results: RefreshResult[] = [];

    for (const source of sources) {
        try {
            const data = await withRetry(
                async () => {
                    switch (source) {
                        case 'OFICIAL':
                            return fetchOfficialRate();
                        case 'BLUE':
                            return fetchBlueRate();
                        case 'MEP':
                            return fetchMEPRate();
                        default:
                            throw new Error(`Unknown source: ${source}`);
                    }
                },
                { maxRetries: 3, baseDelayMs: 2000 }
            );

            await cacheRate(data);
            console.log(`[Cron] Refreshed ${source}: ${data.averageRate}`);

            results.push({
                source,
                success: true,
                rate: data.averageRate,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Cron] Failed to refresh ${source}:`, errorMessage);

            results.push({
                source,
                success: false,
                error: errorMessage,
            });
        }
    }

    return results;
}

/**
 * Cleanup old exchange rate records (keep last 30 days)
 */
export async function cleanupOldRates(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.exchangeRate.deleteMany({
        where: {
            fetchedAt: { lt: cutoffDate },
        },
    });

    console.log(`[Cleanup] Deleted ${result.count} old exchange rate records`);
    return result.count;
}
