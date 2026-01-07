/**
 * Gasnor/GasNEA PDF Parser
 * =========================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Parses PDF files from gas distributor lists (Gasnor/GasNEA) to extract
 * gasista (gas technician) profiles.
 * 
 * GasNEA PDF Format (columns in order):
 * LOCALIDAD | NOMBRE Y APELLIDO | CUIT | DOMICILIO | TELEFONO | E MAIL | MAT NUMERO | TIPO | VIGENCIA
 * 
 * Uses pdf2json for reliable PDF text extraction.
 */

import { prisma } from '@/lib/prisma';
import PDFParser from 'pdf2json';

interface ParsedRecord {
    name: string;
    email: string | null;
    matricula: string;
    locality: string | null;
    province: string | null;     // Province (extracted from Gasnor, inferred for GasNEA)
    phone: string | null;        // Primary phone (WhatsApp formatted)
    phones: string[];            // All phones (WhatsApp formatted)
    cuit: string | null;
    address: string | null;      // Full DOMICILIO
    postalCode: string | null;   // CP extracted from address
    type: string | null;         // M1, M2, M3
    typeDescription: string | null; // Full description
    validUntil: string | null;   // VIGENCIA as string
    licenseExpiry: Date | null;  // VIGENCIA as Date
}

interface ImportResult {
    imported: number;
    updated: number;
    errors: number;
    total: number;
}

// Province mappings for each source
const SOURCE_PROVINCES: Record<string, string[]> = {
    GASNOR: ['Salta', 'Jujuy', 'Tucumán', 'Santiago del Estero'],
    GASNEA: ['Corrientes', 'Chaco', 'Formosa', 'Misiones', 'Entre Ríos'],
};

// Argentine area codes by province (for phone formatting)
const AREA_CODES: Record<string, string> = {
    '11': 'Buenos Aires',
    '351': 'Córdoba',
    '341': 'Rosario',
    '342': 'Santa Fe',
    '343': 'Paraná',
    '345': 'Concordia',
    '3624': 'Resistencia',
    '3722': 'Formosa',
    '3752': 'Posadas',
    '3783': 'Corrientes',
    '3442': 'Concepción del Uruguay',
    '3445': 'Gualeguaychú',
    '3447': 'Colón',
    '3456': 'Villaguay',
    '3454': 'Chajarí',
};

// Known localities in GasNEA region
const KNOWN_LOCALITIES = new Set([
    'VILLAGUAY', 'VILLA ELISA', 'VILLA', 'BASAVILBASO', 'BARRAQUERAS', 'BARRANQUERAS',
    'RESISTENCIA', 'CORRIENTES', 'FORMOSA', 'POSADAS', 'GOYA',
    'PASO DE LOS LIBRES', 'MONTE CASEROS', 'BELLA VISTA', 'ESQUINA',
    'FEDERACION', 'FEDERAL', 'CONCORDIA', 'CHAJARI', 'SAN JOSE',
    'CONCEPCION DEL URUGUAY', 'COLON', 'PARANA', 'SANTA FE',
    'RECONQUISTA', 'CHARATA', 'PRESIDENCIA ROQUE SAENZ PEÑA',
    'FONTANA', 'PUERTO TIROL', 'QUITILIPI',
    'CLORINDA', 'PIRANE', 'EL COLORADO', 'LAGUNA BLANCA',
    'OBERA', 'ELDORADO', 'PUERTO IGUAZU', 'APOSTOLES',
    'SAN ROQUE', 'EMPEDRADO', 'SALADAS', 'MBURUCUYA',
    'GUALEGUAYCHU', 'DIAMANTE', 'VICTORIA', 'NOGOYA',
]);

/**
 * Extract text from PDF using pdf2json
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);

        pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
            const error = 'parserError' in errData ? errData.parserError : errData;
            reject(error);
        });

        pdfParser.on('pdfParser_dataReady', () => {
            const rawText = pdfParser.getRawTextContent();
            resolve(rawText);
        });

        pdfParser.parseBuffer(buffer);
    });
}

/**
 * Detect PDF format based on content
 */
function detectFormat(text: string): 'GASNEA' | 'GASNOR' {
    // Gasnor has "MAT" and "CAT" and "APELLIDO" columns, no CUIT
    if (text.includes('APELLIDO') && text.includes('CAT') && text.includes('CELULAR')) {
        return 'GASNOR';
    }
    // GasNEA has "CUIT" column
    if (text.includes('CUIT')) {
        return 'GASNEA';
    }
    // Default to source-based detection (will be handled by caller)
    return 'GASNEA';
}

/**
 * Parse GasNEA PDF format
 * Columns: LOCALIDAD | NOMBRE Y APELLIDO | CUIT | DOMICILIO | TELEFONO | EMAIL | MAT NUMERO | TIPO | VIGENCIA
 * Uses CUIT as anchor to separate records
 */
