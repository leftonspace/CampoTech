/**
 * CACAAV Full Scrape Script
 * ==========================
 * 
 * Usage: 
 *   npx tsx scripts/scrape-cacaav-full.ts
 * 
 * Clear existing first (optional):
 *   npx tsx scripts/clear-cacaav.ts
 */

import { PrismaClient } from '@prisma/client';
import { chromium, Browser, Page } from 'playwright';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = 'https://www.cacaav.com.ar/matriculados/listado';
const MAX_PAGES_PER_PROVINCE = 200;
const RATE_LIMIT_MS = 2000;
const PROVINCE_DELAY_MS = 5000;
const SELECTOR_TIMEOUT_MS = 120000; // 2 minutes - returns immediately when found
const CONSECUTIVE_EMPTY_THRESHOLD = 5; // More tolerant of sparse pagination

// Correct Province IDs from CACAAV website dropdown (verified 2026-01-08)
const PROVINCE_IDS: Record<string, string> = {
    'Buenos Aires': '16',
    'CABA': '34',
    'Catamarca': '28',
    'Chaco': '19',
    'Chubut': '27',
    'Córdoba': '15',
    'Corrientes': '32',
    'Entre Ríos': '17',
    'Formosa': '36',
    'Jujuy': '30',
    'La Pampa': '22',
    'La Rioja': '25',
    'Mendoza': '21',
    'Misiones': '26',
    'Neuquén': '20',
    'Río Negro': '14',
    'Salta': '31',
    'San Juan': '29',
    'San Luis': '24',
    'Santa Cruz': '37',
    'Santa Fe': '18',
    'Santiago del Estero': '33',
    'Tierra del Fuego': '35',
    'Tucumán': '23',
};

