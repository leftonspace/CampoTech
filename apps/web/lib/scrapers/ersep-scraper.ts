/**
 * ERSEP Scraper (Córdoba - Electricistas)
 * ========================================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Scrapes electrician profiles from volta.net.ar (ERSEP public registry).
 * This is a critical data source with ~33,000 profiles including
 * phone numbers and emails.
 * 
 * Target: https://volta.net.ar/matriculados
 * Data: Name, Phone, Email, Category, Matricula
 */

import { JSDOM } from 'jsdom';
import { prisma } from '@/lib/prisma';

interface ERSEPRecord {
    name: string;
    phone: string | null;
    email: string | null;
    category: string;
    matricula: string;
}

interface ScrapeResult {
    records: ERSEPRecord[];
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
// SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ERSEPScraper {
    private baseUrl = 'https://volta.net.ar';
    private userAgent = 'CampoTech/1.0 (Data collection for professional directory)';
    private rateLimitMs = 1500; // Be respectful - 1.5 second delay

    /**
     * Scrape a single page of ERSEP records
     */
    async scrapePage(pageNumber: number): Promise<{ records: ERSEPRecord[]; hasNextPage: boolean }> {
        const url = `${this.baseUrl}/matriculados?page=${pageNumber}`;
        console.log(`[ERSEP] Scraping page ${pageNumber}: ${url}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'es-AR,es;q=0.9',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            const records: ERSEPRecord[] = [];

            // Try multiple possible table selectors
            const tableSelectors = [
                '.matriculados-table tbody tr',
                '.table tbody tr',
                'table tbody tr',
                '.listado tbody tr',
                '#matriculados tbody tr',
            ];

            let rows: NodeList | null = null;
            for (const selector of tableSelectors) {
                rows = document.querySelectorAll(selector);
                if (rows.length > 0) break;
            }

            if (!rows || rows.length === 0) {
                console.warn(`[ERSEP] No table rows found on page ${pageNumber}`);

                // Try to extract from card/list layout instead
                const cards = document.querySelectorAll('.matriculado-card, .card, .profile-item');
                if (cards.length > 0) {
                    cards.forEach((card) => {
                        const record = this.extractFromCard(card as Element);
                        if (record) records.push(record);
                    });
                }
            } else {
                rows.forEach((row) => {
                    const record = this.extractFromRow(row as Element);
                    if (record) records.push(record);
                });
            }

            // Check for pagination
            const hasNextPage = this.checkNextPage(document);

            console.log(`[ERSEP] Page ${pageNumber}: Found ${records.length} records, hasNext: ${hasNextPage}`);

            return { records, hasNextPage };
        } catch (error) {
            console.error(`[ERSEP] Error scraping page ${pageNumber}:`, error);
            return { records: [], hasNextPage: false };
        }
    }

    /**
     * Extract record from a table row
     */
    private extractFromRow(row: Element): ERSEPRecord | null {
        const cells = row.querySelectorAll('td');

        // Try different column mappings
        let name = '';
        let phone: string | null = null;
        let email: string | null = null;
        let category = '';
        let matricula = '';

        // Try class-based extraction first
        name = row.querySelector('.nombre, .name, [data-col="nombre"]')?.textContent?.trim() || '';
        phone = row.querySelector('.telefono, .phone, [data-col="telefono"]')?.textContent?.trim() || null;
        email = row.querySelector('.email, [data-col="email"]')?.textContent?.trim() || null;
        category = row.querySelector('.categoria, .category, [data-col="categoria"]')?.textContent?.trim() || '';
        matricula = row.querySelector('.matricula, [data-col="matricula"]')?.textContent?.trim() || '';

        // Fall back to positional extraction
        if (!name && cells.length >= 3) {
            // Typical layouts: [Nombre, Matricula, Categoría] or [Matricula, Nombre, Tel, Email, Cat]
            if (cells.length >= 5) {
                // Full data layout
                matricula = cells[0]?.textContent?.trim() || '';
                name = cells[1]?.textContent?.trim() || '';
                phone = this.cleanPhone(cells[2]?.textContent?.trim() || '');
                email = this.cleanEmail(cells[3]?.textContent?.trim() || '');
                category = cells[4]?.textContent?.trim() || '';
            } else if (cells.length >= 3) {
                // Compact layout
                name = cells[0]?.textContent?.trim() || '';
                matricula = cells[1]?.textContent?.trim() || '';
                category = cells[2]?.textContent?.trim() || '';
                phone = cells[3]?.textContent?.trim() || null;
                email = cells[4]?.textContent?.trim() || null;
            }
        }

        // Validate required fields
        if (!name || name.length < 3) return null;
        if (!matricula) {
            // Generate matricula from name hash
            matricula = `ERSEP-${this.hashString(name)}`;
        }

        return {
            name: this.cleanName(name),
            phone: this.cleanPhone(phone),
            email: this.cleanEmail(email),
            category: category || 'Electricista',
            matricula,
        };
    }

    /**
     * Extract record from a card/list item layout
     */
    private extractFromCard(card: Element): ERSEPRecord | null {
        const name = card.querySelector('.nombre, .name, h3, h4, .title')?.textContent?.trim() || '';
        const phone = card.querySelector('.telefono, .phone, [href^="tel:"]')?.textContent?.trim() || null;
        const email = card.querySelector('.email, [href^="mailto:"]')?.textContent?.trim() || null;
        const category = card.querySelector('.categoria, .category, .tipo')?.textContent?.trim() || '';
        const matricula = card.querySelector('.matricula, .id')?.textContent?.trim() || '';

        if (!name || name.length < 3) return null;

        return {
            name: this.cleanName(name),
            phone: this.cleanPhone(phone),
            email: this.cleanEmail(email),
            category: category || 'Electricista',
            matricula: matricula || `ERSEP-${this.hashString(name)}`,
        };
    }

    /**
     * Check if there's a next page
     */
    private checkNextPage(document: Document): boolean {
        // Common pagination patterns
        const nextSelectors = [
            '.pagination .next:not(.disabled)',
            '.pagination a[rel="next"]',
            'a.next-page:not(.disabled)',
            '.pager .next:not(.disabled)',
            'nav[aria-label="pagination"] a:last-child:not(.disabled)',
        ];

        for (const selector of nextSelectors) {
            const nextButton = document.querySelector(selector);
            if (nextButton) return true;
        }

        return false;
    }

    /**
     * Scrape all pages with rate limiting
     */
    async scrapeAll(maxPages = 100): Promise<ScrapeResult> {
        const allRecords: ERSEPRecord[] = [];
        const errors: string[] = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage && currentPage <= maxPages) {
            try {
                const { records, hasNextPage: nextExists } = await this.scrapePage(currentPage);
                allRecords.push(...records);
                hasNextPage = nextExists;
                currentPage++;

                // Rate limiting - be respectful
                if (hasNextPage) {
                    await new Promise(resolve => setTimeout(resolve, this.rateLimitMs));
                }
            } catch (error) {
                const errorMsg = `Page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                console.error(`[ERSEP] ${errorMsg}`);

                // Continue to next page on error
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, this.rateLimitMs * 2));
            }
        }

        console.log(`[ERSEP] Scraping complete: ${allRecords.length} records from ${currentPage - 1} pages`);

        return {
            records: allRecords,
            pages: currentPage - 1,
            errors,
        };
    }

    /**
     * Import scraped records into the database
     */
    async importRecords(records: ERSEPRecord[]): Promise<ImportResult> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                if (!record.name || !record.matricula) {
                    errors++;
                    continue;
                }

                // Check for existing profile
                const existing = await prisma.unclaimedProfile.findFirst({
                    where: {
                        source: 'ERSEP' as never,
                        matricula: record.matricula,
                    },
                });

                if (existing) {
                    // Update existing record
                    await prisma.unclaimedProfile.update({
                        where: { id: existing.id },
                        data: {
                            fullName: record.name,
                            phone: record.phone || existing.phone,
                            email: record.email || existing.email,
                            profession: record.category || 'ELECTRICISTA',
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    // Create new record
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: 'ERSEP' as never,
                            sourceUrl: `${this.baseUrl}/matriculados`,
                            fullName: record.name,
                            matricula: record.matricula,
                            phone: record.phone,
                            email: record.email,
                            profession: record.category || 'ELECTRICISTA',
                            province: 'Córdoba',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════════════════

    private cleanName(name: string): string {
        return name
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    private cleanPhone(phone: string | null): string | null {
        if (!phone) return null;

        // Remove common non-phone text
        const cleaned = phone
            .replace(/[^\d+\-\s()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Must have at least 8 digits to be a valid phone
        const digits = cleaned.replace(/\D/g, '');
        if (digits.length < 8) return null;

        return cleaned;
    }

    private cleanEmail(email: string | null): string | null {
        if (!email) return null;

        // Extract email from text
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = email.match(emailPattern);

        return match ? match[0].toLowerCase() : null;
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).substring(0, 8);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

let scraperInstance: ERSEPScraper | null = null;

export function getERSEPScraper(): ERSEPScraper {
    if (!scraperInstance) {
        scraperInstance = new ERSEPScraper();
    }
    return scraperInstance;
}

export default ERSEPScraper;