function parseGasNEAFormat(text: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    console.log('[GasPDFParser] Parsing GasNEA format');
    console.log('[GasPDFParser] Raw text length:', text.length);
    console.log('[GasPDFParser] First 2000 chars:', text.substring(0, 2000));

    // Clean up text - remove page breaks and normalize
    const cleanText = text
        .replace(/----------------Page \(\d+\) Break----------------/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // Split into lines
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

    let headerFound = false;
    let currentRecordParts: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip header row
        if (trimmedLine.includes('LOCALIDAD') && trimmedLine.includes('NOMBRE')) {
            headerFound = true;
            continue;
        }

        // Skip title
        if (trimmedLine.includes('MATRICULADOS HABILITADOS')) {
            continue;
        }

        if (!headerFound) continue;

        // Check if this line contains a CUIT (11 digits) - indicates start of new record
        const cuitMatch = trimmedLine.match(/\b(\d{11}|\d{2}-\d{8}-\d)\b/);

        if (cuitMatch) {
            // If we have a previous record, process it
            if (currentRecordParts.length > 0) {
                const fullText = currentRecordParts.join(' ');
                const record = parseGasNEARecordText(fullText);
                if (record) records.push(record);
            }

            // Start new record
            currentRecordParts = [trimmedLine];
        } else if (currentRecordParts.length > 0) {
            // Continue current record
            currentRecordParts.push(trimmedLine);
        }
    }

    // Don't forget last record
    if (currentRecordParts.length > 0) {
        const fullText = currentRecordParts.join(' ');
        const record = parseGasNEARecordText(fullText);
        if (record) records.push(record);
    }

    console.log(`[GasPDFParser] Parsed ${records.length} GasNEA records`);

    return records;
}

/**
 * Parse Gasnor PDF format
 * Columns: MAT | CAT | APELLIDO | NOMBRE | DOMICILIO | LOCALIDAD | PROVINCIA | TELEFONO | CELULAR | EMAIL
 * Uses MAT (matricula number) as anchor to separate records
 */
function parseGasnorFormat(text: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    console.log('[GasPDFParser] Parsing Gasnor format');
    console.log('[GasPDFParser] Raw text length:', text.length);
    console.log('[GasPDFParser] First 2000 chars:', text.substring(0, 2000));

    // Clean up text - remove page breaks and normalize
    const cleanText = text
        .replace(/----------------Page \(\d+\) Break----------------/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // Split into lines
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

    let headerFound = false;
    let currentRecordParts: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip header row - Gasnor has MAT, CAT, APELLIDO headers
        if ((trimmedLine.includes('MAT') && trimmedLine.includes('APELLIDO')) ||
            (trimmedLine.includes('TELEFONO') && trimmedLine.includes('CELULAR'))) {
            headerFound = true;
            continue;
        }

        // Skip titles
        if (trimmedLine.includes('Listado de Instaladores') ||
            trimmedLine.includes('MATRICULADOS')) {
            continue;
        }

        if (!headerFound) continue;

        // Gasnor records start with a matricula number (2-4 digits) followed by category
        // Pattern: "209  1ra." or "69   2da."
        const matMatch = trimmedLine.match(/^(\d{1,4})\s+(1ra|2da|3ra)\.?\s/i);

        if (matMatch) {
            // If we have a previous record, process it
            if (currentRecordParts.length > 0) {
                const fullText = currentRecordParts.join(' ');
                const record = parseGasnorRecordText(fullText);
                if (record) records.push(record);
            }

            // Start new record
            currentRecordParts = [trimmedLine];
        } else if (currentRecordParts.length > 0) {
            // Continue current record
            currentRecordParts.push(trimmedLine);
        }
    }

    // Don't forget last record
    if (currentRecordParts.length > 0) {
        const fullText = currentRecordParts.join(' ');
        const record = parseGasnorRecordText(fullText);
        if (record) records.push(record);
    }

    console.log(`[GasPDFParser] Parsed ${records.length} Gasnor records`);

    return records;
}

/**
 * Parse a single Gasnor record's text into structured data
 * Format: MAT CAT APELLIDO NOMBRE DOMICILIO LOCALIDAD PROVINCIA TELEFONO CELULAR EMAIL
 * 
 * Example from PDF:
 * "646 1ra. GUTIERREZ HORACIO NICOLAS MZ A P5 LOTE 32 70VV 30 HECTARIAS Bº A.C SAN SALVADOR DE JUJUY JUJUY +54-388-4472324 +54-9-388-4472324 Email"
 */
