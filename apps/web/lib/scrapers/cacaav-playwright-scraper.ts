/**
 * CACAAV Playwright Scraper (National - HVAC/Refrigeración)
 * ==========================================================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Scrapes HVAC technician profiles from cacaav.com.ar using Playwright.
 * This is required because the site uses dynamic province/locality dropdowns
 * and has ~23,000 records across ~1,150 pages.
 * 
 * Target: https://www.cacaav.com.ar/matriculados/listado
 * Data: Name, Phone, Email, City, Province, Category, Matricula, Expiration
 * 
 * Strategy: Iterate by province to reduce page count per batch
 */

import { chromium, Browser, Page } from 'playwright';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface CACAAVPlaywrightRecord {
    name: string;
    category: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    expiration: string | null;
    matricula: string;
}

interface ScrapeResult {
    records: CACAAVPlaywrightRecord[];
    pages: number;
    errors: string[];
}

interface ImportResult {
    imported: number;
    updated: number;
    errors: number;
    total: number;
}

// Province name to ID mapping (from actual CACAAV dropdown - VERIFIED)
const PROVINCE_IDS: Record<string, string> = {
    'Buenos Aires': '16',
    'CABA': '34',
    'Catamarca': '28',
    'Chaco': '30',
    'Chubut': '29',
    'Córdoba': '15',
    'Cordoba': '15', // Alternative spelling
    'Corrientes': '31',
    'Entre Ríos': '17',
    'Entre Rios': '17', // Alternative spelling
    'Formosa': '33',
    'Jujuy': '20',
    'La Pampa': '22',
    'La Rioja': '21',
    'Mendoza': '13',
    'Misiones': '32',
    'Neuquén': '24',
    'Neuquen': '24', // Alternative spelling
    'Río Negro': '23',
    'Rio Negro': '23', // Alternative spelling
    'Salta': '19',
    'San Juan': '14',
    'San Luis': '25',
    'Santa Cruz': '26',
    'Santa Fe': '18',
    'Santiago del Estero': '27',
    'Tierra del Fuego': '35',
    'Tucumán': '36',
    'Tucuman': '36', // Alternative spelling
};


// ═══════════════════════════════════════════════════════════════════════════════
// PHONE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format phone number for WhatsApp (Argentine format)
 */
