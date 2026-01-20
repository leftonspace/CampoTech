/**
 * INDEC Unified Scraper
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Scrapes BOTH IPC and ICC from the INDEC Precios overview page.
 * This is more reliable than individual pages because the URL is stable.
 * 
 * Overview URL: https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5
 * 
 * For next report dates, we still need the individual pages:
 * - IPC: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31
 * - ICC: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-33
 */

import { chromium, Browser } from 'playwright';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndecIndexData {
    source: 'INDEC_IPC_GENERAL' | 'CAC_ICC_GENERAL';
    rate: number;
    period: string;        // YYYY-MM format
    periodLabel: string;   // e.g., "Diciembre 2025"
    scrapedAt: Date;
}

export interface IndecUnifiedResult {
    success: boolean;
    ipc?: IndecIndexData;
    icc?: IndecIndexData;
    nextReportDates?: {
        ipc?: Date;
        icc?: Date;
    };
    error?: string;
    debug?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const OVERVIEW_URL = 'https://www.indec.gob.ar/indec/web/Nivel3-Tema-3-5';
const IPC_DETAIL_URL = 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31';
const ICC_DETAIL_URL = 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-33';

const MONTH_NAMES: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class IndecUnifiedScraper {
    private browser: Browser | null = null;
    private debugLogs: string[] = [];

    private log(message: string) {
        console.log('[INDEC Unified]', message);
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
     * Parse month name to YYYY-MM format
     */
    private parseMonthPeriod(monthText: string): { period: string; periodLabel: string } | null {
        // Match patterns like "Diciembre 2025" or "Noviembre 2025"
        const match = monthText.match(/(\w+)\s+(\d{4})/i);
        if (match) {
            const monthName = match[1].toLowerCase();
            const year = parseInt(match[2]);
            const monthNum = MONTH_NAMES[monthName];

            if (monthNum && !isNaN(year)) {
                return {
                    period: `${year}-${String(monthNum).padStart(2, '0')}`,
                    periodLabel: `${monthName} ${year}`,
                };
            }
        }
        return null;
    }

    /**
     * Extract rate from text like "2,8%" or "2.5%"
     */
    private parseRate(rateText: string): number | null {
        const match = rateText.match(/([\d,\.]+)\s*%?/);
        if (match) {
            const rate = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(rate) && rate >= 0 && rate < 100) {
                return rate;
            }
        }
        return null;
    }

    /**
     * Scrapes IPC and ICC from the Precios overview page.
     */
    async scrapeOverview(): Promise<IndecUnifiedResult> {
        this.debugLogs = [];

        try {
            const browser = await this.initBrowser();
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                locale: 'es-AR',
            });

            const page = await context.newPage();

            this.log(`Navigating to ${OVERVIEW_URL}`);
            await page.goto(OVERVIEW_URL, {
                waitUntil: 'networkidle',
                timeout: 60000,
            });

            await page.waitForTimeout(2000);

            // Extract the three indices from the indicator cards
            // Structure: div.indicadores-inicio contains three col-md-3 divs
            // Each has: font-2 (name), font-1 (rate), font-33 (month)

            const indices = await page.evaluate(() => {
                const results: Array<{ name: string, rate: string, month: string }> = [];

                // Find the indicator boxes
                const boxes = document.querySelectorAll('.col-md-3.col-centered');

                boxes.forEach((box) => {
                    const nameEl = box.querySelector('.font-2');
                    const rateEl = box.querySelector('.font-1');
                    const monthEl = box.querySelector('.font-33');

                    if (nameEl && rateEl && monthEl) {
                        results.push({
                            name: nameEl.textContent?.trim() || '',
                            rate: rateEl.textContent?.trim() || '',
                            month: monthEl.textContent?.trim() || '',
                        });
                    }
                });

                return results;
            });

            this.log(`Found ${indices.length} indices on page`);

            let ipcData: IndecIndexData | undefined;
            let iccData: IndecIndexData | undefined;

            for (const idx of indices) {
                this.log(`Index: ${idx.name} = ${idx.rate} (${idx.month})`);

                const rate = this.parseRate(idx.rate);
                const periodInfo = this.parseMonthPeriod(idx.month);

                if (rate !== null && periodInfo) {
                    if (idx.name.toLowerCase().includes('consumidor')) {
                        // IPC
                        ipcData = {
                            source: 'INDEC_IPC_GENERAL',
                            rate,
                            period: periodInfo.period,
                            periodLabel: periodInfo.periodLabel,
                            scrapedAt: new Date(),
                        };
                        this.log(`IPC: ${rate}% for ${periodInfo.period}`);
                    } else if (idx.name.toLowerCase().includes('construcción')) {
                        // ICC
                        iccData = {
                            source: 'CAC_ICC_GENERAL',
                            rate,
                            period: periodInfo.period,
                            periodLabel: periodInfo.periodLabel,
                            scrapedAt: new Date(),
                        };
                        this.log(`ICC: ${rate}% for ${periodInfo.period}`);
                    }
                }
            }

            await context.close();

            if (!ipcData && !iccData) {
                return {
                    success: false,
                    error: 'Could not extract any indices from page',
                    debug: this.debugLogs,
                };
            }

            return {
                success: true,
                ipc: ipcData,
                icc: iccData,
                debug: this.debugLogs,
            };

        } catch (error) {
            this.log(`Error: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                debug: this.debugLogs,
            };
        }
    }

    /**
     * Scrapes next report date from individual index page.
     */
    async scrapeNextReportDate(indexType: 'ipc' | 'icc'): Promise<Date | null> {
        const url = indexType === 'ipc' ? IPC_DETAIL_URL : ICC_DETAIL_URL;

        try {
            const browser = await this.initBrowser();
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                locale: 'es-AR',
            });

            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(2000);

            const pageText = await page.evaluate(() => document.body.innerText);

            // Look for "Próximo informe técnico: DD/MM/YY"
            const pattern = /[Pp]r[óo]ximo\s+informe[^:]*:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
            const match = pageText.match(pattern);

            await context.close();

            if (match) {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                let year = parseInt(match[3]);
                if (year < 100) year += 2000;

                const date = new Date(year, month, day);
                this.log(`${indexType.toUpperCase()} next report: ${date.toISOString()}`);
                return date;
            }

            return null;

        } catch (error) {
            this.log(`Error getting next report date for ${indexType}: ${error}`);
            return null;
        }
    }

    /**
     * Full scrape: overview + next report dates
     */
    async scrapeAll(): Promise<IndecUnifiedResult> {
        const result = await this.scrapeOverview();

        if (!result.success) {
            return result;
        }

        // Get next report dates from individual pages
        const ipcNextDate = await this.scrapeNextReportDate('ipc');
        const iccNextDate = await this.scrapeNextReportDate('icc');

        result.nextReportDates = {
            ipc: ipcNextDate || undefined,
            icc: iccNextDate || undefined,
        };

        return result;
    }

    /**
     * Scrapes and saves to database.
     */
    async scrapeAndSave(): Promise<IndecUnifiedResult> {
        const result = await this.scrapeAll();

        if (!result.success) {
            return result;
        }

        try {
            // Save IPC
            if (result.ipc) {
                await prisma.inflationIndex.upsert({
                    where: {
                        source_period: {
                            source: 'INDEC_IPC_GENERAL',
                            period: result.ipc.period,
                        },
                    },
                    update: {
                        rate: new Decimal(result.ipc.rate),
                        scrapedAt: result.ipc.scrapedAt,
                    },
                    create: {
                        source: 'INDEC_IPC_GENERAL',
                        period: result.ipc.period,
                        rate: new Decimal(result.ipc.rate),
                        publishedAt: new Date(),
                        scrapedAt: result.ipc.scrapedAt,
                    },
                });
                this.log(`Saved IPC: ${result.ipc.period} = ${result.ipc.rate}%`);
            }

            // Save ICC
            if (result.icc) {
                await prisma.inflationIndex.upsert({
                    where: {
                        source_period: {
                            source: 'CAC_ICC_GENERAL',
                            period: result.icc.period,
                        },
                    },
                    update: {
                        rate: new Decimal(result.icc.rate),
                        scrapedAt: result.icc.scrapedAt,
                    },
                    create: {
                        source: 'CAC_ICC_GENERAL',
                        period: result.icc.period,
                        rate: new Decimal(result.icc.rate),
                        publishedAt: new Date(),
                        scrapedAt: result.icc.scrapedAt,
                    },
                });
                this.log(`Saved ICC: ${result.icc.period} = ${result.icc.rate}%`);
            }

            // Store next report dates for scheduling
            if (result.nextReportDates) {
                // Store in a config table or just log for now
                if (result.nextReportDates.ipc) {
                    this.log(`Next IPC report scheduled: ${result.nextReportDates.ipc.toISOString()}`);
                }
                if (result.nextReportDates.icc) {
                    this.log(`Next ICC report scheduled: ${result.nextReportDates.icc.toISOString()}`);
                }
            }

            return result;

        } catch (error) {
            return {
                success: false,
                error: `Scrape succeeded but save failed: ${error}`,
                debug: result.debug,
            };
        }
    }
}

// Singleton instance
let unifiedScraperInstance: IndecUnifiedScraper | null = null;

export function getIndecUnifiedScraper(): IndecUnifiedScraper {
    if (!unifiedScraperInstance) {
        unifiedScraperInstance = new IndecUnifiedScraper();
    }
    return unifiedScraperInstance;
}

export default IndecUnifiedScraper;