function parseGasnorRecordText(text: string): ParsedRecord | null {
    console.log('[GasPDFParser] Parsing Gasnor record:', text.substring(0, 150));

    // Pattern: starts with matricula number and category
    const matCatMatch = text.match(/^(\d{1,4})\s+(1ra|2da|3ra)\.?\s+/i);
    if (!matCatMatch) return null;

    const matricula = matCatMatch[1];
    const categoryRaw = matCatMatch[2].toLowerCase();
    const category = categoryRaw === '1ra' ? 'M1' : categoryRaw === '2da' ? 'M2' : 'M3';

    // Text after matricula and category
    const afterMatCat = text.substring(matCatMatch[0].length).trim();

    // ===============================================
    // PHONE EXTRACTION - CONSERVATIVE APPROACH
    // ===============================================
    // IMPORTANT: Only match phones with +54 prefix to avoid cross-record contamination.
    // The PDF text extraction often concatenates multiple records together, and greedy
    // patterns like "10-digit numbers" will match phone numbers from OTHER records.
    //
    // Gasnor format: TELEFONO and CELULAR columns always use +54 format:
    // - +54-9-387-4475398 (mobile with 9)
    // - +54-387-4509527 (landline without 9)
    // - +54-3878-443097 (4-digit area code)
    // - +54-0385-4311157 (with leading 0 in area)

    const phones: string[] = [];
    const seenPhoneDigits = new Set<string>(); // For deduplication

    // Helper to normalize and add phone
    const addPhone = (areaCode: string, number: string) => {
        // Clean the area code (strip leading 0, remove non-digits)
        let cleanAreaCode = areaCode.replace(/^0/, '').replace(/\D/g, '');

        // Clean the number (remove 15 prefix if present, strip non-digits like periods)
        let cleanNumber = number.replace(/\D/g, ''); // Remove all non-digits
        cleanNumber = cleanNumber.replace(/^15/, ''); // Remove 15 prefix

        // Skip if area code or number is too short
        if (cleanAreaCode.length < 2 || cleanNumber.length < 6) {
            return;
        }

        // Create normalized key for deduplication
        const normalizedDigits = `${cleanAreaCode}${cleanNumber}`;

        // Skip if we already have this number
        if (seenPhoneDigits.has(normalizedDigits)) {
            return;
        }

        seenPhoneDigits.add(normalizedDigits);

        // Format for WhatsApp: +549 + areaCode + number
        const whatsappPhone = `+549${cleanAreaCode}${cleanNumber}`;
        phones.push(whatsappPhone);

        console.log(`[GasPDFParser] Found phone: area=${cleanAreaCode}, num=${cleanNumber} → ${whatsappPhone}`);
    };

    // ONLY PATTERN: Full international format +54-9-XXX-XXXXXXX or +54-XXX-XXXXXXX
    // This is the ONLY unambiguous phone format in the Gasnor PDFs
    // All TELEFONO and CELULAR columns use this format
    const intlPhonePattern = /\+54[-\s]?(9[-\s]?)?(0?\d{2,4})[-\s]?(\d{6,9})\.?/g;
    let phoneMatch;

    while ((phoneMatch = intlPhonePattern.exec(afterMatCat)) !== null) {
        let areaCode = phoneMatch[2];
        let number = phoneMatch[3];

        // Strip leading 0 from area code (handles +54-0385 → 385)
        areaCode = areaCode.replace(/^0/, '');

        // Skip if just "+54" with no real number (area code would be very short)
        if (areaCode.length < 2 || number.length < 6) {
            continue;
        }

        addPhone(areaCode, number);
    }

    // NOTE: All other patterns (10-digit, 15-prefix, area-number, slash) have been removed
    // because they cause cross-record contamination. The +54 pattern captures the actual
    // phone numbers from the TELEFONO and CELULAR columns.

    // ===============================================
    // PROVINCE EXTRACTION
    // ===============================================
    const GASNOR_PROVINCES = ['SALTA', 'JUJUY', 'TUCUMAN', 'SANTIAGO DEL ESTERO'];
    let province: string | null = null;

    // Look for province as a standalone word (not part of locality name)
    for (const prov of GASNOR_PROVINCES) {
        // Use word boundary to match "JUJUY" but not "SAN SALVADOR DE JUJUY"
        // Province appears AFTER locality in the format
        const provRegex = new RegExp(`\\b${prov}\\b(?!\\s*DE)`, 'i');
        if (provRegex.test(afterMatCat)) {
            province = prov;
            break;
        }
    }

    // Fallback: if no province found, look for it anywhere
    if (!province) {
        for (const prov of GASNOR_PROVINCES) {
            if (afterMatCat.toUpperCase().includes(prov)) {
                province = prov;
                break;
            }
        }
    }

    // ===============================================
    // LOCALITY EXTRACTION
    // ===============================================
    let locality: string | null = null;

    // Comprehensive list of Gasnor region localities (ordered by specificity)
    const localityPatterns = [
        // Multi-word localities (check first - longer matches take priority)
        'SAN SALVADOR DE JUJUY',
        'SAN MIGUEL DE TUCUMAN',
        'ROSARIO DE LA FRONTERA',
        'SANTIAGO DEL ESTERO',
        'ROSARIO DE LERMA',
        'TERMAS DE RIO HONDO',
        'BANDA DEL RIO SALI',
        'GENERAL GUEMES',
        'SAN PEDRO DE JUJUY',
        'LA MENDIETA',
        'SAN LORENZO',
        'LA BANDA',
        // Single/double word localities
        'YERBA BUENA',
        'TAFI VIEJO',
        'LAS TALITAS',
        'LOS NOGALES',
        'LOS POCITOS',
        'BELLA VISTA',
        'TARTAGAL',
        'MOSCONI',
        'PALPALA',
        'CONCEPCION',
        'SIMOCA',
        'METAN',
        'SAN PEDRO',
        'MONTEROS',
        'MANANTIAL',
        'ALBERDI',
        'LULES',
        'ORAN',
        'CAPITAL',
        'CENTRO',
        'SALTA', // City (when same as province)
    ];

    for (const loc of localityPatterns) {
        if (afterMatCat.toUpperCase().includes(loc)) {
            locality = loc;
            break;
        }
    }

    // ===============================================
    // NAME EXTRACTION (APELLIDO + NOMBRE)
    // ===============================================
    // Names come right after category, before address
    // Stop at: numbers, address keywords, phone patterns

    const words = afterMatCat.split(/\s+/);
    const nameWords: string[] = [];
    let addressStart = -1;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Stop conditions:
        // 1. Pure numbers (likely start of address like "380" or "32")
        if (/^\d+$/.test(word)) {
            addressStart = i;
            break;
        }

        // 2. Address keywords (expanded list)
        // LA, LAS, MAR, etc can be start of street names
        if (/^(AVDA?|AV|CALLE|MZ|MZA|LOTE|Bº|B°|BºSAN|PJ|PJE|BARRIO|BLK|SGTO|COSTANERA|MARINERO|FINCA|ALEJANDRO|COCHABAMBA|SANTA|MATEO|MAIPU|CONSTITUCION|LAS|DON)$/i.test(word)) {
            addressStart = i;
            break;
        }

        // 3. Province names (we've gone too far)
        if (GASNOR_PROVINCES.includes(word.toUpperCase())) {
            addressStart = i;
            break;
        }

        // 4. Phone patterns starting with +
        if (word.startsWith('+')) {
            addressStart = i;
            break;
        }

        nameWords.push(word);
    }

    // Limit name to reasonable length (APELLIDO + NOMBRE = usually 2-4 words)
    const nameParts = nameWords.slice(0, 4);
    const fullName = nameParts.join(' ').trim();

    if (!fullName || fullName.length < 3) return null;

    // ===============================================
    // ADDRESS EXTRACTION
    // ===============================================
    let address: string | null = null;
    if (addressStart > 0 && addressStart < words.length) {
        const addressWords: string[] = [];
        for (let i = addressStart; i < words.length; i++) {
            const word = words[i];

            // Stop at province, locality, or phone
            if (GASNOR_PROVINCES.includes(word.toUpperCase()) ||
                localityPatterns.some(l => l.split(' ').includes(word.toUpperCase())) ||
                word.startsWith('+')) {
                break;
            }
            addressWords.push(word);
        }
        if (addressWords.length > 0) {
            address = addressWords.join(' ');
        }
    }

    // ===============================================
    // EMAIL EXTRACTION
    // ===============================================
    let email: string | null = null;
    const emailMatch = afterMatCat.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch) {
        email = emailMatch[1].toLowerCase();
    }

    // Get category description
    const categoryDesc = getTypeDescription(category);

    console.log(`[GasPDFParser] Parsed: name="${fullName}", phones=${phones.length}, province="${province}", locality="${locality}"`);

    return {
        name: cleanName(fullName),
        email,
        matricula,
        locality,
        province, // Gasnor has province in PDF
        phone: phones.length > 0 ? phones[0] : null,
        phones,
        cuit: null, // Gasnor doesn't have CUIT
        address,
        postalCode: null,
        type: category,
        typeDescription: categoryDesc,
        validUntil: null,
        licenseExpiry: null,
    };
}

