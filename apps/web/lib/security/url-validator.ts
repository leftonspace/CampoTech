/**
 * URL Validation and Sanitization Utilities
 * ==========================================
 *
 * Defense-in-depth utilities for validating URLs in client-side code.
 * Prevents open redirect vulnerabilities and javascript: URL injection.
 *
 * @security Phase 11 Remediation - L-UI-01
 * @module lib/security/url-validator
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Protocols that are considered safe for URL handling
 */
const SAFE_PROTOCOLS = ['https:', 'http:', 'tel:', 'mailto:', 'sms:'] as const;

/**
 * Dangerous protocols that should always be blocked
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'] as const;

/**
 * Trusted external domains for navigation/linking
 */
const TRUSTED_EXTERNAL_DOMAINS = [
    // CampoTech domains
    'campotech.com',
    'app.campotech.com',
    'api.campotech.com',
    // Communication
    'wa.me',
    'web.whatsapp.com',
    'api.whatsapp.com',
    // Maps
    'google.com',
    'maps.google.com',
    'www.google.com',
    'waze.com',
    // Payment (MercadoPago)
    'mercadopago.com',
    'mercadopago.com.ar',
    // Government (AFIP)
    'afip.gov.ar',
    'afip.gob.ar',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// URL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface UrlValidationOptions {
    /**
     * Allow internal (same-origin) paths
     * @default true
     */
    allowInternal?: boolean;

    /**
     * Allow external domains from the trusted list
     * @default true
     */
    allowTrustedExternal?: boolean;

    /**
     * Additional trusted domains for this specific validation
     */
    additionalTrustedDomains?: string[];

    /**
     * Restrict to specific protocols
     */
    allowedProtocols?: typeof SAFE_PROTOCOLS[number][];
}

/**
 * Check if a URL is safe for navigation or linking
 *
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns true if the URL is considered safe
 *
 * @example
 * ```typescript
 * // Internal paths are safe
 * isSafeUrl('/dashboard/jobs') // true
 *
 * // javascript: URLs are blocked
 * isSafeUrl('javascript:alert(1)') // false
 *
 * // Trusted external domains are allowed
 * isSafeUrl('https://wa.me/1234567890') // true
 *
 * // Untrusted external domains are blocked
 * isSafeUrl('https://evil.com/phish') // false
 * ```
 */
export function isSafeUrl(url: string, options: UrlValidationOptions = {}): boolean {
    const {
        allowInternal = true,
        allowTrustedExternal = true,
        additionalTrustedDomains = [],
        allowedProtocols = [...SAFE_PROTOCOLS],
    } = options;

    // Handle empty/null input
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Trim and normalize
    const normalizedUrl = url.trim();

    // Block obvious dangerous patterns
    const lowerUrl = normalizedUrl.toLowerCase();
    for (const dangerous of DANGEROUS_PROTOCOLS) {
        if (lowerUrl.startsWith(dangerous)) {
            return false;
        }
    }

    // Allow simple relative paths (internal navigation)
    if (allowInternal && isRelativePath(normalizedUrl)) {
        return true;
    }

    // Parse and validate absolute URLs
    try {
        const parsed = new URL(normalizedUrl, typeof window !== 'undefined' ? window.location.origin : 'https://campotech.com');

        // Check protocol
        if (!allowedProtocols.includes(parsed.protocol as typeof SAFE_PROTOCOLS[number])) {
            return false;
        }

        // For tel:, mailto:, sms: - always allow (no domain check needed)
        if (['tel:', 'mailto:', 'sms:'].includes(parsed.protocol)) {
            return true;
        }

        // Check if same origin (internal)
        if (allowInternal && typeof window !== 'undefined' && parsed.origin === window.location.origin) {
            return true;
        }

        // Check against trusted domains
        if (allowTrustedExternal) {
            const allTrustedDomains = [...TRUSTED_EXTERNAL_DOMAINS, ...additionalTrustedDomains];
            const hostname = parsed.hostname.toLowerCase();

            for (const domain of allTrustedDomains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }
        }

        // URL is not in trusted list
        return false;
    } catch {
        // URL parsing failed - not safe
        return false;
    }
}

/**
 * Check if a path is a relative path (starts with / but not //)
 */
function isRelativePath(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIRECT SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize a redirect URL to prevent open redirect attacks
 *
 * Only allows internal paths (starting with /) that don't start with //.
 * External URLs are replaced with the fallback.
 *
 * @param url - The URL to sanitize
 * @param fallback - Fallback URL if the input is unsafe (default: '/')
 * @returns Safe redirect URL
 *
 * @example
 * ```typescript
 * sanitizeRedirectUrl('/dashboard') // '/dashboard'
 * sanitizeRedirectUrl('https://evil.com') // '/'
 * sanitizeRedirectUrl('//evil.com') // '/'
 * sanitizeRedirectUrl('/dashboard', '/home') // '/dashboard'
 * ```
 */
export function sanitizeRedirectUrl(url: string | null | undefined, fallback = '/'): string {
    // Handle empty input
    if (!url || typeof url !== 'string') {
        return fallback;
    }

    const trimmed = url.trim();

    // Only allow internal paths
    if (isRelativePath(trimmed)) {
        // Additional check: no protocol-relative paths or encoded characters
        if (!trimmed.includes('://') && !trimmed.includes('%2F%2F')) {
            return trimmed;
        }
    }

    return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HREF SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize an href attribute value
 *
 * Returns a safe href or '#' if the URL is dangerous.
 * Useful for rendering user-provided links.
 *
 * @param href - The href value to sanitize
 * @param options - Validation options
 * @returns Safe href value
 *
 * @example
 * ```typescript
 * <a href={sanitizeHref(userProvidedUrl)}>Link</a>
 * ```
 */
export function sanitizeHref(href: string | null | undefined, options?: UrlValidationOptions): string {
    if (!href || typeof href !== 'string') {
        return '#';
    }

    return isSafeUrl(href, options) ? href : '#';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the domain from a URL for display purposes
 *
 * @param url - The URL to extract domain from
 * @returns Domain string or null if invalid
 *
 * @example
 * ```typescript
 * extractDomain('https://app.campotech.com/dashboard') // 'app.campotech.com'
 * extractDomain('/dashboard') // null (relative path)
 * ```
 */
export function extractDomain(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const UrlValidator = {
    isSafeUrl,
    sanitizeRedirectUrl,
    sanitizeHref,
    extractDomain,
    SAFE_PROTOCOLS,
    TRUSTED_EXTERNAL_DOMAINS,
    DANGEROUS_PROTOCOLS,
} as const;

export default UrlValidator;