function formatPhoneForWhatsApp(phone: string | null): string | null {
    if (!phone || phone.trim() === '-' || phone.trim() === '') return null;

    // Remove all non-digits except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Remove leading 0
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

    // Handle 15 prefix
    if (cleaned.startsWith('15') && cleaned.length >= 9) {
        cleaned = cleaned.slice(2);
    }

    // Must have at least 10 digits
    if (cleaned.length < 10 || cleaned.length > 13) return null;

    // Add Argentina prefix if needed
    if (!cleaned.startsWith('549')) {
        cleaned = `549${cleaned}`;
    }

    return `+${cleaned}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class CACAAVPlaywrightScraper {
    private baseUrl = 'https://www.cacaav.com.ar/matriculados/listado';
    private browser: Browser | null = null;
    private rateLimitMs = 1000;
    private maxPagesPerProvince = 100; // Limit to prevent infinite loops

    /**
     * Set maximum pages to scrape per province
     */
    setMaxPages(max: number): void {
        this.maxPagesPerProvince = Math.max(1, Math.min(max, 200));
    }

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
     * Extract records from the current page
     */
    private async extractRecordsFromPage(page: Page): Promise<CACAAVPlaywrightRecord[]> {
        return page.evaluate(() => {
            const cards = document.querySelectorAll('.Tarjeta');
            const records: CACAAVPlaywrightRecord[] = [];

            cards.forEach((card) => {
                const name = card.querySelector('.Tarjeta-titulo')?.textContent?.trim() || '';
                const category = card.querySelector('.Tarjeta-subtitulo')?.textContent?.trim() || null;

                // Extract phone from icon-phone element
                const phoneEl = card.querySelector('.Tarjeta-dato .icon-phone')?.parentElement;
                const phone = phoneEl?.textContent?.trim() || null;

                // Extract email from mailto link
                const emailLink = card.querySelector('.Tarjeta-enlaces a[href^="mailto:"]');
                const email = emailLink?.getAttribute('href')?.replace('mailto:', '') || null;

                // Extract location (address + city/province)
                const locationEl = card.querySelector('.Tarjeta-dato .icon-place')?.parentElement;
                const locationText = locationEl?.textContent?.trim() || '';

                // Extract expiration from icon-clock element
                const expirationEl = card.querySelector('.Tarjeta-dato .icon-clock')?.parentElement;
                const expiration = expirationEl?.textContent?.replace('Vto:', '').trim() || null;

                // Parse location into address/city/province
                let address = null;
                let city = null;
                let province = null;
                if (locationText) {
                    // Location format is typically "Address, City, Province"
                    const parts = locationText.split(',').map(p => p.trim());
                    if (parts.length >= 3) {
                        address = parts.slice(0, -2).join(', ');
                        city = parts[parts.length - 2];
                        province = parts[parts.length - 1];
                    } else if (parts.length === 2) {
                        city = parts[0];
                        province = parts[1];
                    } else {
                        city = parts[0];
                    }
                }

                // Generate matricula from name hash if not found
                const hashName = (str: string) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    }
                    return Math.abs(hash).toString(36).substring(0, 8);
                };

                if (name) {
                    records.push({
                        name,
                        category,
                        phone,
                        email,
                        address,
                        city,
                        province,
                        expiration,
                        matricula: `CACAAV-${hashName(name)}`,
                    });
                }
            });

            return records;
        });
    }

    /**
     * Check if there's a next page
     */
    private async hasNextPage(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            const nextLink = document.querySelector('.pagination a[href*="page="]:last-child');
            return nextLink?.textContent?.includes('Siguiente') || false;
        });
    }

    /**
     * Scrape all records for a specific province
     */
    async scrapeProvince(provinceName: string): Promise<CACAAVPlaywrightRecord[]> {
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        const allRecords: CACAAVPlaywrightRecord[] = [];

        try {
            console.log(`[CACAAV] Scraping province: ${provinceName}`);

            const provinceId = PROVINCE_IDS[provinceName];
            if (!provinceId) {
                console.warn(`[CACAAV] Unknown province: ${provinceName}`);
                return allRecords;
            }

            let currentPage = 0;
            let hasMore = true;

            while (hasMore && currentPage < this.maxPagesPerProvince) {
                // Navigate directly to filtered URL (much more reliable than form submission)
                // CACAAV uses 0-indexed pagination: page=0 is the first page
                const url = `${this.baseUrl}?provincia=${provinceId}&page=${currentPage}`;
                await page.goto(url, { waitUntil: 'networkidle' });

                // Wait for cards to load - use .Tarjeta-enlace-mail as it's more reliable
                await page.waitForSelector('.Tarjeta-enlace-mail', { timeout: 10000 }).catch(() => { });

                // Extract records from current page
                const pageRecords = await this.extractRecordsFromPage(page);

                // If no records found, we've reached the end
                if (pageRecords.length === 0) {
                    hasMore = false;
                    break;
                }

                allRecords.push(...pageRecords);
                console.log(`[CACAAV] ${provinceName} - Page ${currentPage + 1}: ${pageRecords.length} records (total: ${allRecords.length})`);

                // Check if there's a next page link
                hasMore = await this.hasNextPage(page);

                if (hasMore) {
                    currentPage++;
                    // Rate limiting
                    await page.waitForTimeout(this.rateLimitMs);
                }
            }

            console.log(`[CACAAV] ${provinceName} complete: ${allRecords.length} total records from ${currentPage + 1} pages`);

        } catch (error) {
            console.error(`[CACAAV] Error scraping ${provinceName}:`, error);
        } finally {
            await page.close();
        }

        return allRecords;
    }


    /**
     * Scrape all provinces (or a subset) with job tracking for resume
     */
    async scrapeAll(provinces?: string[]): Promise<ScrapeResult> {
        const provincesToScrape = provinces || Object.keys(PROVINCE_IDS);
        const allRecords: CACAAVPlaywrightRecord[] = [];
        const errors: string[] = [];
        let totalPages = 0;

        // Start or resume job tracking
        const { ScraperJobTracker } = await import('./job-tracker');
        const jobTracker = new ScraperJobTracker('CACAAV');
        await jobTracker.startJob(provincesToScrape);

        // Get remaining provinces (if resuming)
        const remainingProvinces = await jobTracker.getRemainingProvinces(provincesToScrape);
        console.log(`[CACAAV] Provinces remaining: ${remainingProvinces.length}/${provincesToScrape.length}`);

        for (const province of remainingProvinces) {
            try {
                const records = await this.scrapeProvince(province);
                allRecords.push(...records);
                totalPages += Math.ceil(records.length / 20);

                // Mark province as completed
                await jobTracker.completeProvince(province, records.length);

                // Delay between provinces
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                const errorMsg = `Province ${province}: ${error instanceof Error ? error.message : 'Unknown'}`;
                errors.push(errorMsg);
                await jobTracker.addError(errorMsg);
                console.error(`[CACAAV] ${errorMsg}`);
            }
        }

        await this.closeBrowser();

        // Mark job as completed
        await jobTracker.completeJob(allRecords.length);

        console.log(`[CACAAV] Scraping complete: ${allRecords.length} records from ${remainingProvinces.length} provinces`);

        return {
            records: allRecords,
            pages: totalPages,
            errors,
        };
    }

    /**
     * Quick scrape of just the first page (for testing)
     */
    async scrapeFirstPage(): Promise<ScrapeResult> {
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        const errors: string[] = [];

        try {
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
            await page.waitForSelector('.Tarjeta', { timeout: 10000 });

            const records = await this.extractRecordsFromPage(page);

            await this.closeBrowser();

            return {
                records,
                pages: 1,
                errors,
            };
        } catch (error) {
            errors.push(`First page error: ${error instanceof Error ? error.message : 'Unknown'}`);
            await this.closeBrowser();
            return { records: [], pages: 0, errors };
        }
    }

    /**
     * Scrape N pages total (across all or selected provinces)
     * Good for testing with a specific page count
     */
    async scrapePages(maxPages: number, provinces?: string[]): Promise<ScrapeResult> {
        this.setMaxPages(maxPages);
        return this.scrapeAll(provinces);
    }

    /**
     * Import scraped records into the database
     */
    async importRecords(records: CACAAVPlaywrightRecord[]): Promise<ImportResult> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                if (!record.name) {
                    errors++;
                    continue;
                }

                const formattedPhone = formatPhoneForWhatsApp(record.phone);

                // Check for existing profile
                const existing = await prisma.unclaimedProfile.findFirst({
                    where: {
                        source: 'CACAAV' as never,
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
                            address: record.address || existing.address,
                            city: record.city || existing.city,
                            province: record.province || existing.province,
                            category: record.category || existing.category,
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: 'CACAAV' as never,
                            sourceUrl: this.baseUrl,
                            fullName: record.name,
                            matricula: record.matricula,
                            phone: formattedPhone,
                            email: record.email,
                            address: record.address,
                            city: record.city,
                            province: record.province,
                            category: record.category,
                            profession: 'HVAC/Refrigeración',
                            scrapedAt: new Date(),
                        },
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`[CACAAV] Error importing ${record.name}:`, error);
                errors++;
            }
        }

        console.log(`[CACAAV] Import complete: ${imported} new, ${updated} updated, ${errors} errors`);

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

let scraperInstance: CACAAVPlaywrightScraper | null = null;

export function getCACAAVPlaywrightScraper(): CACAAVPlaywrightScraper {
    if (!scraperInstance) {
        scraperInstance = new CACAAVPlaywrightScraper();
    }
    return scraperInstance;
}

export default CACAAVPlaywrightScraper;