/**
 * Parse a single GasNEA record's text into structured data
 * Format: LOCALIDAD NAME CUIT ADDRESS PHONE EMAIL MATRICULA TYPE DATE
 * 
 * Key insight: CUIT is always 11 digits starting with 20/23/24/27/30/33/34
 * Phone numbers are after CUIT, often with format: 0XXXX-XXXXXX or XXXX-XXXXXX
 * Multiple phones may be separated by /
 */
function parseGasNEARecordText(text: string): ParsedRecord | null {
    // Patterns for each field
    const patterns = {
        // CUIT: 11 digits starting with 20/23/24/27/30/33/34 (Argentine CUIT prefixes)
        cuit: /\b((?:20|23|24|27|30|33|34)\d{9})\b/,
        // Alternative CUIT with dashes: XX-XXXXXXXX-X
        cuitDashed: /\b((?:20|23|24|27|30|33|34)-\d{8}-\d)\b/,
        // Email
        email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
        // Phone: Argentine format with area code (must start with 0 for landlines, or 3-4 digit area code)
        // Examples: 03455 422923, 03455-422923, 3455 422923, 3455422923
        // Also handles multiple phones: 03455 422923/537117
        phone: /\b(0?(?:3[4-8]\d{2}|11)[-\s]?\d{6,8}(?:\/\d{6,8})?)\b/,
        // Matricula with type: number followed by M1/M2/M3
        matriculaWithType: /\b(\d{2,5})\s+(M[123])\b/,
        // Type: M1, M2, M3
        type: /\b(M[123])\b/,
        // Date: dd-mmm-yy format
        date: /\b(\d{1,2}-[a-z]{3}-\d{2})\b/i,
    };

    // Try both CUIT patterns
    let cuitMatch = text.match(patterns.cuit);
    if (!cuitMatch) {
        cuitMatch = text.match(patterns.cuitDashed);
    }

    if (!cuitMatch) return null;

    const cuit = cuitMatch[1].replace(/-/g, ''); // Normalize CUIT without dashes
    const cuitPos = text.indexOf(cuitMatch[1]);

    // Text before CUIT contains LOCALIDAD + NOMBRE
    const beforeCuit = text.substring(0, cuitPos).trim();

    // Text after CUIT contains ADDRESS, PHONE, EMAIL, etc.
    const afterCuit = text.substring(cuitPos + cuitMatch[1].length).trim();

    // Now we search for phone ONLY in afterCuit (so we don't confuse CUIT with phone)
    const emailMatch = afterCuit.match(patterns.email);
    const matTypeMatch = afterCuit.match(patterns.matriculaWithType);
    const typeMatch = afterCuit.match(patterns.type);
    const dateMatch = afterCuit.match(patterns.date);

    // Parse LOCALIDAD and NAME from beforeCuit
    const { locality, name } = parseLocalityAndName(beforeCuit);

    // Extract address (DOMICILIO) - text between CUIT and phone/email
    // Look for patterns like: "ALBERTI 667 - CP:3240" or "CALLE 123"
    let address: string | null = null;
    let postalCode: string | null = null;

    // Try to extract address from afterCuit
    // Address is typically before the phone number
    const cpMatch = afterCuit.match(/CP[:\s]?(\d{4})/i);
    if (cpMatch) {
        postalCode = cpMatch[1];
        // Get text before CP as the street address
        const cpIndex = afterCuit.indexOf(cpMatch[0]);
        if (cpIndex > 0) {
            // Get text from start to CP, clean it
            let addressPart = afterCuit.substring(0, cpIndex + cpMatch[0].length).trim();
            // Remove phone patterns if they got mixed in
            addressPart = addressPart.replace(/\b0?\d{3,4}[-\s]?\d{6,8}\b/g, '').trim();
            // Remove email if present
            addressPart = addressPart.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '').trim();
            if (addressPart.length > 5) {
                address = addressPart;
            }
        }
    } else {
        // No CP found, try to get address anyway (less reliable)
        // Address patterns typically have street + number
        const addressMatch = afterCuit.match(/^([A-ZÁÉÍÓÚÑ\s]+\s+\d+[^0-9]*?)(?=\s*0?\d{3,4}[-\s]?\d{6}|\s*[a-z]+@)/i);
        if (addressMatch) {
            address = addressMatch[1].trim();
        }
    }

    // Extract phones - search in afterCuit only!
    // Look for patterns like: 03455 422923 or 03455 422923/537117
    let phones: string[] = [];

    // Try to find phone with area code starting with 0 (most common format)
    const phonePattern = /\b(0?(?:3[4-8]\d{2}|11|2\d{2,3})[-\s]?(?:\d{6,8}|\d{3}[-\s]?\d{4,5})(?:\/\d{6,8})?)\b/g;
    let phoneMatch;
    while ((phoneMatch = phonePattern.exec(afterCuit)) !== null) {
        const potentialPhone = phoneMatch[1];
        // Validate it's not just a short number or postal code
        const digitsOnly = potentialPhone.replace(/\D/g, '');
        if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
            // Check if it contains a / (multiple phones)
            if (potentialPhone.includes('/')) {
                const parts = potentialPhone.split('/');
                // Extract area code from first number
                const firstDigits = parts[0].replace(/\D/g, '');
                let areaCode = '';
                // Area codes are 3-5 digits (including leading 0)
                if (firstDigits.startsWith('0')) {
                    areaCode = firstDigits.substring(0, 5); // 0XXXX
                } else {
                    areaCode = '0' + firstDigits.substring(0, 4); // Add 0 prefix
                }
                phones.push(parts[0]);
                // Second number might be just the local part, add area code
                if (parts[1]) {
                    const secondDigits = parts[1].replace(/\D/g, '');
                    if (secondDigits.length <= 7) {
                        // It's a local number, prepend area code
                        phones.push(areaCode.substring(0, 5) + secondDigits);
                    } else {
                        phones.push(parts[1]);
                    }
                }
            } else {
                phones.push(potentialPhone);
            }
            break; // Take first valid phone match
        }
    }

    // If no match with stricter pattern, try simpler pattern
    if (phones.length === 0) {
        const simplePhoneMatch = afterCuit.match(/\b(0\d{2,4}[-\s]?\d{6,8})\b/);
        if (simplePhoneMatch) {
            const digitsOnly = simplePhoneMatch[1].replace(/\D/g, '');
            if (digitsOnly.length >= 10) {
                phones.push(simplePhoneMatch[1]);
            }
        }
    }

    // Format all phones for WhatsApp
    const formattedPhones = phones.map(p => formatPhoneForWhatsApp(p));
    const primaryPhone = formattedPhones.length > 0 ? formattedPhones[0] : null;

    // Find matricula (should be before M1/M2/M3)
    let matricula = '';
    if (matTypeMatch) {
        matricula = matTypeMatch[1];
    } else {
        // Try to find any 3-5 digit number that could be matricula
        // Look for it near the end, after the type indicator
        const afterCuitNumbers = afterCuit.match(/\b(\d{3,5})\b/g) || [];
        // The matricula is usually the last 3-5 digit number before the type/date
        if (afterCuitNumbers.length > 0) {
            matricula = afterCuitNumbers[afterCuitNumbers.length - 1];
        }
    }

    if (!name || name.length < 3) return null;

    // Get type and description
    const type = typeMatch ? typeMatch[1] : (matTypeMatch ? matTypeMatch[2] : null);
    const typeDescription = getTypeDescription(type);

    // Parse VIGENCIA date
    const licenseExpiry = dateMatch ? parseSpanishDate(dateMatch[1]) : null;

    return {
        name: cleanName(name),
        email: emailMatch ? emailMatch[1].toLowerCase() : null,
        matricula: matricula || `GAS-${hashString(cuit)}`,
        locality,
        province: null, // GasNEA infers province from locality
        phone: primaryPhone,
        phones: formattedPhones,
        cuit,
        address,
        postalCode,
        type,
        typeDescription,
        validUntil: dateMatch ? dateMatch[1] : null,
        licenseExpiry,
    };
}

