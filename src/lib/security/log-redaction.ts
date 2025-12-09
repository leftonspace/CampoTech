/**
 * Log Redaction Service
 * =====================
 *
 * Automatically redacts sensitive/PII data from logs to prevent
 * accidental exposure. Supports configurable patterns and field names.
 *
 * Sensitive data types:
 * - Personal identifiers (CUIT, DNI, phone numbers)
 * - Financial data (card numbers, bank accounts)
 * - Credentials (passwords, tokens, API keys)
 * - Contact information (email addresses)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RedactionConfig {
  /** Whether redaction is enabled (default: true) */
  enabled: boolean;
  /** Replacement string for redacted values (default: '[REDACTED]') */
  replacement: string;
  /** Custom sensitive field names to redact */
  sensitiveFields: string[];
  /** Custom regex patterns to redact */
  customPatterns: Array<{
    name: string;
    pattern: RegExp;
    replacement?: string;
  }>;
  /** Fields to preserve (whitelist) */
  preserveFields: string[];
  /** Maximum depth for nested object redaction (default: 10) */
  maxDepth: number;
  /** Log redaction statistics (default: false) */
  logStats: boolean;
}

export interface RedactionStats {
  totalRedactions: number;
  byType: Record<string, number>;
  lastReset: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SENSITIVE_FIELDS = [
  // Credentials
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'secretKey',
  'secret_key',
  'authorization',
  'auth',
  'credential',
  'credentials',

  // Personal identifiers
  'cuit',
  'cuil',
  'dni',
  'documentNumber',
  'document_number',
  'ssn',
  'socialSecurityNumber',

  // Financial
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'securityCode',
  'security_code',
  'accountNumber',
  'account_number',
  'routingNumber',
  'routing_number',
  'iban',
  'cbu',

  // Contact (partial redaction)
  'phone',
  'phoneNumber',
  'phone_number',
  'mobile',
  'celular',
  'email',
  'emailAddress',
  'email_address',

  // AFIP/Certificates
  'certificate',
  'cert',
  'afipCert',
  'afip_cert',
  'afipKey',
  'afip_key',
  'pkcs12',
  'p12',
  'pfx',

  // MercadoPago
  'mpAccessToken',
  'mpRefreshToken',
  'publicKey',
  'public_key',
  'clientSecret',
  'client_secret',

  // WhatsApp
  'waToken',
  'whatsappToken',
  'whatsapp_token',
  'appSecret',
  'app_secret',
];

// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const REDACTION_PATTERNS = {
  // Argentine CUIT/CUIL: XX-XXXXXXXX-X or XXXXXXXXXXX
  cuit: {
    pattern: /\b(20|23|24|27|30|33|34)\d{8,9}\b/g,
    replacement: '[CUIT_REDACTED]',
  },
  cuitFormatted: {
    pattern: /\b(20|23|24|27|30|33|34)-\d{8}-\d\b/g,
    replacement: '[CUIT_REDACTED]',
  },

  // Argentine DNI: 7-8 digits
  dni: {
    pattern: /\bDNI[:\s]*\d{7,8}\b/gi,
    replacement: 'DNI: [REDACTED]',
  },

  // Phone numbers (Argentine format)
  phoneArg: {
    pattern: /\+54\s*9?\s*\d{2,4}\s*\d{4}\s*\d{4}/g,
    replacement: '[PHONE_REDACTED]',
  },
  phoneGeneric: {
    pattern: /\b\d{10,15}\b/g,
    // This is too broad - will only apply to specific contexts
    replacement: '[PHONE_REDACTED]',
  },

