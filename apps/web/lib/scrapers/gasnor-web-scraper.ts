/**
 * Gasnor/Naturgy NOA Web Scraper
 * ================================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Scrapes gas technician profiles from naturgynoa.com.ar/instaladores.
 * This scraper extracts data including emails which are available in the DOM.
 * 
 * Target: https://www.naturgynoa.com.ar/instaladores
 * Data: Matrícula, Category, Name, Address, Locality, Province, Phone, Cell, Email
 * 
 * Note: Emails are in the DOM as mailto: links with title attribute
 * Total records: ~1,033 (all loaded in single table, no pagination)
 */

import { chromium, Browser, Page } from 'playwright';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface GasnorWebRecord {
    matricula: string;
    category: string;
    lastName: string;
    firstName: string;
    fullName: string;
    address: string | null;
    locality: string | null;
    province: string;
    phone: string | null;
    cellphone: string | null;
    email: string | null;
}

interface ScrapeResult {
    records: GasnorWebRecord[];
    provinces: string[];
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

// Area codes by province for Gasnor region
const PROVINCE_AREA_CODES: Record<string, string> = {
    'JUJUY': '388',
    'SALTA': '387',
    'SANTIAGO DEL ESTERO': '385',
    'TUCUMAN': '381',
};

/**
 * Format phone number for WhatsApp (Argentine format)
 */
function formatPhoneForWhatsApp(phone: string | null, province: string): string | null {
    if (!phone || phone.trim() === '-' || phone.trim() === '') return null;

    // Get default area code for province
    const defaultAreaCode = PROVINCE_AREA_CODES[province.toUpperCase()] || '387';

    // Remove all non-digits
    let cleaned = phone.replace(/[^\d]/g, '');

    // Remove leading zeros
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }

    // Handle 15 prefix (local mobile indicator)
    if (cleaned.startsWith('15') && cleaned.length >= 9) {
        cleaned = cleaned.slice(2);
        if (cleaned.length <= 8) {
            cleaned = defaultAreaCode + cleaned;
        }
    }

    // If short number, add area code
    if (cleaned.length >= 6 && cleaned.length <= 8) {
        cleaned = defaultAreaCode + cleaned;
    }

    // Validate length (should be 10-12 digits)
    if (cleaned.length < 9 || cleaned.length > 12) {
        return null;
    }