const ALL_PROVINCES = Object.keys(PROVINCE_IDS);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CACAAVRecord {
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

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const prisma = new PrismaClient();

function formatPhoneForWhatsApp(phone: string | null): string | null {
    if (!phone || phone.trim() === '-' || phone.trim() === '') return null;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (cleaned.startsWith('15') && cleaned.length >= 9) {
        cleaned = cleaned.slice(2);
    }
    if (cleaned.length < 10 || cleaned.length > 13) return null;
    if (!cleaned.startsWith('549')) {
        cleaned = '549' + cleaned;
    }
    return '+' + cleaned;
}

function sleep(ms: number): Promise<void> {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPING - Using string-based evaluate to avoid TS compilation issues
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRACT_SCRIPT = `
(function() {
    var cards = document.querySelectorAll('.Tarjeta');
    var records = [];

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var name = '';
        var category = null;
        var phone = null;
        var email = null;
        var address = null;
        var city = null;
        var province = null;
        var expiration = null;

        var titleEl = card.querySelector('.Tarjeta-titulo');
        if (titleEl) name = titleEl.textContent.trim();

        var subtitleEl = card.querySelector('.Tarjeta-subtitulo');
        if (subtitleEl) category = subtitleEl.textContent.trim();

        var phoneIcon = card.querySelector('.icon-phone');
        if (phoneIcon && phoneIcon.parentElement) {
            phone = phoneIcon.parentElement.textContent.trim();
        }

        var emailLink = card.querySelector('a[href^="mailto:"]');
        if (emailLink) {
            email = emailLink.getAttribute('href').replace('mailto:', '');
        }

        var placeIcon = card.querySelector('.icon-place');
        if (placeIcon && placeIcon.parentElement) {
            var locationText = placeIcon.parentElement.textContent.trim();
            if (locationText) {
                var parts = locationText.split(',');
                for (var j = 0; j < parts.length; j++) {
                    parts[j] = parts[j].trim();
                }
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
        }

        var clockIcon = card.querySelector('.icon-clock');
        if (clockIcon && clockIcon.parentElement) {
            expiration = clockIcon.parentElement.textContent.replace('Vto:', '').trim();
        }

        if (name) {
            var hash = 0;
            var hashInput = name + (email || '') + (phone || '');
            for (var k = 0; k < hashInput.length; k++) {
                hash = ((hash << 5) - hash) + hashInput.charCodeAt(k);
            }
            var matricula = 'CACAAV-' + Math.abs(hash).toString(36).substring(0, 8);

            records.push({
                name: name,
                category: category,
                phone: phone,
                email: email,
                address: address,
                city: city,
                province: province,
                expiration: expiration,
                matricula: matricula
            });
        }
    }

    return records;
})()
`;

async function extractRecordsFromPage(page: Page): Promise<CACAAVRecord[]> {
    try {
        const records = await page.evaluate(EXTRACT_SCRIPT) as CACAAVRecord[];
        return records || [];
    } catch (err) {
        console.log('   ⚠️  Extract error:', err);
        return [];
    }
}

async function scrapeProvince(browser: Browser, provinceName: string): Promise<CACAAVRecord[]> {
    const page = await browser.newPage();
    const allRecords: CACAAVRecord[] = [];
    const provinceId = PROVINCE_IDS[provinceName];

    if (!provinceId) {
        console.log('   ⚠️  Unknown province ID for:', provinceName);
        await page.close();
        return allRecords;
    }

    try {
        let currentPage = 0;
        let consecutiveEmptyPages = 0;

        while (currentPage < MAX_PAGES_PER_PROVINCE) {
            const url = BASE_URL + '?provincia=' + provinceId + '&page=' + currentPage;
            let pageLoaded = false;

            // Try navigation with generous timeout
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
                pageLoaded = true;
            } catch {
                console.log('   ⚠️  Navigation timeout on page ' + (currentPage + 1) + ', retrying with domcontentloaded...');
                await sleep(3000);
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    // Give extra time for JS to render after domcontentloaded
                    await sleep(5000);
                    pageLoaded = true;
                } catch {
                    console.log('   ⚠️  Failed to load page ' + (currentPage + 1) + ', skipping to next page');
                    // Don't break - just skip this page and try the next one
                    currentPage++;
                    consecutiveEmptyPages++;
                    if (consecutiveEmptyPages >= CONSECUTIVE_EMPTY_THRESHOLD) {
                        console.log('   ⏹️  ' + CONSECUTIVE_EMPTY_THRESHOLD + ' consecutive empty/failed pages, moving to next province');
                        break;
                    }
                    await sleep(RATE_LIMIT_MS);
                    continue;
                }
            }

            // Wait for content with 2 minute timeout (returns immediately when found)
            let hasCards = false;
            if (pageLoaded) {
                try {
                    await page.waitForSelector('.Tarjeta', { timeout: SELECTOR_TIMEOUT_MS });
                    hasCards = true;
                } catch {
                    // No cards found within timeout - this page is genuinely empty
                    console.log('   ⏳ Page ' + (currentPage + 1) + ': no cards found after waiting');
                    hasCards = false;
                }
            }

            const pageRecords = hasCards ? await extractRecordsFromPage(page) : [];

            if (pageRecords.length === 0) {
                consecutiveEmptyPages++;
                console.log('   📭 Page ' + (currentPage + 1) + ': empty (' + consecutiveEmptyPages + '/' + CONSECUTIVE_EMPTY_THRESHOLD + ' consecutive)');
                if (consecutiveEmptyPages >= CONSECUTIVE_EMPTY_THRESHOLD) {
                    console.log('   ⏹️  ' + CONSECUTIVE_EMPTY_THRESHOLD + ' consecutive empty pages, moving to next province');
                    break;
                }
            } else {
                consecutiveEmptyPages = 0;
                allRecords.push(...pageRecords);
                console.log('   📄 Page ' + (currentPage + 1) + ': +' + pageRecords.length + ' records (' + allRecords.length + ' total)');
            }

            currentPage++;
            await sleep(RATE_LIMIT_MS);
        }

        console.log('   ✅ Scraped ' + currentPage + ' pages, found ' + allRecords.length + ' records');

    } catch (error) {
        console.error('   ❌ Error scraping ' + provinceName + ':', error);
    } finally {
        await page.close();
    }

    return allRecords;
}

