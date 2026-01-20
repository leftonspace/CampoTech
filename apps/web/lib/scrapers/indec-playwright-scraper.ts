/**
 * INDEC IPC Playwright Scraper
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Scrapes the INDEC IPC page using Playwright (handles JavaScript rendering).
 * 
 * Source: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31
 * 
 * Based on the page structure visible in dev tools:
 * - Rate text: "variación de X,X%"
 * - Next report: "Próximo informe técnico: DD/MM/YY"
 */

import { chromium, Browser } from 'playwright';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndecIpcData {
    rate: number;
    period: string;
    periodLabel: string;
    reportDate: Date;
    nextReportDate: Date | null;
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

const MONTH_NAMES: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYWRIGHT SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class IndecPlaywrightScraper {
    private browser: Browser | null = null;
    private debugLogs: string[] = [];

    private log(message: string) {
        console.log('[INDEC Playwright]', message);
        this.debugLogs.push(message);
    }

    async initBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.log('Launching browser...');
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }
        return this.browser;
    }

    async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Scrapes the INDEC IPC page using Playwright.
     */
    async scrape(): Promise<IndecScrapingResult> {
        this.debugLogs = [];

        try {
            const browser = await this.initBrowser();
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                locale: 'es-AR',
            });

            const page = await context.newPage();

            this.log(`Navigating to ${INDEC_IPC_URL}`);
            await page.goto(INDEC_IPC_URL, {
                waitUntil: 'networkidle',
                timeout: 60000,
            });

            // Wait for the content to load
            this.log('Waiting for page content...');
            await page.waitForTimeout(2000);

            // Get the page text content
            const pageText = await page.evaluate(() => document.body.innerText);
            this.log(`Page text length: ${pageText.length}`);

            // Also get the HTML for more precise matching
            const pageHtml = await page.content();
            this.log(`Page HTML length: ${pageHtml.length}`);

            // Extract the rate
            const rate = this.extractRate(pageText);
            if (rate === null) {
                // Debug: Log a snippet
                const snippet = pageText.substring(0, 500);
                this.log(`Debug snippet: ${snippet.substring(0, 200)}...`);

                await context.close();
                return {
                    success: false,
                    error: 'Could not extract rate from page',
                    source: 'INDEC_IPC_GENERAL',
                    debug: this.debugLogs,
                };
            }

            // Extract period
            const periodInfo = this.extractPeriod(pageText);
            if (!periodInfo) {
                await context.close();
                return {
                    success: false,
                    error: 'Could not extract period from page',
                    source: 'INDEC_IPC_GENERAL',
                    debug: this.debugLogs,
                };
            }

            // Extract dates
            const reportDate = this.extractReportDate(pageText);
            const nextReportDate = this.extractNextReportDate(pageText);

            await context.close();

            const data: IndecIpcData = {
                rate,
                period: periodInfo.period,
                periodLabel: periodInfo.periodLabel,
                reportDate: reportDate || new Date(),
                nextReportDate,
                scrapedAt: new Date(),
            };

            this.log(`Success! Rate: ${rate}%, Period: ${periodInfo.period}`);

            return {
                success: true,
                data,
                source: 'INDEC_IPC_GENERAL',
                debug: this.debugLogs,
            };

        } catch (error) {
            this.log(`Error: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                source: 'INDEC_IPC_GENERAL',
                debug: this.debugLogs,
            };
        }
    }

    private extractRate(text: string): number | null {
        // Look for patterns in the text content
        const patterns = [
            /variaci[oó]n\s+de\s+([\d,\.]+)\s*%/i,
            /([\d,\.]+)\s*%\s+con\s+relaci/i,
            /registr[oó]\s+en\s+\w+\s+una\s+variaci[oó]n\s+de\s+([\d,\.]+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const rateStr = match[1].replace(',', '.');
                const rate = parseFloat(rateStr);
                if (!isNaN(rate) && rate > 0 && rate < 100) {
                    this.log(`Extracted rate: ${rate}%`);
                    return rate;
                }
            }
        }

        // Debug: look for any percentage
        const anyPercent = text.match(/([\d,\.]+)\s*%/g);
        if (anyPercent) {
            this.log(`Found percentages in text: ${anyPercent.slice(0, 5).join(', ')}`);
        }

        return null;
    }

    private extractPeriod(text: string): { period: string; periodLabel: string } | null {
        // Look for "registró en [mes]" pattern
        const patterns = [
            /registr[oó]\s+en\s+(\w+)\s+una/i,
            /período\s+(\w+)\s+de\s+(\d{4})/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const monthName = match[1].toLowerCase();
                const monthNum = MONTH_NAMES[monthName];

                if (monthNum) {
                    const now = new Date();
                    let year = now.getFullYear();

                    // If month > current month, it's from last year
                    if (monthNum > now.getMonth() + 1) {
                        year -= 1;
                    }

                    // Check if we have explicit year
                    if (match[2]) {
                        year = parseInt(match[2]);
                    }

                    const period = `${year}-${String(monthNum).padStart(2, '0')}`;
                    const periodLabel = `${monthName} ${year}`;
                    this.log(`Extracted period: ${period} (${periodLabel})`);
                    return { period, periodLabel };
                }
            }
        }

        return null;
    }

    private extractReportDate(text: string): Date | null {
        // Look for date pattern like "13/01/26. Índice de precios"
        const pattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\.\s*[ÍI]ndice/i;
        const match = text.match(pattern);

        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            let year = parseInt(match[3]);
            if (year < 100) year += 2000;

            return new Date(year, month, day);
        }

        return null;
    }

    private extractNextReportDate(text: string): Date | null {
        // Look for "Próximo informe técnico: DD/MM/YY"
        const pattern = /[Pp]r[óo]ximo\s+informe[^:]*:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
        const match = text.match(pattern);

        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            let year = parseInt(match[3]);
            if (year < 100) year += 2000;

            const date = new Date(year, month, day);
            this.log(`Extracted next report date: ${date.toISOString()}`);
            return date;
        }

        return null;
    }

    /**
     * Scrapes and saves to database.
     */
    async scrapeAndSave(): Promise<IndecScrapingResult> {
        const result = await this.scrape();

        if (!result.success || !result.data) {
            return result;
        }

        try {
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

            this.log(`Saved to database: ${result.data.period} = ${result.data.rate}%`);
            return result;

        } catch (error) {
            return {
                success: false,
                error: `Scrape succeeded but save failed: ${error}`,
                source: 'INDEC_IPC_GENERAL',
                debug: result.debug,
            };
        }
    }
}

// Singleton instance
let scraperInstance: IndecPlaywrightScraper | null = null;

export function getIndecScraper(): IndecPlaywrightScraper {
    if (!scraperInstance) {
        scraperInstance = new IndecPlaywrightScraper();
    }
    return scraperInstance;
}

export default IndecPlaywrightScraper;
