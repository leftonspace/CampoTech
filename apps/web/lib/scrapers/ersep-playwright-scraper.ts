/**
 * ERSEP Playwright Scraper (Córdoba - Electricistas)
 * ===================================================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Scrapes electrician profiles from ersep.cba.gov.ar using Playwright.
 * This is the highest quality data source with ~33,000 profiles
 * including phone numbers and emails.
 * 
 * Target: https://ersep.cba.gov.ar/registros-de-electricistas/
 * Data: Name, Phone, Email, Category, Matricula, CUIL
 * 
 * IMPORTANT: Requires Argentina VPN to access!
 */

import { chromium, Browser, Page } from 'playwright';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface ERSEPPlaywrightRecord {
    name: string;
    cuil: string | null;
    phone: string | null;
    email: string | null;
    category: string | null;
    matricula: string;
    locality: string | null;
    address: string | null;
}

interface ScrapeResult {
    records: ERSEPPlaywrightRecord[];
    pages: number;
    errors: string[];
}

interface ImportResult {
    imported: number;
    updated: number;
    errors: number;
    total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format phone number for WhatsApp (Argentine format)
 */
function formatPhoneForWhatsApp(phone: string | null): string | null {
    if (!phone || phone.trim() === '-' || phone.trim() === '') return null;

    // Córdoba area codes
    const DEFAULT_AREA_CODE = '351'; // Córdoba capital

    let cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

    // Handle 15 prefix
    if (cleaned.startsWith('15') && cleaned.length >= 9) {
        cleaned = cleaned.slice(2);
        if (cleaned.length <= 8) {
            cleaned = DEFAULT_AREA_CODE + cleaned;
        }
    }

    // Short number - add area code
    if (cleaned.length >= 6 && cleaned.length <= 8) {
        cleaned = DEFAULT_AREA_CODE + cleaned;
    }

    if (cleaned.length < 10 || cleaned.length > 12) return null;

    return `+549${cleaned}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ERSEPPlaywrightScraper {
    private baseUrl = 'https://ersep.cba.gov.ar/registros-de-electricistas/';
    private browser: Browser | null = null;
    private rateLimitMs = 1500;
    private maxPages = 500; // Safety limit

    /**
     * Initialize Playwright browser
     */
    private async initBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }
        return this.browser;
    }

    /**
     * Close browser when done
     */
    async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Check if page is accessible (Argentina VPN required)
     */
    async checkAccess(): Promise<{ accessible: boolean; message: string }> {
        try {
            const browser = await this.initBrowser();
            const page = await browser.newPage();

            const response = await page.goto(this.baseUrl, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            const status = response?.status() || 0;
            const content = await page.content();

            await page.close();

            // Check for geo-blocking
            if (status === 403 || content.includes('Access Denied') || content.includes('bloqueado')) {
                return {
                    accessible: false,
                    message: 'Access denied - Argentina VPN required',
                };
            }

            // Check for the expected page content
            if (content.includes('Registro') || content.includes('electricista')) {
                return {
                    accessible: true,
                    message: 'ERSEP registry accessible',
                };
            }

            return {
                accessible: false,
                message: `Unexpected page content - status ${status}`,
            };
        } catch (error) {
            return {
                accessible: false,
                message: `Connection error: ${error instanceof Error ? error.message : 'Unknown'}`,
            };
        }
    }

    /**
     * Extract records from the current page
     * Note: This needs to be adjusted based on actual page structure
     */
    private async extractRecordsFromPage(page: Page): Promise<ERSEPPlaywrightRecord[]> {
        return page.evaluate(() => {
            const records: ERSEPPlaywrightRecord[] = [];

            // Try table layout first
            const rows = document.querySelectorAll('table tbody tr');
            if (rows.length > 0) {
                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 4) {
                        const name = cells[1]?.textContent?.trim() || '';
                        const cuil = cells[0]?.textContent?.trim() || null;
                        const matricula = cells[2]?.textContent?.trim() || '';
                        const category = cells[3]?.textContent?.trim() || null;
                        const locality = cells[5]?.textContent?.trim() || null;

                        // Look for phone/email links
                        const phoneLink = row.querySelector('a[href^="tel:"]');
                        const emailLink = row.querySelector('a[href^="mailto:"]');

                        const phone = phoneLink?.getAttribute('href')?.replace('tel:', '') ||
                            cells[7]?.textContent?.trim() || null;
                        const email = emailLink?.getAttribute('href')?.replace('mailto:', '') ||
                            cells[cells.length - 1]?.textContent?.trim() || null;

                        if (name && matricula) {
                            records.push({
                                name,
                                cuil,
                                phone,
                                email: email?.includes('@') ? email.toLowerCase() : null,
                                category,
                                matricula,
                                locality,
                                address: cells[6]?.textContent?.trim() || null,
                            });
                        }
                    }
                });
            }

            // Try card layout
            const cards = document.querySelectorAll('.card, .profile, .electricista, .resultado');
            if (cards.length > 0 && records.length === 0) {
                cards.forEach((card) => {
                    const name = card.querySelector('.nombre, .name, h3, h4')?.textContent?.trim() || '';
                    const cuil = card.querySelector('.cuil')?.textContent?.trim() || null;
                    const matricula = card.querySelector('.matricula, .registro')?.textContent?.trim() || '';
                    const category = card.querySelector('.categoria')?.textContent?.trim() || null;
                    const phone = card.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:', '') || null;
                    const email = card.querySelector('a[href^="mailto:"]')?.getAttribute('href')?.replace('mailto:', '') || null;
                    const locality = card.querySelector('.localidad, .ciudad')?.textContent?.trim() || null;

                    const hashString = (str: string) => {
                        let hash = 0;
                        for (let i = 0; i < str.length; i++) {
                            hash = ((hash << 5) - hash) + str.charCodeAt(i);
                        }
                        return Math.abs(hash).toString(36).substring(0, 8);
                    };

                    if (name) {
                        records.push({
                            name,
                            cuil,
                            phone,
                            email: email?.includes('@') ? email.toLowerCase() : null,
                            category,
                            matricula: matricula || `ERSEP-${hashString(name)}`,
                            locality,
                            address: null,
                        });
                    }
                });
            }

            return records;
        });
    }

    /**
     * Check if there's a next page
     */
    private async hasNextPage(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            const nextSelectors = [
                '.pagination .next:not(.disabled)',
                'a[rel="next"]',
                '.next-page:not(.disabled)',
                'a:contains("Siguiente")',
            ];
            for (const selector of nextSelectors) {
                if (document.querySelector(selector)) return true;
            }
            return false;
        });
    }

    /**
     * Scrape all pages
     */
    async scrapeAll(): Promise<ScrapeResult> {
        const allRecords: ERSEPPlaywrightRecord[] = [];
        const errors: string[] = [];

        // First check access
        const access = await this.checkAccess();
        if (!access.accessible) {
            return {
                records: [],
                pages: 0,
                errors: [access.message],
            };
        }

        const browser = await this.initBrowser();
        const page = await browser.newPage();

        try {
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });

            let currentPage = 1;
            let hasMore = true;

            while (hasMore && currentPage <= this.maxPages) {
                console.log(`[ERSEP] Scraping page ${currentPage}...`);

                const pageRecords = await this.extractRecordsFromPage(page);
                allRecords.push(...pageRecords);

                console.log(`[ERSEP] Page ${currentPage}: ${pageRecords.length} records`);

                hasMore = await this.hasNextPage(page);

                if (hasMore) {
                    // Click next or navigate to next page
                    const clicked = await page.click('.pagination .next a, a[rel="next"]').catch(() => false);
                    if (!clicked) {
                        // Try URL-based pagination
                        currentPage++;
                        await page.goto(`${this.baseUrl}?page=${currentPage}`, { waitUntil: 'networkidle' });
                    }

                    await page.waitForTimeout(this.rateLimitMs);
                }
            }

            console.log(`[ERSEP] Scraping complete: ${allRecords.length} records from ${currentPage} pages`);

        } catch (error) {
            const errorMsg = `Scraping error: ${error instanceof Error ? error.message : 'Unknown'}`;
            errors.push(errorMsg);
            console.error(`[ERSEP] ${errorMsg}`);
        } finally {
            await page.close();
            await this.closeBrowser();
        }

        return {
            records: allRecords,
            pages: allRecords.length > 0 ? Math.ceil(allRecords.length / 20) : 0,
            errors,
        };
    }

    /**
     * Import scraped records into the database
     */
    async importRecords(records: ERSEPPlaywrightRecord[]): Promise<ImportResult> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                if (!record.name || !record.matricula) {
                    errors++;
                    continue;
                }

                const formattedPhone = formatPhoneForWhatsApp(record.phone);

                const existing = await prisma.unclaimedProfile.findFirst({
                    where: {
                        source: 'ERSEP' as never,
                        matricula: record.matricula,
                    },
                });

                if (existing) {
                    await prisma.unclaimedProfile.update({
                        where: { id: existing.id },
                        data: {
                            fullName: record.name,
                            phone: formattedPhone || existing.phone,
                            email: record.email || existing.email,
                            cuit: record.cuil || existing.cuit,
                            city: record.locality || existing.city,
                            address: record.address || existing.address,
                            category: record.category || existing.category,
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: 'ERSEP' as never,
                            sourceUrl: this.baseUrl,
                            fullName: record.name,
                            matricula: record.matricula,
                            phone: formattedPhone,
                            email: record.email,
                            cuit: record.cuil,
                            city: record.locality,
                            address: record.address,
                            province: 'Córdoba',
                            category: record.category,
                            profession: 'Electricista',
                            scrapedAt: new Date(),
                        },
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`[ERSEP] Error importing ${record.name}:`, error);
                errors++;
            }
        }

        console.log(`[ERSEP] Import complete: ${imported} new, ${updated} updated, ${errors} errors`);

        return {
            imported,
            updated,
            errors,
            total: records.length,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

let scraperInstance: ERSEPPlaywrightScraper | null = null;

export function getERSEPPlaywrightScraper(): ERSEPPlaywrightScraper {
    if (!scraperInstance) {
        scraperInstance = new ERSEPPlaywrightScraper();
    }
    return scraperInstance;
}

export default ERSEPPlaywrightScraper;