async function importRecords(records: CACAAVRecord[]): Promise<{ imported: number; updated: number; errors: number }> {
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

            const existing = await prisma.unclaimedProfile.findFirst({
                where: {
                    source: 'CACAAV',
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
                        source: 'CACAAV',
                        sourceUrl: BASE_URL,
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
        } catch {
            errors++;
        }
    }

    return { imported, updated, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 CACAAV FULL SCRAPE');
    console.log('═'.repeat(60));
    console.log('📍 Provinces: ' + ALL_PROVINCES.length);
    console.log('📄 Max pages per province: ' + MAX_PAGES_PER_PROVINCE);
    console.log('⏱️  Rate limit: ' + RATE_LIMIT_MS + 'ms between pages');
    console.log('\n⚠️  This will take 2-4 hours to complete.\n');

    const startTime = Date.now();

    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let totalRecords = 0;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const provinceErrors: string[] = [];

    for (let i = 0; i < ALL_PROVINCES.length; i++) {
        const province = ALL_PROVINCES[i];
        const provinceStart = Date.now();

        console.log('\n' + '─'.repeat(60));
        console.log('📍 [' + (i + 1) + '/' + ALL_PROVINCES.length + '] ' + province);
        console.log('─'.repeat(60));

        try {
            const records = await scrapeProvince(browser, province);
            totalRecords += records.length;

            if (records.length > 0) {
                console.log('   💾 Importing ' + records.length + ' records...');
                const importResult = await importRecords(records);
                totalImported += importResult.imported;
                totalUpdated += importResult.updated;
                totalErrors += importResult.errors;
                console.log('   ✅ Imported: ' + importResult.imported + ' new, ' + importResult.updated + ' updated, ' + importResult.errors + ' errors');
            } else {
                console.log('   ⚠️  No records found for ' + province);
            }

            const elapsed = Math.round((Date.now() - provinceStart) / 1000);
            console.log('   ⏱️  Province time: ' + elapsed + 's');

        } catch (error) {
            const errorMsg = province + ': ' + (error instanceof Error ? error.message : 'Unknown');
            provinceErrors.push(errorMsg);
            console.error('   ❌ Error in ' + province + ':', error);
        }

        const totalElapsed = Math.round((Date.now() - startTime) / 1000 / 60);
        const remaining = ALL_PROVINCES.length - i - 1;
        const avgTimePerProvince = totalElapsed / (i + 1);
        const estimatedRemaining = Math.round(remaining * avgTimePerProvince);

        console.log('\n   📊 PROGRESS: ' + totalRecords.toLocaleString() + ' records | ' + totalImported.toLocaleString() + ' imported | ' + totalElapsed + 'm elapsed | ~' + estimatedRemaining + 'm remaining');

        if (i < ALL_PROVINCES.length - 1) {
            await sleep(PROVINCE_DELAY_MS);
        }
    }

    await browser.close();
    await prisma.$disconnect();

    const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 CACAAV SCRAPE COMPLETE');
    console.log('═'.repeat(60));
    console.log('📊 Total Records Found: ' + totalRecords.toLocaleString());
    console.log('💾 New Profiles: ' + totalImported.toLocaleString());
    console.log('🔄 Updated Profiles: ' + totalUpdated.toLocaleString());
    console.log('❌ Import Errors: ' + totalErrors);
    console.log('❌ Province Errors: ' + provinceErrors.length);
    console.log('⏱️  Total Time: ' + totalTime + ' minutes');

    if (provinceErrors.length > 0) {
        console.log('\n❌ Province Errors:');
        provinceErrors.forEach(function (e) { console.log('   - ' + e); });
    }

    console.log('\n✅ Done!\n');
    process.exit(0);
}

main().catch(function (error) {
    console.error('\n💀 Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
});