  // Email addresses
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },

  // Credit card numbers (basic patterns)
  creditCard: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    replacement: '[CARD_REDACTED]',
  },

  // CVV/CVC (3-4 digits in card context)
  cvv: {
    pattern: /\b(cvv|cvc|security.?code)[:\s]*\d{3,4}\b/gi,
    replacement: '$1: [REDACTED]',
  },

  // JWT tokens
  jwt: {
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
  },

  // Bearer tokens
  bearer: {
    pattern: /Bearer\s+[a-zA-Z0-9_-]+/gi,
    replacement: 'Bearer [REDACTED]',
  },

  // API keys (common formats)
  apiKey: {
    pattern: /\b(api[_-]?key|apikey)[:\s=]*[a-zA-Z0-9_-]{20,}/gi,
    replacement: '$1=[REDACTED]',
  },

  // Base64 encoded data (potential secrets)
  base64Long: {
    pattern: /[A-Za-z0-9+/]{100,}={0,2}/g,
    replacement: '[BASE64_REDACTED]',
  },

  // Argentine CBU (22 digits)
  cbu: {
    pattern: /\b\d{22}\b/g,
    replacement: '[CBU_REDACTED]',
  },

  // IP addresses (internal only by default)
  ipInternal: {
    pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
    replacement: '[IP_REDACTED]',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOG REDACTION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class LogRedactionService {
  private config: RedactionConfig;
  private stats: RedactionStats;
  private sensitiveFieldsSet: Set<string>;
  private preserveFieldsSet: Set<string>;

  constructor(config: Partial<RedactionConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      replacement: config.replacement ?? '[REDACTED]',
      sensitiveFields: [
        ...DEFAULT_SENSITIVE_FIELDS,
        ...(config.sensitiveFields || []),
      ],
      customPatterns: config.customPatterns || [],
      preserveFields: config.preserveFields || ['id', 'orgId', 'userId', 'requestId', 'correlationId', 'timestamp', 'level', 'message', 'service'],
      maxDepth: config.maxDepth ?? 10,
      logStats: config.logStats ?? false,
    };

    this.sensitiveFieldsSet = new Set(
      this.config.sensitiveFields.map(f => f.toLowerCase())
    );
    this.preserveFieldsSet = new Set(
      this.config.preserveFields.map(f => f.toLowerCase())
    );

    this.stats = {
      totalRedactions: 0,
      byType: {},
      lastReset: new Date(),
    };
  }

  /**
   * Redact sensitive data from an object
   */
  redact<T>(data: T, depth: number = 0): T {
    if (!this.config.enabled) return data;
    if (depth > this.config.maxDepth) return data;

    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.redactString(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redact(item, depth + 1)) as unknown as T;
    }

    if (typeof data === 'object') {
      return this.redactObject(data as Record<string, unknown>, depth) as unknown as T;
    }

    return data;
  }

  /**
   * Redact sensitive patterns from a string
   */
  redactString(value: string): string {
    if (!this.config.enabled) return value;
    if (!value || typeof value !== 'string') return value;

    let result = value;

    // Apply built-in patterns
    for (const [name, { pattern, replacement }] of Object.entries(REDACTION_PATTERNS)) {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        this.recordRedaction(name, matches.length);
      }
    }

    // Apply custom patterns
    for (const { name, pattern, replacement } of this.config.customPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement || this.config.replacement);
        this.recordRedaction(`custom:${name}`, matches.length);
      }
    }

    return result;
  }

  /**
   * Redact sensitive fields from an object
   */
  private redactObject(
    obj: Record<string, unknown>,
    depth: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();

      // Skip preserved fields at top level
      if (depth === 0 && this.preserveFieldsSet.has(keyLower)) {
        result[key] = value;
        continue;
      }

      // Check if field name is sensitive
      if (this.isSensitiveField(keyLower)) {
        result[key] = this.redactValue(value, key);
        this.recordRedaction(`field:${key}`, 1);
        continue;
      }

      // Recursively process nested values
      result[key] = this.redact(value, depth + 1);
    }

    return result;
  }

  /**
   * Check if a field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    // Direct match
    if (this.sensitiveFieldsSet.has(fieldName)) {
      return true;
    }

    // Partial match for common patterns
    const sensitivePatterns = [
      'password', 'secret', 'token', 'key', 'credential',
      'auth', 'cert', 'private', 'card', 'cvv', 'cvc',
    ];

    return sensitivePatterns.some(pattern =>
      fieldName.includes(pattern)
    );
  }

  /**
   * Redact a sensitive value (preserve type information)
   */
  private redactValue(value: unknown, fieldName: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    const keyLower = fieldName.toLowerCase();

    // Partial redaction for emails (show domain)
    if (keyLower.includes('email') && typeof value === 'string') {
      return this.partialRedactEmail(value);
    }

    // Partial redaction for phones (show last 4)
    if ((keyLower.includes('phone') || keyLower.includes('mobile') || keyLower.includes('celular')) && typeof value === 'string') {
      return this.partialRedactPhone(value);
    }

    // Partial redaction for CUIT (show prefix)
    if ((keyLower === 'cuit' || keyLower === 'cuil') && typeof value === 'string') {
      return this.partialRedactCuit(value);
    }

    // Full redaction for other sensitive fields
    if (typeof value === 'string') {
      return this.config.replacement;
    }

    if (typeof value === 'number') {
      return 0;
    }

    if (typeof value === 'object') {
      return this.config.replacement;
    }

    return this.config.replacement;
  }

  /**
   * Partial email redaction: j***@example.com
   */
  private partialRedactEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return this.config.replacement;

    const [local, domain] = parts;
    const redactedLocal = local.length > 1
      ? `${local[0]}***`
      : '***';

    return `${redactedLocal}@${domain}`;
  }

  /**
   * Partial phone redaction: ****-****-1234
   */
  private partialRedactPhone(phone: string): string {
    // Keep only digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return this.config.replacement;

    const last4 = digits.slice(-4);
    return `****-****-${last4}`;
  }

  /**
   * Partial CUIT redaction: 20-********-*
   */
  private partialRedactCuit(cuit: string): string {
    const clean = cuit.replace(/\D/g, '');
    if (clean.length < 11) return this.config.replacement;

    const prefix = clean.slice(0, 2);
    return `${prefix}-********-*`;
  }

  /**
   * Record redaction for statistics
   */
  private recordRedaction(type: string, count: number): void {
    this.stats.totalRedactions += count;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + count;
  }

  /**
   * Get redaction statistics
   */
  getStats(): RedactionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRedactions: 0,
      byType: {},
      lastReset: new Date(),
    };
  }

  /**
   * Add sensitive field names at runtime
   */
  addSensitiveFields(fields: string[]): void {
    fields.forEach(f => this.sensitiveFieldsSet.add(f.toLowerCase()));
  }

  /**
   * Add custom pattern at runtime
   */
  addCustomPattern(name: string, pattern: RegExp, replacement?: string): void {
    this.config.customPatterns.push({ name, pattern, replacement });
  }

  /**
   * Enable/disable redaction
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if redaction is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let redactionService: LogRedactionService | null = null;

/**
 * Initialize the global log redaction service
 */