/**
 * Parse locality and name from the text before CUIT
 */
function parseLocalityAndName(text: string): { locality: string | null; name: string } {
    const words = text.trim().split(/\s+/);

    if (words.length === 0) return { locality: null, name: '' };

    // Try to match known localities (1, 2, or 3 words)
    for (let i = Math.min(3, words.length); i >= 1; i--) {
        const potentialLocality = words.slice(0, i).join(' ').toUpperCase();
        if (KNOWN_LOCALITIES.has(potentialLocality)) {
            return {
                locality: potentialLocality,
                name: words.slice(i).join(' '),
            };
        }
    }

    // If no known locality found, assume first word is locality
    // (common pattern: single word locality followed by name)
    const firstWord = words[0].toUpperCase();
    if (/^[A-ZÁÉÍÓÚÑ]+$/.test(firstWord) && firstWord.length > 2) {
        return {
            locality: firstWord,
            name: words.slice(1).join(' '),
        };
    }

    // All words are name
    return { locality: null, name: text };
}

/**
 * Format phone number for WhatsApp
 * Argentine format: +54 9 XXXX XXXXXX (for mobiles)
 * Landlines may not work with WhatsApp
 */
function formatPhoneForWhatsApp(phone: string): string {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');

    // Remove leading 0 if present
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    // Remove 15 if present (old mobile format)
    if (digits.includes('15')) {
        digits = digits.replace('15', '');
    }

    // Validate length (should be 10 digits: area code + number)
    if (digits.length < 10) {
        // Might be missing area code, try to pad or return as-is
        return `+54${digits}`;
    }

    // Format for WhatsApp: +54 9 XXXX XXXXXX
    // The 9 is required for Argentine mobile numbers
    // This assumes it's a mobile - landlines won't work with WhatsApp anyway
    return `+549${digits}`;
}

