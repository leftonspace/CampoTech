/**
 * INDEC IPC Scraper
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Scrapes the INDEC (Instituto Nacional de Estadística y Censos)
 * IPC (Índice de Precios al Consumidor) from the official website.
 * 
 * Source: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31
 * 
 * The page contains:
 * - Current month's inflation rate (e.g., "2.8%")
 * - Report date (e.g., "13/01/26")
 * - Next report date (e.g., "10/2/26")
 * - Period (e.g., "diciembre" / "enero de 2026")
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndecIpcData {
    rate: number;              // e.g., 2.8 (percentage)
    period: string;            // e.g., "2025-12" (YYYY-MM format)
    periodLabel: string;       // e.g., "diciembre 2025"
    reportDate: Date;          // When the report was published
    nextReportDate: Date | null; // When the next report will be published
    scrapedAt: Date;
}

export interface IndecScrapingResult {
    success: boolean;
    data?: IndecIpcData;
    error?: string;
    source: 'INDEC_IPC_GENERAL';
    debug?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const INDEC_IPC_URL = 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31';

// Month name mapping (Spanish)
const MONTH_NAMES: Record<string, number> = {
    'enero': 1,
    'febrero': 2,
    'marzo': 3,
    'abril': 4,
    'mayo': 5,
    'junio': 6,
    'julio': 7,
    'agosto': 8,
    'septiembre': 9,
    'octubre': 10,
    'noviembre': 11,
    'diciembre': 12,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PARSING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts the inflation rate from the page text.
 * Looks for patterns like "una variación de 2,8%" or "variación de 2.8%"
 */
function extractRate(html: string): number | null {
    // Multiple patterns to try (from most specific to more general)
    const patterns = [
        /variaci[oó]n\s+de\s+([\d,\.]+)\s*%/i,           // "variación de 2,8%"
        /variacion\s+de\s+([\d,\.]+)\s*%/i,             // without accent
        /varia[^<]*de\s+([\d,\.]+)\s*%/i,               // more flexible
        /([\d,\.]+)\s*%\s+con\s+relaci[oó]n/i,          // "2,8% con relación"
        /registr[oó]\s+[^<]*?([\d,\.]+)\s*%/i,          // "registró...X%"
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            // Convert comma decimal separator to period
            const rateStr = match[1].replace(',', '.');
            const rate = parseFloat(rateStr);
            if (!isNaN(rate) && rate > 0 && rate < 100) {
                console.log('[INDEC Scraper] Extracted rate:', rate, '% using pattern:', pattern.source);
                return rate;
            }
        }
    }

    // Debug: Log a snippet of the HTML around keywords
    const snippetMatch = html.match(/.{0,100}variaci.{0,50}/i);
    if (snippetMatch) {
        console.log('[INDEC Scraper] Debug - Found "variaci" context:', snippetMatch[0]);
    }

    console.warn('[INDEC Scraper] Could not extract rate from page');
    return null;
}

/**
 * Extracts the period (month) from the page text.
 * Looks for patterns like "hogares del país registró en diciembre una variación"
 * or "período enero de 2026"
 */
function extractPeriod(html: string): { period: string; periodLabel: string } | null {
    // Try to find the month mentioned before "una variación"
    const monthPattern = /registr[óo]\s+en\s+(\w+)\s+una\s+variación/i;
    const match = html.match(monthPattern);

    if (match) {
        const monthName = match[1].toLowerCase();
        const monthNum = MONTH_NAMES[monthName];

        if (monthNum) {
            // Determine year - if month is Dec and we're in Jan, it's previous year
            const now = new Date();
            let year = now.getFullYear();

            // If the report month is later in the year than current month, it's from last year
            if (monthNum > now.getMonth() + 1) {
                year -= 1;
            }

            const period = `${year}-${String(monthNum).padStart(2, '0')}`;
            const periodLabel = `${monthName} ${year}`;

            console.log('[INDEC Scraper] Extracted period:', period, periodLabel);
            return { period, periodLabel };
        }
    }

    // Alternative: look for "período X de YYYY"
    const periodoPattern = /período\s+(\w+)\s+de\s+(\d{4})/i;
    const periodoMatch = html.match(periodoPattern);

    if (periodoMatch) {
        const monthName = periodoMatch[1].toLowerCase();
        const year = parseInt(periodoMatch[2]);
        const monthNum = MONTH_NAMES[monthName];

        if (monthNum && !isNaN(year)) {
            const period = `${year}-${String(monthNum).padStart(2, '0')}`;
            const periodLabel = `${monthName} ${year}`;
            return { period, periodLabel };
        }
    }

    console.warn('[INDEC Scraper] Could not extract period from page');
    return null;
}

