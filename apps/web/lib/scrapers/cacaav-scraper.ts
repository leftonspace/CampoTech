/**
 * CACAAV Scraper (National - HVAC/Refrigeración)
 * ================================================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Scrapes HVAC technician profiles from cacaav.com.ar (national registry).
 * This source contains ~23,000 HVAC/refrigeration professionals
 * with mobile phone numbers and city information.
 * 
 * Target: https://cacaav.com.ar/matriculados/listado
 * Data: Name, Mobile Phone, City, Matricula
 */

import { JSDOM } from 'jsdom';
import { prisma } from '@/lib/prisma';

interface CACAAVRecord {
    name: string;
    mobilePhone: string | null;
    city: string | null;
    province: string | null;
    matricula: string;
}

interface ScrapeResult {
    records: CACAAVRecord[];
    errors: string[];
}

interface ImportResult {
    imported: number;
    updated: number;
    errors: number;
    total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVINCE INFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

const CITY_TO_PROVINCE: Record<string, string> = {
    // Buenos Aires Province
    'la plata': 'Buenos Aires',
    'mar del plata': 'Buenos Aires',
    'bahia blanca': 'Buenos Aires',
    'tandil': 'Buenos Aires',
    'quilmes': 'Buenos Aires',
    'lomas de zamora': 'Buenos Aires',
    'avellaneda': 'Buenos Aires',
    'lanus': 'Buenos Aires',
    'moron': 'Buenos Aires',
    'san isidro': 'Buenos Aires',
    'vicente lopez': 'Buenos Aires',
    'tigre': 'Buenos Aires',
    'pilar': 'Buenos Aires',
    'escobar': 'Buenos Aires',
    'zarate': 'Buenos Aires',
    'campana': 'Buenos Aires',

    // CABA
    'caba': 'CABA',
    'capital federal': 'CABA',
    'buenos aires': 'CABA',
    'ciudad de buenos aires': 'CABA',

    // Córdoba
    'cordoba': 'Córdoba',
    'villa maria': 'Córdoba',
    'rio cuarto': 'Córdoba',
    'carlos paz': 'Córdoba',

    // Santa Fe
    'rosario': 'Santa Fe',
    'santa fe': 'Santa Fe',
    'rafaela': 'Santa Fe',
    'venado tuerto': 'Santa Fe',

    // Mendoza
    'mendoza': 'Mendoza',
    'san rafael': 'Mendoza',
    'godoy cruz': 'Mendoza',

    // Tucumán
    'tucuman': 'Tucumán',
    'san miguel de tucuman': 'Tucumán',

    // Salta
    'salta': 'Salta',

    // Neuquén
    'neuquen': 'Neuquén',

    // Entre Ríos
    'parana': 'Entre Ríos',
    'concordia': 'Entre Ríos',

    // Misiones
    'posadas': 'Misiones',

    // Corrientes
    'corrientes': 'Corrientes',

    // Chaco
    'resistencia': 'Chaco',

    // San Juan
    'san juan': 'San Juan',

    // San Luis
    'san luis': 'San Luis',

    // La Pampa
    'santa rosa': 'La Pampa',

    // Río Negro
    'viedma': 'Río Negro',
    'bariloche': 'Río Negro',
    'general roca': 'Río Negro',

    // Chubut
    'rawson': 'Chubut',
    'trelew': 'Chubut',
    'comodoro rivadavia': 'Chubut',

    // Santa Cruz
    'rio gallegos': 'Santa Cruz',

    // Tierra del Fuego
    'ushuaia': 'Tierra del Fuego',
    'rio grande': 'Tierra del Fuego',
};

function inferProvince(city: string | null): string | null {
    if (!city) return null;

    const cityLower = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const [cityName, province] of Object.entries(CITY_TO_PROVINCE)) {
        if (cityLower.includes(cityName)) {
            return province;
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class CACAAVScraper {
    private baseUrl = 'https://cacaav.com.ar/matriculados/listado';
    private userAgent = 'CampoTech/1.0 (Data collection for professional directory)';

    /**
     * Scrape CACAAV HVAC registry
     * Typically a single page with all records (no pagination)
     */
    async scrape(): Promise<ScrapeResult> {
        const errors: string[] = [];
        const records: CACAAVRecord[] = [];

        console.log(`[CACAAV] Starting scrape from ${this.baseUrl}`);

        try {
            const response = await fetch(this.baseUrl, {
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

            // Try multiple possible table selectors
            const tableSelectors = [
                'table.matriculados tbody tr',
                '#matriculados-table tbody tr',
                '.listado-table tbody tr',
                'table.table tbody tr',
                '.table tbody tr',
                'table tbody tr',
            ];

            let rows: NodeListOf<Element> | null = null;
            for (const selector of tableSelectors) {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    rows = found;
                    console.log(`[CACAAV] Found ${found.length} rows using selector: ${selector}`);
                    break;
                }
            }

            if (!rows || rows.length === 0) {
                // Try card layout
                const cards = document.querySelectorAll('.matriculado, .card, .item, .row');
                if (cards.length > 0) {
                    console.log(`[CACAAV] Found ${cards.length} cards/items`);
                    cards.forEach((card, index) => {
                        try {
                            const record = this.extractFromCard(card);
                            if (record) records.push(record);
                        } catch (error) {
                            errors.push(`Card ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    });
                } else {
                    errors.push('No table or card elements found');
                    console.warn('[CACAAV] Could not find any data elements');
                }
            } else {
                rows.forEach((row, index) => {
                    try {
                        const record = this.extractFromRow(row);
                        if (record) records.push(record);
                    } catch (error) {
                        errors.push(`Row ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                });
            }

            console.log(`[CACAAV] Scraping complete: ${records.length} records, ${errors.length} errors`);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Fetch error: ${errorMsg}`);
            console.error(`[CACAAV] Error scraping:`, error);
        }

        return { records, errors };
    }

    /**
     * Extract record from a table row
     */
    private extractFromRow(row: Element): CACAAVRecord | null {
        const cells = row.querySelectorAll('td');

        // Try class-based extraction
        let name = row.querySelector('.nombre, .name, [data-col="nombre"]')?.textContent?.trim() || '';
        let mobilePhone = row.querySelector('.telefono, .phone, .celular, [data-col="celular"]')?.textContent?.trim() || null;
        let city = row.querySelector('.ciudad, .city, .localidad, [data-col="ciudad"]')?.textContent?.trim() || null;
        let matricula = row.querySelector('.matricula, [data-col="matricula"]')?.textContent?.trim() || '';

        // Fallback to positional extraction
        if (!name && cells.length >= 3) {
            // Common layouts: [Nombre, Celular, Ciudad] or [Matricula, Nombre, Tel, Ciudad]
            if (cells.length >= 4) {
                matricula = cells[0]?.textContent?.trim() || '';
                name = cells[1]?.textContent?.trim() || '';
                mobilePhone = this.cleanPhone(cells[2]?.textContent?.trim() || '');
                city = cells[3]?.textContent?.trim() || null;
            } else {
                name = cells[0]?.textContent?.trim() || '';
                mobilePhone = this.cleanPhone(cells[1]?.textContent?.trim() || '');
                city = cells[2]?.textContent?.trim() || null;
            }
        }

        // Validate required fields
        if (!name || name.length < 3) return null;

        // Generate matricula if not present
        if (!matricula) {
            matricula = `CACAAV-${this.hashString(name)}`;
        }

        // Clean and infer province
        const cleanedCity = city ? this.cleanCity(city) : null;
        const province = inferProvince(cleanedCity);

        return {
            name: this.cleanName(name),
            mobilePhone: this.cleanPhone(mobilePhone),
            city: cleanedCity,
            province,
            matricula,
        };
    }

    /**
     * Extract record from card/list item layout
     */
    private extractFromCard(card: Element): CACAAVRecord | null {
        const name = card.querySelector('.nombre, .name, h3, h4, .title, strong')?.textContent?.trim() || '';
        const mobilePhone = card.querySelector('.telefono, .phone, .celular, [href^="tel:"]')?.textContent?.trim() || null;
        const city = card.querySelector('.ciudad, .city, .localidad, .location')?.textContent?.trim() || null;
        const matricula = card.querySelector('.matricula, .id')?.textContent?.trim() || '';

        if (!name || name.length < 3) return null;

        const cleanedCity = city ? this.cleanCity(city) : null;
        const province = inferProvince(cleanedCity);

        return {
            name: this.cleanName(name),
            mobilePhone: this.cleanPhone(mobilePhone),
            city: cleanedCity,
            province,
            matricula: matricula || `CACAAV-${this.hashString(name)}`,
        };
    }

    /**
     * Import scraped records into the database
     */
    async importRecords(records: CACAAVRecord[]): Promise<ImportResult> {
        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                if (!record.name) {
                    errors++;
                    continue;
                }

                // Check for existing profile
                const existing = await prisma.unclaimedProfile.findFirst({
                    where: {
                        source: 'CACAAV' as never,
                        matricula: record.matricula,
                    },
                });

                if (existing) {
                    // Update existing record
                    await prisma.unclaimedProfile.update({
                        where: { id: existing.id },
                        data: {
                            fullName: record.name,
                            phone: record.mobilePhone || existing.phone,
                            city: record.city || existing.city,
                            province: record.province || existing.province,
                            scrapedAt: new Date(),
                        },
                    });
                    updated++;
                } else {
                    // Create new record
                    await prisma.unclaimedProfile.create({
                        data: {
                            source: 'CACAAV' as never,
                            sourceUrl: this.baseUrl,
                            fullName: record.name,
                            matricula: record.matricula,
                            phone: record.mobilePhone,
                            profession: 'HVAC/Refrigeración',
                            city: record.city,
                            province: record.province,
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

        // Must have at least 8 digits for mobile
        const digits = cleaned.replace(/\D/g, '');
        if (digits.length < 8) return null;

        return cleaned;
    }

    private cleanCity(city: string): string {
        return city
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
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

let scraperInstance: CACAAVScraper | null = null;

export function getCACAAVScraper(): CACAAVScraper {
    if (!scraperInstance) {
        scraperInstance = new CACAAVScraper();
    }
    return scraperInstance;
}

export default CACAAVScraper;