/**
 * Simple hash function for generating IDs
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Clean name to proper case
 */
function cleanName(name: string): string {
    if (!name) return '';

    return name
        .trim()
        // Handle "LASTNAME, FIRSTNAME" format - put firstname first
        .replace(/^([A-ZÁÉÍÓÚÑ]+),\s*(.+)$/i, '$2 $1')
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Get human-readable description for gasista license type
 * M1: 1ra Categoría - Industrial/complex installations
 * M2: 2da Categoría - Standard residential/commercial
 * M3: 3ra Categoría - Single appliances, smaller scope
 */
function getTypeDescription(type: string | null): string | null {
    if (!type) return null;

    const descriptions: Record<string, string> = {
        'M1': '1ra Categoría - Industrial',
        'M2': '2da Categoría - Residencial/Comercial',
        'M3': '3ra Categoría - Artefactos individuales',
    };

    return descriptions[type.toUpperCase()] || null;
}

/**
 * Parse Spanish date format (dd-mmm-yy) to Date object
 * Example: "31-mar-26" -> 2026-03-31
 */
function parseSpanishDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;

    const months: Record<string, number> = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
        // English variants just in case
        'jan': 0, 'apr': 3, 'aug': 7, 'dec': 11,
    };

    // Pattern: dd-mmm-yy or d-mmm-yy
    const match = dateStr.match(/(\d{1,2})-([a-z]{3})-(\d{2})/i);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const yearShort = parseInt(match[3], 10);

    const month = months[monthStr];
    if (month === undefined) return null;

    // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx otherwise)
    const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;

    return new Date(year, month, day);
}

