/**
 * Text Utilities
 * ===============
 * 
 * Text normalization and search utilities for accent-insensitive matching.
 * Essential for the Argentine market where names like "Pérez", "González", 
 * and "Martínez" are common.
 */

/**
 * Remove accents/diacritics from a string.
 * Uses Unicode normalization (NFD) to decompose characters, then removes
 * combining diacritical marks.
 * 
 * @example
 * normalizeText('Pérez') // 'Perez'
 * normalizeText('González') // 'Gonzalez'
 * normalizeText('Martínez') // 'Martinez'
 * normalizeText('José María') // 'Jose Maria'
 */
export function normalizeText(text: string): string {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize text for search (lowercase + remove accents).
 * Use this for building search queries.
 * 
 * @example
 * normalizeForSearch('Roberto Pérez') // 'roberto perez'
 */
export function normalizeForSearch(text: string): string {
    return normalizeText(text).toLowerCase();
}

/**
 * Check if a text matches a search term (accent and case insensitive).
 * 
 * @example
 * textMatchesSearch('Roberto Pérez', 'perez') // true
 * textMatchesSearch('José González', 'jose gonzalez') // true
 */
export function textMatchesSearch(text: string, searchTerm: string): boolean {
    if (!text || !searchTerm) return false;
    return normalizeForSearch(text).includes(normalizeForSearch(searchTerm));
}

/**
 * Build a PostgreSQL-compatible search pattern for accent-insensitive matching.
 * Returns an array of patterns that covers both accented and unaccented versions.
 * 
 * Note: For optimal PostgreSQL performance, consider using the `unaccent` extension.
 * This provides a fallback using ILIKE patterns.
 */
export function buildSearchPatterns(searchTerm: string): string[] {
    const normalized = normalizeForSearch(searchTerm);
    const original = searchTerm.toLowerCase();

    // Return both patterns for OR matching
    const patterns = [`%${normalized}%`];
    if (original !== normalized) {
        patterns.push(`%${original}%`);
    }
    return patterns;
}
