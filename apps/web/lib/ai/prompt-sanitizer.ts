/**
 * AI Prompt Sanitizer
 * ====================
 *
 * Phase 8 Security Remediation: P2
 * Sanitizes user input before embedding in AI prompts to prevent prompt injection attacks.
 *
 * This module provides defense-in-depth against:
 * - Prompt injection attempts (e.g., "ignore previous instructions")
 * - System prompt extraction attempts
 * - Role manipulation attacks
 * - Excessive input that could consume context window
 */

/**
 * Common prompt injection patterns to detect and sanitize
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Instruction override attempts
    { pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi, replacement: '[FILTERED]' },
    { pattern: /disregard\s+(all\s+)?previous\s+(instructions?|context)/gi, replacement: '[FILTERED]' },
    { pattern: /forget\s+(everything|all|what)\s+(you\s+)?know/gi, replacement: '[FILTERED]' },
    { pattern: /new\s+instructions?:\s*/gi, replacement: '' },
    { pattern: /override\s+(system|previous)\s+(prompt|instructions?)/gi, replacement: '[FILTERED]' },

    // Role manipulation
    { pattern: /^system:\s*/gim, replacement: '' },
    { pattern: /^assistant:\s*/gim, replacement: '' },
    { pattern: /^user:\s*/gim, replacement: '' },
    { pattern: /\[system\]/gi, replacement: '' },
    { pattern: /\[assistant\]/gi, replacement: '' },

    // Prompt extraction attempts
    { pattern: /reveal\s+(your\s+)?(system\s+)?prompt/gi, replacement: '[FILTERED]' },
    { pattern: /show\s+(me\s+)?(your\s+)?instructions?/gi, replacement: '[FILTERED]' },
    { pattern: /what\s+are\s+your\s+(system\s+)?instructions?/gi, replacement: '[FILTERED]' },
    { pattern: /print\s+(your\s+)?(initial\s+)?prompt/gi, replacement: '[FILTERED]' },

    // Code injection attempts
    { pattern: /```(system|prompt|instructions?)[\s\S]*?```/gi, replacement: '[CODE BLOCK FILTERED]' },

    // Jailbreak keywords
    { pattern: /DAN\s+(mode|prompt)/gi, replacement: '[FILTERED]' },
    { pattern: /do\s+anything\s+now/gi, replacement: '[FILTERED]' },
    { pattern: /developer\s+mode/gi, replacement: '[FILTERED]' },
];

/**
 * Maximum allowed input length to prevent context window abuse
 */
const MAX_INPUT_LENGTH = 4000;
const MAX_CONVERSATION_LENGTH = 10000;

/**
 * Sanitize user input for embedding in AI prompts
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 4000 chars)
 * @returns Sanitized input safe for prompt embedding
 */
export function sanitizePromptInput(
    input: string,
    maxLength: number = MAX_INPUT_LENGTH
): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let sanitized = input;

    // Apply all injection pattern filters
    for (const { pattern, replacement } of INJECTION_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s{3,}/g, '  ');

    // Truncate if too long
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '... [contenido truncado]';
    }

    return sanitized.trim();
}

/**
 * Sanitize conversation history for AI context
 *
 * @param history - Raw conversation history string
 * @returns Sanitized history safe for prompt embedding
 */
export function sanitizeConversationHistory(history: string): string {
    return sanitizePromptInput(history, MAX_CONVERSATION_LENGTH);
}

/**
 * Sanitize customer message for AI analysis
 * More permissive than general sanitization, but still filters dangerous patterns
 *
 * @param message - Customer WhatsApp message
 * @returns Sanitized message
 */
export function sanitizeCustomerMessage(message: string): string {
    if (!message || typeof message !== 'string') {
        return '';
    }

    let sanitized = message;

    // Only filter the most dangerous patterns for customer messages
    // (we want to preserve natural language as much as possible)
    const criticalPatterns = INJECTION_PATTERNS.slice(0, 5); // instruction overrides only

    for (const { pattern, replacement } of criticalPatterns) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    // Truncate excessive messages
    if (sanitized.length > MAX_INPUT_LENGTH) {
        sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '...';
    }

    return sanitized.trim();
}

/**
 * Sanitize staff query for AI assistant
 *
 * @param query - Staff member's query to AI
 * @returns Sanitized query
 */
export function sanitizeStaffQuery(query: string): string {
    return sanitizePromptInput(query, 2000);
}

/**
 * Check if input contains potential injection attempts
 * Useful for logging/monitoring without blocking
 *
 * @param input - Input to check
 * @returns True if suspicious patterns detected
 */
export function detectInjectionAttempt(input: string): boolean {
    if (!input) return false;

    const suspiciousPatterns = [
        /ignore\s+(all\s+)?previous/i,
        /reveal\s+(your\s+)?prompt/i,
        /system\s*:\s*/i,
        /DAN\s+mode/i,
        /jailbreak/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Log injection attempt for security monitoring
 */
export function logInjectionAttempt(
    input: string,
    source: 'customer' | 'staff' | 'copilot',
    organizationId?: string
): void {
    if (detectInjectionAttempt(input)) {
        console.warn('[AI Security] Potential injection attempt detected', {
            source,
            organizationId,
            inputPreview: input.substring(0, 100),
            timestamp: new Date().toISOString(),
        });
    }
}

const promptSanitizer = {
    sanitizePromptInput,
    sanitizeConversationHistory,
    sanitizeCustomerMessage,
    sanitizeStaffQuery,
    detectInjectionAttempt,
    logInjectionAttempt,
};

export default promptSanitizer;