/**
 * Infer province from locality
 */
function inferProvince(locality: string | null): string {
    if (!locality) return 'Corrientes'; // Default

    const loc = locality.toLowerCase();

    // Entre Ríos
    if (['villaguay', 'villa elisa', 'basavilbaso', 'concordia', 'colon',
        'federacion', 'federal', 'gualeguaychu', 'parana', 'diamante',
        'concepcion del uruguay', 'chajari', 'victoria', 'nogoya'].some(l => loc.includes(l))) {
        return 'Entre Ríos';
    }

    // Chaco
    if (['resistencia', 'barranqueras', 'barraqueras', 'fontana', 'charata',
        'presidencia roque saenz peña', 'quitilipi', 'puerto tirol'].some(l => loc.includes(l))) {
        return 'Chaco';
    }

    // Corrientes
    if (['corrientes', 'goya', 'bella vista', 'esquina', 'paso de los libres',
        'monte caseros', 'san roque', 'empedrado', 'saladas', 'mburucuya'].some(l => loc.includes(l))) {
        return 'Corrientes';
    }

    // Formosa
    if (['formosa', 'clorinda', 'pirane', 'el colorado', 'laguna blanca'].some(l => loc.includes(l))) {
        return 'Formosa';
    }

    // Misiones
    if (['posadas', 'obera', 'eldorado', 'puerto iguazu', 'apostoles'].some(l => loc.includes(l))) {
        return 'Misiones';
    }

    return 'Corrientes'; // Default for GasNEA region
}

/**
 * Import parsed records into the database
 */
export async function importGasRecords(
    records: ParsedRecord[],
    source: 'GASNOR' | 'GASNEA',
    sourceUrl?: string
): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
        try {
            if (!record.name || record.name.length < 3) {
                errors++;
                continue;
            }

            // Use extracted province (Gasnor) or infer from locality (GasNEA)
            const province = record.province || inferProvince(record.locality);

            // Check for existing profile by source + matricula
            const existing = await prisma.unclaimedProfile.findFirst({
                where: {
                    source: source as never,
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
                        phones: record.phones.length > 0 ? record.phones : existing.phones,
                        email: record.email || existing.email,
                        cuit: record.cuit || existing.cuit,
                        city: record.locality || existing.city,
                        province,
                        address: record.address || existing.address,
                        postalCode: record.postalCode || existing.postalCode,
                        category: record.type || existing.category,
                        categoryDesc: record.typeDescription || existing.categoryDesc,
                        licenseExpiry: record.licenseExpiry || existing.licenseExpiry,
                        scrapedAt: new Date(),
                    },
                });
                updated++;
            } else {
                // Create new record
                await prisma.unclaimedProfile.create({
                    data: {
                        source: source as never,
                        sourceUrl: sourceUrl || `pdf_import_${source}`,
                        fullName: record.name,
                        matricula: record.matricula,
                        phone: record.phone,
                        phones: record.phones,
                        email: record.email,
                        cuit: record.cuit,
                        profession: 'Gasista',
                        city: record.locality,
                        province,
                        address: record.address,
                        postalCode: record.postalCode,
                        category: record.type,
                        categoryDesc: record.typeDescription,
                        licenseExpiry: record.licenseExpiry,
                        scrapedAt: new Date(),
                    },
                });
                imported++;
            }
        } catch (error) {
            console.error(`[GasPDFParser] Error importing ${record.name}:`, error);
            errors++;
        }
    }

    console.log(`[GasPDFParser] Import complete: ${imported} new, ${updated} updated, ${errors} errors`);

    return {
        imported,
        updated,
        errors,
        total: records.length,
    };
}