/**
 * Extracts the report date from the page text.
 * Looks for date at the beginning of "Informes técnicos" section (e.g., "13/01/26")
 */
function extractReportDate(html: string): Date | null {
    // Look for pattern like "13/01/26. Índice de precios"
    const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\.\s*[ÍI]ndice\s+de\s+precios/i;
    const match = html.match(datePattern);

    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JS months are 0-indexed
        let year = parseInt(match[3]);

        // Handle 2-digit year
        if (year < 100) {
            year += 2000;
        }

        const date = new Date(year, month, day);
        console.log('[INDEC Scraper] Extracted report date:', date.toISOString());
        return date;
    }

    console.warn('[INDEC Scraper] Could not extract report date');
    return null;
}

/**
 * Extracts the next report date from the page text.
 * Looks for "Próximo informe técnico: 10/2/26"
 */
function extractNextReportDate(html: string): Date | null {
    const nextPattern = /[Pp]r[óo]ximo\s+informe\s+t[ée]cnico[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
    const match = html.match(nextPattern);

    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        let year = parseInt(match[3]);

        if (year < 100) {
            year += 2000;
        }

        const date = new Date(year, month, day);
        console.log('[INDEC Scraper] Extracted next report date:', date.toISOString());
        return date;
    }

    console.warn('[INDEC Scraper] Could not extract next report date');
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCRAPING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scrapes the current INDEC IPC rate from the official website.
 */
export async function scrapeIndecIpc(): Promise<IndecScrapingResult> {
    console.log('[INDEC Scraper] Starting scrape from:', INDEC_IPC_URL);

    try {
        const response = await fetch(INDEC_IPC_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
            },
            // 30 second timeout
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log('[INDEC Scraper] Fetched page, length:', html.length);

        // Extract all the data
        const rate = extractRate(html);
        const periodInfo = extractPeriod(html);
        const reportDate = extractReportDate(html);
        const nextReportDate = extractNextReportDate(html);

        // Validate we got the essential data
        if (rate === null || periodInfo === null) {
            return {
                success: false,
                error: 'Could not extract rate or period from INDEC page',
                source: 'INDEC_IPC_GENERAL',
            };
        }

        const data: IndecIpcData = {
            rate,
            period: periodInfo.period,
            periodLabel: periodInfo.periodLabel,
            reportDate: reportDate || new Date(),
            nextReportDate,
            scrapedAt: new Date(),
        };

        console.log('[INDEC Scraper] Success:', data);

        return {
            success: true,
            data,
            source: 'INDEC_IPC_GENERAL',
        };

    } catch (error) {
        console.error('[INDEC Scraper] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            source: 'INDEC_IPC_GENERAL',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scrapes and saves the INDEC IPC rate to the database.
 * Uses upsert to avoid duplicates for the same period.
 */
export async function scrapeAndSaveIndecIpc(): Promise<IndecScrapingResult> {
    const result = await scrapeIndecIpc();

    if (!result.success || !result.data) {
        return result;
    }

    try {
        // Save to InflationIndex table
        await prisma.inflationIndex.upsert({
            where: {
                source_period: {
                    source: 'INDEC_IPC_GENERAL',
                    period: result.data.period,
                },
            },
            update: {
                rate: new Decimal(result.data.rate),
                scrapedAt: result.data.scrapedAt,
            },
            create: {
                source: 'INDEC_IPC_GENERAL',
                period: result.data.period,
                rate: new Decimal(result.data.rate),
                publishedAt: result.data.reportDate,
                scrapedAt: result.data.scrapedAt,
            },
        });

        console.log('[INDEC Scraper] Saved to database:', result.data.period, result.data.rate, '%');

        return result;

    } catch (error) {
        console.error('[INDEC Scraper] Database error:', error);
        return {
            success: false,
            error: `Scrape succeeded but database save failed: ${error}`,
            source: 'INDEC_IPC_GENERAL',
        };
    }
}

/**
 * Gets the latest scraped INDEC IPC rate from the database.
 */
export async function getLatestIndecIpc() {
    const latest = await prisma.inflationIndex.findFirst({
        where: {
            source: 'INDEC_IPC_GENERAL',
        },
        orderBy: {
            period: 'desc',
        },
    });

    return latest;
}