    return `+549${cleaned}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class GasnorWebScraper {
    private baseUrl = 'https://www.naturgynoa.com.ar/instaladores';
    private browser: Browser | null = null;
    private retryDelayMs = 2000;
    private maxRetries = 3;

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
     * Scrape all installers for a specific province
     */
    async scrapeProvince(province: string): Promise<GasnorWebRecord[]> {
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        const records: GasnorWebRecord[] = [];

        try {
            console.log(`[Gasnor Web] Scraping province: ${province}`);

            // Navigate to the page
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });

            // Select province in dropdown
            await page.selectOption('#provincia', { label: province });

            // Click search button
            await page.click('#btnEnvioBusquda');

            // Wait for results to load
            await page.waitForSelector('table tbody tr', { timeout: 30000 });

            // Extract all rows from the table
            const rowData = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tbody tr');
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    const emailLink = row.querySelector('a[href^="mailto:"]');

                    return {
                        matricula: cells[0]?.textContent?.trim() || '',
                        category: cells[1]?.textContent?.trim() || '',
                        lastName: cells[2]?.textContent?.trim() || '',
                        firstName: cells[3]?.textContent?.trim() || '',
                        address: cells[4]?.textContent?.trim() || null,
                        locality: cells[5]?.textContent?.trim() || null,
                        province: cells[6]?.textContent?.trim() || '',
                        phone: cells[7]?.textContent?.trim() || null,
                        cellphone: cells[8]?.textContent?.trim() || null,
                        email: emailLink?.getAttribute('title') ||
                            emailLink?.getAttribute('href')?.replace('mailto:', '') || null,
                    };
                });
            });

            // Process and format records
            for (const row of rowData) {
                if (!row.matricula || !row.lastName) continue;

                records.push({
                    matricula: row.matricula,
                    category: row.category,
                    lastName: row.lastName,
                    firstName: row.firstName,
                    fullName: `${row.lastName}, ${row.firstName}`.trim(),
                    address: row.address,
                    locality: row.locality,
                    province: row.province || province,
                    phone: row.phone && row.phone !== '-' ? row.phone : null,
                    cellphone: row.cellphone && row.cellphone !== '-' ? row.cellphone : null,
                    email: row.email?.toLowerCase() || null,
                });
            }

            console.log(`[Gasnor Web] Found ${records.length} records for ${province}`);
        } catch (error) {
            console.error(`[Gasnor Web] Error scraping ${province}:`, error);
        } finally {
            await page.close();
        }

        return records;
    }

    /**
     * Scrape all provinces
     */
    async scrapeAll(): Promise<ScrapeResult> {
        const allRecords: GasnorWebRecord[] = [];
        const errors: string[] = [];
        const provinces = ['JUJUY', 'SALTA', 'SANTIAGO DEL ESTERO', 'TUCUMAN'];

        for (const province of provinces) {
            try {
                const records = await this.scrapeProvince(province);
                allRecords.push(...records);

                // Rate limiting between provinces
                await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
            } catch (error) {
                const errorMsg = `Province ${province}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                console.error(`[Gasnor Web] ${errorMsg}`);
            }
        }

        await this.closeBrowser();

        console.log(`[Gasnor Web] Scraping complete: ${allRecords.length} total records`);

        return {
            records: allRecords,
            provinces,
            errors,
        };
    }

    /**
     * Import scraped records into the database
     */
    async importRecords(records: GasnorWebRecord[]): Promise<ImportResult> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                if (!record.fullName || !record.matricula) {
                    errors++;
                    continue;
                }

                // Format phone numbers for WhatsApp
                const formattedPhone = formatPhoneForWhatsApp(record.phone, record.province);
                const formattedCellphone = formatPhoneForWhatsApp(record.cellphone, record.province);

                // Collect all valid phones
                const phones: string[] = [];
                if (formattedCellphone) phones.push(formattedCellphone);
                if (formattedPhone && formattedPhone !== formattedCellphone) phones.push(formattedPhone);

                // Check for existing profile
                const existing = await prisma.unclaimedProfile.findFirst({
                    where: {
                        source: 'GASNOR' as never,
                        matricula: record.matricula,
                    },
                });

                if (existing) {
                    // Update existing record
                    await prisma.unclaimedProfile.update({
                        where: { id: existing.id },
                        data: {
                            fullName: record.fullName,
                            phone: phones[0] || existing.phone,
                            phones: phones.length > 0 ? phones : existing.phones,
                            email: record.email || existing.email,
                            address: record.address || existing.address,
                            city: record.locality || existing.city,
                            province: record.province || existing.province,
                            category: record.category || existing.category,
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    // Create new record
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: 'GASNOR' as never,
                            sourceUrl: this.baseUrl,
                            fullName: record.fullName,
                            matricula: record.matricula,
                            phone: phones[0] || null,
                            phones: phones,
                            email: record.email,
                            address: record.address,
                            city: record.locality,
                            province: record.province,
                            category: record.category,
                            profession: 'Gasista',
                            scrapedAt: new Date(),
                        },
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`[Gasnor Web] Error importing ${record.fullName}:`, error);
                errors++;
            }
        }

        console.log(`[Gasnor Web] Import complete: ${imported} new, ${updated} updated, ${errors} errors`);

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

let scraperInstance: GasnorWebScraper | null = null;

export function getGasnorWebScraper(): GasnorWebScraper {
    if (!scraperInstance) {
        scraperInstance = new GasnorWebScraper();
    }
    return scraperInstance;
}

export default GasnorWebScraper;