/**
 * Main PDF parser class
 */
export class GasPDFParser {
    /**
     * Parse PDF using Python pdfplumber script for accurate table extraction
     */
    async parseFromBase64(
        base64Content: string,
        source: 'GASNOR' | 'GASNEA',
        sourceUrl?: string
    ): Promise<ImportResult> {
        try {
            const { spawn } = await import('child_process');
            const fs = await import('fs/promises');
            const path = await import('path');
            const os = await import('os');

            // Convert base64 to buffer and save to temp file
            const buffer = Buffer.from(base64Content, 'base64');
            const tempDir = os.tmpdir();
            const tempFile = path.join(tempDir, `gas_pdf_${Date.now()}.pdf`);

            await fs.writeFile(tempFile, buffer);
            console.log(`[GasPDFParser] Saved PDF to temp file: ${tempFile} (${buffer.length} bytes)`);

            // Get path to Python script
            const scriptPath = path.join(process.cwd(), 'scripts', 'parse-gas-pdf.py');

            // Determine format hint
            const formatHint = source === 'GASNOR' ? 'gasnor' : source === 'GASNEA' ? 'gasnea' : 'auto';

            // Call Python script
            console.log(`[GasPDFParser] Calling Python script with format: ${formatHint}`);

            const result = await new Promise<string>((resolve, reject) => {
                const pythonProcess = spawn('python', [scriptPath, tempFile, '--format', formatHint]);

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                    console.log(`[GasPDFParser] Python: ${data.toString().trim()}`);
                });

                pythonProcess.on('close', (code) => {
                    // Clean up temp file
                    fs.unlink(tempFile).catch(() => { });

                    if (code !== 0) {
                        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                    } else {
                        resolve(stdout);
                    }
                });

                pythonProcess.on('error', (err) => {
                    fs.unlink(tempFile).catch(() => { });
                    reject(new Error(`Failed to start Python: ${err.message}. Make sure Python and pdfplumber are installed.`));
                });
            });

            // Parse JSON output from Python
            let pythonRecords: Array<{
                matricula: string;
                fullName: string;
                category: string | null;
                categoryDesc: string | null;
                address: string | null;
                postalCode?: string | null;
                city: string | null;
                province: string | null;
                phone: string | null;
                phones: string[];
                email: string | null;
                cuit: string | null;
                licenseExpiry?: string | null;
                source: string;
            }>;

            try {
                pythonRecords = JSON.parse(result);
            } catch (parseError) {
                console.error('[GasPDFParser] Failed to parse Python output:', result.substring(0, 500));
                throw new Error('Failed to parse Python script output');
            }

            if ('error' in pythonRecords) {
                throw new Error((pythonRecords as unknown as { error: string }).error);
            }

            console.log(`[GasPDFParser] Python parsed ${pythonRecords.length} records`);

            // Convert to ParsedRecord format
            const records: ParsedRecord[] = pythonRecords.map(r => ({
                name: r.fullName,
                email: r.email,
                matricula: r.matricula,
                locality: r.city,
                province: r.province,
                phone: r.phone,
                phones: r.phones || [],
                cuit: r.cuit,
                address: r.address,
                postalCode: r.postalCode || null,
                type: r.category,
                typeDescription: r.categoryDesc,
                validUntil: r.licenseExpiry || null,
                licenseExpiry: r.licenseExpiry ? new Date(r.licenseExpiry) : null,
            }));

            console.log(`[GasPDFParser] Converted ${records.length} records for import`);

            if (records.length > 0) {
                console.log('[GasPDFParser] Sample records:', JSON.stringify(records.slice(0, 3), null, 2));
            }

            // Import records
            return importGasRecords(records, source, sourceUrl);
        } catch (error) {
            console.error('[GasPDFParser] Error parsing PDF:', error);
            throw error;
        }
    }

    /**
     * Parse from file path (for server-side use)
     */
    async parseFromFile(
        filePath: string,
        source: 'GASNOR' | 'GASNEA'
    ): Promise<ImportResult> {
        try {
            const fs = await import('fs/promises');
            const buffer = await fs.readFile(filePath);
            const base64 = buffer.toString('base64');
            return this.parseFromBase64(base64, source, filePath);
        } catch (error) {
            console.error('[GasPDFParser] Error reading file:', error);
            throw error;
        }
    }

    /**
     * Import manually entered records (for testing/manual import)
     */
    async importManual(
        records: ParsedRecord[],
        source: 'GASNOR' | 'GASNEA'
    ): Promise<ImportResult> {
        return importGasRecords(records, source, 'manual_import');
    }
}

// Singleton instance
let parserInstance: GasPDFParser | null = null;

export function getGasPDFParser(): GasPDFParser {
    if (!parserInstance) {
        parserInstance = new GasPDFParser();
    }
    return parserInstance;
}

export default GasPDFParser;