export function initializeLogRedaction(config?: Partial<RedactionConfig>): void {
  redactionService = new LogRedactionService(config);
}

/**
 * Get the global log redaction service
 */
export function getLogRedactionService(): LogRedactionService {
  if (!redactionService) {
    // Auto-initialize with defaults
    redactionService = new LogRedactionService();
  }
  return redactionService;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Redact sensitive data from an object
 */
export function redact<T>(data: T): T {
  return getLogRedactionService().redact(data);
}

/**
 * Redact sensitive patterns from a string
 */
export function redactString(value: string): string {
  return getLogRedactionService().redactString(value);
}

/**
 * Create a redacted copy of an Error
 */
export function redactError(error: Error): { name: string; message: string; stack?: string } {
  const service = getLogRedactionService();
  return {
    name: error.name,
    message: service.redactString(error.message),
    stack: error.stack ? service.redactString(error.stack) : undefined,
  };
}

/**
 * Safe JSON stringify with redaction
 */
export function safeStringify(obj: unknown, space?: number): string {
  const redacted = redact(obj);
  try {
    return JSON.stringify(redacted, null, space);
  } catch {
    return '[Unable to stringify]';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FOR EXPRESS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Express middleware to redact request/response bodies in logs
 */
export function redactionMiddleware() {
  return (req: any, res: any, next: () => void) => {
    // Store original body for redacted logging
    if (req.body) {
      req.redactedBody = redact(req.body);
    }

    // Intercept response for redacted logging
    const originalSend = res.send;
    res.send = function(body: any) {
      if (body && typeof body === 'object') {
        res.redactedBody = redact(body);
      }
      return originalSend.call(this, body);
    };

    next();
  };
}
